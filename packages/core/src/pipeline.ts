/**
 * Phase A→C composition helper. Calls the indexer + per-note renderer in
 * sequence, threads cross-note state (graph, alias map, attachment closure,
 * private-title audit set) through both, and returns the structured
 * `PipelineResult` that downstream adapters (`@noteforge/astro` loader, audit
 * CLI) consume.
 *
 * Shape after the v0.x deepening:
 *
 *   1. `buildVaultIndex(input)`                   ─ Phase A: discovery (one-shot)
 *   2. classify all notes → `publicSlugs`         ─ Phase B
 *   3. linkRewriter pass over every public note   ─ Phase C, cross-note (must
 *      precede transclusion so embeds pull in already-rewritten subtrees)
 *   4. `renderPublicNote(...)` for each public    ─ Phase C, per-note: transclude →
 *      slug; emits the RAW RenderedNote               serialize → frontmatter/tag filter.
 *      (image surfaces NOT yet closure-gated)         Refs collected here feed the closure.
 *   5. cross-note attachment refs from private    ─ closure inputs
 *      notes via `collectAttachmentRefs`
 *   6. graph build + public subgraph              ─ cross-note ops
 *   7. `buildAttachmentClosure(...)`              ─ cross-note decision
 *   8. `applyAttachmentClosure(rendered, ...)`    ─ single owner of image/frontmatter
 *      per public slug + glob tag blocklist          gating; materializes the final maps
 *   9. alias redirects (publishable only)         ─ cross-note op
 *  10. compose `PipelineResult`
 *
 * privacy-first contract:
 *   - the public/private verdict is decided exclusively in `privacy/classify`.
 *     Neither this orchestrator nor the indexer nor the per-note renderer
 *     re-derive it.
 *   - every privacy stage (linkRewriter, transclude inside renderPublicNote,
 *     frontmatter allowlist, attachment closure, alias filter, audit set) is
 *     driven by the classify output.
 *   - attachment closure decisions (`collectAttachmentRefs`,
 *     `buildAttachmentClosure`, `applyAttachmentClosure`) live in one module
 *     — `privacy/attachmentClosure.ts`. The orchestrator calls; it does not
 *     re-implement.
 */

import picomatch from 'picomatch';
import * as path from 'node:path';
import type { Root } from 'mdast';

import { buildAliasRedirects, type AliasRedirect } from './aliases/buildAliasMap.ts';
import { getClassifyRule, type ObpubConfig } from './config.ts';
import { parseMarkdownToMdast } from './render/parseMarkdown.ts';
import {
  renderPublicNote,
  type NoteHeading,
  type RenderedNote,
} from './render/renderPublicNote.ts';
import {
  applyAttachmentClosure,
  buildAttachmentClosure,
  collectAttachmentRefs,
  type AttachmentRef,
} from './privacy/attachmentClosure.ts';
import { classify } from './privacy/classify.ts';
import {
  buildGraph,
  filterToPublicSubgraph,
  type GraphEdge,
  type GraphNode,
} from './privacy/graph.ts';
import { rewriteWikilinks } from './privacy/linkRewriter.ts';
import {
  parseWikilinkTarget,
  resolveWikilink,
  type WikilinkIndex,
} from './resolve/wikilink.ts';
import { buildVaultIndex } from './vaultIndex/buildVaultIndex.ts';
import type { ParsedNote } from './types.ts';

export type { NoteHeading } from './render/renderPublicNote.ts';

export interface PipelineWarning {
  readonly code: string;
  readonly file?: string;
  readonly message: string;
}

export interface PublicGraphEdge {
  readonly from: string;
  readonly to: string;
}

export interface PublicGraph {
  readonly nodes: string[];
  readonly edges: PublicGraphEdge[];
}

export interface PipelineResult {
  notes: ParsedNote[];
  publicSlugs: Set<string>;
  renderedHtml: Map<string, string>;
  noteHeadings: Map<string, readonly NoteHeading[]>;
  publicFrontmatter: Map<string, Record<string, unknown>>;
  publicTags: Map<string, string[]>;
  publicGraph: PublicGraph;
  attachmentClosure: Set<string>;
  firstImage: Map<string, string>;
  embeddedImages: Map<string, readonly string[]>;
  sourcePathBySlug: Map<string, string>;
  privateNoteTitles: Set<string>;
  allAttachments: Set<string>;
  aliasRedirects: readonly AliasRedirect[];
  warnings: PipelineWarning[];
}

const MD_EXT_RE = /\.(md|markdown)$/i;

export async function runCorePipeline(config: ObpubConfig): Promise<PipelineResult> {
  const vault = config.vaults[0];
  if (vault === undefined) {
    throw new Error('runCorePipeline: config has no vault');
  }

  // ── Phase A — Discovery (delegated to VaultIndex) ─────────────────────────
  const classifyRule = getClassifyRule(config, vault.id);
  const noteIgnore = stripTripwireFromIgnore(vault.ignore, classifyRule.tripwirePaths);
  const attachmentIgnore = stripUploadDirFromIgnore(
    noteIgnore,
    config.attachments.uploadDir,
  );

  const vaultIndex = await buildVaultIndex({
    vaultPath: vault.path,
    vaultId: vault.id,
    noteIgnore,
    attachmentIgnore,
    attachmentExtensions: config.attachments.allowedExtensions,
    slugMode: config.nav.mode,
  });

  const { notes, slugByRelPath, indexedNotes, wikilinkIndex, attachments } = vaultIndex;

  // ── Phase B — Classification ───────────────────────────────────────────────
  const warnings: PipelineWarning[] = [];
  const isPublicBySlug = new Map<string, boolean>();

  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    const verdict = classify(n, classifyRule);
    isPublicBySlug.set(slug, verdict.isPublic);
    if (verdict.tripwireFired) {
      warnings.push({
        code: 'TRIPWIRE_REJECTED',
        file: n.relativePath,
        message: verdict.reason,
      });
    }
  }

  const publicSlugs = new Set<string>();
  for (const [slug, ok] of isPublicBySlug) {
    if (ok) publicSlugs.add(slug);
  }

  // ── Phase C — linkRewriter pass (cross-note) ──────────────────────────────
  // Build an mdast for every public note and apply rewriteWikilinks in place.
  // Transclusion below depends on these being already-rewritten so embedded
  // wikilinks don't leak as raw `[[...]]` text.
  const rewrittenMdastBySlug = new Map<string, Root>();
  const sourcePathBySlug = new Map<string, string>();
  const notesBySlug = new Map<string, typeof notes[number]>();

  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    notesBySlug.set(slug, n);
    sourcePathBySlug.set(slug, n.relativePath);
    if (publicSlugs.has(slug)) {
      // `parseMarkdownToMdast` layers GFM + math grammar onto CommonMark and
      // applies the Obsidian post-parse transforms (highlight, inline
      // footnote, task checkboxes). KaTeX SSR runs later in renderPublicNote.
      rewrittenMdastBySlug.set(slug, parseMarkdownToMdast(n.body));
    }
  }

  for (const slug of publicSlugs) {
    const note = notesBySlug.get(slug);
    const tree = rewrittenMdastBySlug.get(slug);
    if (note === undefined || tree === undefined) continue;
    rewriteWikilinks({
      tree,
      sourceFile: note.relativePath,
      resolve: (raw) => resolveForLink(raw, wikilinkIndex),
      isPublic: (id) => publicSlugs.has(id),
      hrefFor: (id, heading) =>
        heading !== undefined ? `/${id}#${headingToAnchor(heading)}` : `/${id}`,
    });
  }

  // ── Phase C — per-note render via renderPublicNote ────────────────────────
  // Each call returns html + headings + filtered frontmatter/tags + RAW image
  // URLs + this note's attachment refs. We hold on to each note's raw
  // RenderedNote so the closure post-pass below can apply the cross-note
  // attachment closure once it has been built.
  const rawRenderedBySlug = new Map<string, RenderedNote>();
  const attachmentRefs: AttachmentRef[] = [];

  for (const slug of publicSlugs) {
    const note = notesBySlug.get(slug);
    const tree = rewrittenMdastBySlug.get(slug);
    if (note === undefined || tree === undefined) continue;

    const rendered = renderPublicNote({
      rewrittenMdast: tree,
      note,
      slug,
      vaultIndex,
      publicSlugs,
      // Targets transcluded into this note must already have linkRewriter
      // applied — they live in our pre-built map.
      getRewrittenMdast: (id) => rewrittenMdastBySlug.get(id),
      frontmatterAllowlist: config.publishing.frontmatterAllowlist,
      // renderPublicNote takes a literal tag blocklist; we still apply
      // picomatch-glob blocking in the closure post-pass below.
      tagBlocklist: [],
      gateTag: classifyRule.publicTag,
    });

    rawRenderedBySlug.set(slug, rendered);
    for (const ref of rendered.attachmentRefs) attachmentRefs.push(ref);
  }

  // ── Phase C — private notes' attachment refs (cross-note glue) ────────────
  // Closure must exclude attachments referenced ONLY by private notes — so we
  // collect their refs too. The per-note scan lives in
  // `privacy/attachmentClosure.ts` so this loop and the public-note path share
  // one implementation.
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined || publicSlugs.has(slug)) continue;
    for (const ref of collectAttachmentRefs(n, vaultIndex, slug)) {
      attachmentRefs.push(ref);
    }
  }

  // ── Cross-note ops: graph, closure, alias map, audit set ──────────────────
  const graphNodes: GraphNode[] = [];
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    const title = n.frontmatter['title'];
    graphNodes.push({
      id: slug,
      relativePath: n.relativePath,
      ...(typeof title === 'string' ? { title } : {}),
      isPublic: publicSlugs.has(slug),
    });
  }

  const graphEdges: GraphEdge[] = [];
  for (const n of notes) {
    const fromSlug = slugByRelPath.get(n.relativePath);
    if (fromSlug === undefined) continue;
    for (const edge of extractEdges(
      n.body,
      fromSlug,
      wikilinkIndex,
      vaultIndex.attachmentByBasenameLower,
    )) {
      graphEdges.push(edge);
    }
  }

  const fullGraph = buildGraph(graphNodes, graphEdges);
  const pubGraph = filterToPublicSubgraph(fullGraph);

  const closure = buildAttachmentClosure({
    publicNoteIds: publicSlugs,
    allReferences: attachmentRefs,
    allowedExtensions: config.attachments.allowedExtensions,
  });

  // ── Closure post-pass: apply the cross-note closure to each raw render ────
  // `applyAttachmentClosure` is the single owner of "this URL/frontmatter
  // field survives the closure". The picomatch-glob tag blocklist that
  // `renderPublicNote` intentionally doesn't depend on is also applied here.
  const renderedHtml = new Map<string, string>();
  const noteHeadings = new Map<string, readonly NoteHeading[]>();
  const publicFrontmatter = new Map<string, Record<string, unknown>>();
  const publicTags = new Map<string, string[]>();
  const firstImage = new Map<string, string>();
  const embeddedImages = new Map<string, readonly string[]>();

  const tagBlocklistMatcher =
    config.publishing.tagBlocklist.length > 0
      ? picomatch(config.publishing.tagBlocklist as string[])
      : (): boolean => false;

  for (const slug of publicSlugs) {
    const raw = rawRenderedBySlug.get(slug);
    if (raw === undefined) continue;
    const gated = applyAttachmentClosure(raw, closure.included);

    renderedHtml.set(slug, gated.html);
    if (gated.headings.length > 0) {
      noteHeadings.set(slug, gated.headings);
    }
    publicFrontmatter.set(slug, gated.frontmatter);
    publicTags.set(slug, gated.tags.filter((t) => !tagBlocklistMatcher(t)));
    if (gated.embeddedImages.length > 0) {
      embeddedImages.set(slug, gated.embeddedImages);
    }
    if (gated.firstImage !== undefined) {
      firstImage.set(slug, gated.firstImage);
    }
  }

  // ── Alias redirects from publishable subset ───────────────────────────────
  const publishableIndexed = indexedNotes.filter((n) => publicSlugs.has(n.id));
  const aliasResult = buildAliasRedirects(publishableIndexed);
  for (const message of aliasResult.warnings) {
    warnings.push({ code: 'ALIAS_WARNING', message });
  }

  // ── Audit: private note titles + bare filenames ───────────────────────────
  const privateNoteTitles = new Set<string>();
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    if (publicSlugs.has(slug)) continue;
    const title = n.frontmatter['title'];
    if (typeof title === 'string') {
      const cleaned = title.trim();
      if (cleaned.length > 0) privateNoteTitles.add(cleaned);
    }
    const basename = path.posix
      .basename(n.relativePath)
      .replace(MD_EXT_RE, '');
    if (basename.length > 0) privateNoteTitles.add(basename);
  }

  return {
    notes: [...notes],
    publicSlugs,
    renderedHtml,
    noteHeadings,
    publicFrontmatter,
    publicTags,
    publicGraph: {
      nodes: pubGraph.nodes.map((n) => n.id),
      edges: pubGraph.edges.map((e) => ({ from: e.from, to: e.to })),
    },
    attachmentClosure: new Set(closure.included),
    firstImage,
    embeddedImages,
    sourcePathBySlug,
    privateNoteTitles,
    allAttachments: new Set(attachments),
    aliasRedirects: aliasResult.redirects,
    warnings,
  } as PipelineResult;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function resolveForLink(
  raw: string,
  index: WikilinkIndex,
): { resolved: boolean; targetId?: string } {
  const res = resolveWikilink(raw, index);
  if (res.resolved && res.note !== undefined) {
    return { resolved: true, targetId: res.note.id };
  }
  return { resolved: false };
}

function extractEdges(
  body: string,
  fromSlug: string,
  index: WikilinkIndex,
  attachmentByBasenameLower: ReadonlyMap<string, string>,
): GraphEdge[] {
  const out: GraphEdge[] = [];
  const linkRe = /(?<!!)\[\[([^[\]]*)\]\]/g;
  const embedRe = /!\[\[([^[\]]*)\]\]/g;

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(body)) !== null) {
    const raw = m[1] ?? '';
    const res = resolveWikilink(raw, index);
    if (res.resolved && res.note !== undefined) {
      out.push({ from: fromSlug, to: res.note.id, kind: 'link' });
    }
  }

  while ((m = embedRe.exec(body)) !== null) {
    const raw = m[1] ?? '';
    const parsed = parseWikilinkTarget(raw);
    if (attachmentByBasenameLower.has(parsed.target.toLowerCase())) continue;
    const res = resolveWikilink(raw, index);
    if (res.resolved && res.note !== undefined) {
      out.push({ from: fromSlug, to: res.note.id, kind: 'embed' });
    }
  }
  return out;
}

function headingToAnchor(heading: string): string {
  return heading.trim().toLowerCase().replace(/\s+/g, '-');
}

function stripTripwireFromIgnore(
  merged: readonly string[],
  tripwirePaths: readonly string[],
): string[] {
  if (tripwirePaths.length === 0) return [...merged];
  const tripwireSet = new Set(tripwirePaths);
  return merged.filter((p) => !tripwireSet.has(p));
}

function stripUploadDirFromIgnore(
  merged: readonly string[],
  uploadDir: string,
): string[] {
  const normalized = uploadDir.replace(/^\/+|\/+$/g, '');
  const uploadDirGlobs = new Set([
    normalized,
    `${normalized}/**`,
    `${normalized}/**/*`,
  ]);
  return merged.filter((p) => !uploadDirGlobs.has(p.replace(/^\/+|\/+$/g, '')));
}
