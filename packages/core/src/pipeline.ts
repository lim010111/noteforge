/**
 * Phase A→C composition helper. Reads a vault from disk, applies the full privacy
 * pipeline, and returns a structured result that downstream adapters
 * (`@noteforge/astro` loader, audit CLI) can consume.
 *
 * Framework-free: imports only `@noteforge/core` internals + `mdast-util-from-markdown`,
 * `mdast-util-to-hast`, `hast-util-to-html`. No Astro or browser symbols.
 *
 * privacy-first contract:
 *   - the public/private verdict is decided exclusively in `privacy/classify`.
 *     This file never re-derives `isPublic` from frontmatter or tags.
 *   - every downstream privacy stage (linkRewriter, transclude, frontmatterFilter,
 *     tagBlocklist, attachmentFilter) is driven by the classify output.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mathFromMarkdown } from 'mdast-util-math';
import { math as mathSyntax } from 'micromark-extension-math';
import type { Root } from 'mdast';

import { renderMdastToHtml } from './render/htmlFromMdast.ts';

import { buildAliasRedirects, type AliasRedirect } from './aliases/buildAliasMap.ts';
import { getClassifyRule, type ObpubConfig } from './config.ts';
import { parseNote } from './discover/parseNote.ts';
import { walkVault } from './discover/walk.ts';
import {
  buildAttachmentClosure,
  type AttachmentRef,
} from './privacy/attachmentFilter.ts';
import { classify } from './privacy/classify.ts';
import { filterFrontmatter } from './privacy/frontmatterFilter.ts';
import {
  buildGraph,
  filterToPublicSubgraph,
  type GraphEdge,
  type GraphNode,
} from './privacy/graph.ts';
import { rewriteWikilinks } from './privacy/linkRewriter.ts';
import { expandTransclusions } from './privacy/transclude.ts';
import {
  buildWikilinkIndex,
  parseWikilinkTarget,
  resolveWikilink,
  type IndexedNote,
  type WikilinkIndex,
} from './resolve/wikilink.ts';
import { computeSlug } from './slug.ts';
import type { ParsedNote } from './types.ts';

/**
 * Lift a `$$expr$$` that occupies its own line into the fenced-block form
 * that micromark-extension-math recognises as display math.
 *
 * Why: Obsidian users routinely write display formulas as a single line —
 *   `$$W \leftarrow W + \Delta W$$`
 * — but the math micromark grammar only treats the fenced form (the `$$`
 * pair on its own line, with the expression between them) as block math.
 * Without this normalisation those single-line formulas end up parsed as
 * inline math and render without the centred display layout the author
 * intended. We only rewrite lines whose entire content (after optional
 * indentation) is a single `$$…$$` group, so multi-formula paragraphs and
 * inline `$$x$$` mid-sentence are untouched.
 */
function promoteSingleLineDisplayMath(body: string): string {
  // JS regex replacement strings interpret `$$` as a literal `$`, so the
  // fenced delimiters need to be written as `$$$$` to emit `$$` in the
  // output. This was the bug that quietly downgraded promoted lines to a
  // single dollar — never let it back in without round-tripping through
  // the test fixture below.
  return body.replace(
    /^([ \t]*)\$\$([^$\n]+?)\$\$[ \t]*$/gm,
    '$1$$$$\n$2\n$$$$',
  );
}

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
  /** All parsed notes (public + private). Private notes are kept for leak detection. */
  notes: ParsedNote[];
  /** Slugs of notes classified as public. */
  publicSlugs: Set<string>;
  /** Rendered HTML per public slug, after linkRewriter + transclude + serialization. */
  renderedHtml: Map<string, string>;
  /**
   * Allowlist-filtered frontmatter per public slug. `cover`/`thumbnail` values
   * are additionally gated against the public attachment closure before they
   * enter this adapter-facing side channel.
   */
  publicFrontmatter: Map<string, Record<string, unknown>>;
  /** Blocklist-filtered tag list per public slug. */
  publicTags: Map<string, string[]>;
  /** Public subgraph — both nodes and edge endpoints are guaranteed public. */
  publicGraph: PublicGraph;
  /** Vault-relative paths of attachments included in the public closure. */
  attachmentClosure: Set<string>;
  /**
   * First image URL per public slug, used by the theme to render a hero
   * background on the note header.
   *
   * privacy contract: `/attachments/<id>` URLs are validated against
   * `attachmentClosure` before they enter this map — an image whose source is
   * referenced only by a private note never reaches downstream consumers.
   * Absolute http(s):// URLs pass through verbatim (the network leak risk is
   * the author's choice and matches the `<img src>` they wrote). Other relative
   * URLs (paths the wikilink/attachment matcher could not normalise) are
   * intentionally dropped — surfacing a broken hero is worse than no hero.
   */
  firstImage: Map<string, string>;
  /**
   * Document-order image candidates per public slug, after the same privacy
   * gate as `firstImage`. Used by dev-only picker UI; private-only attachments
   * must never enter this side channel.
   */
  embeddedImages: Map<string, readonly string[]>;
  /** Slug → vault-relative source markdown path. Dev tooling uses this to edit frontmatter. */
  sourcePathBySlug: Map<string, string>;
  /**
   * Title-shaped strings of every private note (frontmatter `title` and the bare
   * filename, both included). Audit consumers scan rendered HTML for these to detect
   * leaked private-note mentions.
   */
  privateNoteTitles: Set<string>;
  /** Vault-relative paths of all discovered attachments (public + private). */
  allAttachments: Set<string>;
  /**
   * Redirects from frontmatter `aliases` to canonical slugs. Built only from the
   * publishable subset, so private-note aliases never appear here. Adapters consume
   * this to emit alias routes; the canonical slug is `to`.
   */
  aliasRedirects: readonly AliasRedirect[];
  /** Structured diagnostics (tripwire hits, unresolved links, etc.). */
  warnings: PipelineWarning[];
}

const MD_EXT_RE = /\.(md|markdown)$/i;

export async function runCorePipeline(config: ObpubConfig): Promise<PipelineResult> {
  const vault = config.vaults[0];
  if (vault === undefined) {
    throw new Error('runCorePipeline: config has no vault');
  }

  // ── Phase A — Discovery ────────────────────────────────────────────────────
  // The walker must yield notes under tripwire paths (e.g. `private/**`) so that
  // `classify` can observe their public marker and emit the tripwire warning.
  // Truly-ignored directories (`.obsidian`, `.trash`) stay in `walkIgnore`.
  const classifyRule = getClassifyRule(config, vault.id);
  const walkIgnore = stripTripwireFromIgnore(vault.ignore, classifyRule.tripwirePaths);

  const notes = await discoverNotes(vault.path, vault.id, walkIgnore);
  const attachments = await discoverAttachments(
    vault.path,
    walkIgnore,
    config.attachments.allowedExtensions,
  );

  const slugByRelPath = new Map<string, string>();
  for (const n of notes) {
    slugByRelPath.set(
      n.relativePath,
      computeSlug({ frontmatter: n.frontmatter, relativePath: n.relativePath }),
    );
  }

  const indexedNotes = toIndexedNotes(notes, slugByRelPath);
  const wikilinkIndex = buildWikilinkIndex(indexedNotes);
  const attachmentByBasenameLower = indexAttachmentsByBasename(attachments);
  const attachmentIds = new Set(attachments);

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

  // ── Phase C — Graph + link/transclude rewrite + HTML serialization ─────────

  // Build an mdast for every note (public + private).
  // Public notes will have linkRewriter applied in place below.
  // Private note mdasts are never rendered; we only keep them to compute full-graph edges
  // when needed. (We actually collect edges by regex-scanning the raw body, so private
  // mdasts are unused in practice — but keeping the data shape symmetric is cheap.)
  const rewrittenMdastBySlug = new Map<string, Root>();
  const notesBySlug = new Map<string, ParsedNote>();
  const sourcePathBySlug = new Map<string, string>();
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    notesBySlug.set(slug, n);
    sourcePathBySlug.set(slug, n.relativePath);
    if (publicSlugs.has(slug)) {
      // micromark-extension-math + mdast-util-math turn `$x$` into `inlineMath`
      // and `$$x$$` into `math` mdast nodes; without them the dollar-sign
      // syntax flowed through as plain text and reached the rendered HTML
      // unchanged. KaTeX SSR is applied later in renderMdastToHtml.
      rewrittenMdastBySlug.set(
        slug,
        fromMarkdown(promoteSingleLineDisplayMath(n.body), {
          extensions: [mathSyntax()],
          mdastExtensions: [mathFromMarkdown()],
        }) as unknown as Root,
      );
    }
  }

  // Apply linkRewriter to each public note (mutates in place).
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

  // Apply transclude to each public note. `mdastFor` must return a fresh copy each
  // invocation because transclude walks and mutates the synthetic tree — sharing
  // subtrees would let an embed's recursion corrupt the source note's own render.
  const attachmentRefs: AttachmentRef[] = [];
  for (const slug of publicSlugs) {
    const note = notesBySlug.get(slug);
    const tree = rewrittenMdastBySlug.get(slug);
    if (note === undefined || tree === undefined) continue;

    expandTransclusions({
      tree,
      sourceId: slug,
      sourceFile: note.relativePath,
      resolve: (raw) => resolveForEmbed(raw, wikilinkIndex, attachmentByBasenameLower),
      isPublic: (id) => publicSlugs.has(id),
      mdastFor: (id) => cloneTree(rewrittenMdastBySlug.get(id)),
      attachmentUrlFor: (id) => `/attachments/${id}`,
    });

    // Collect attachment references from this note's raw body (before rewrites
    // consumed/transformed them). We scan raw markdown because attachmentFilter is a
    // pure set computation and doesn't care about rendered positions — only
    // which (note, attachment) pairs existed.
    for (const ref of collectAttachmentRefs(
      note.body,
      slug,
      attachmentByBasenameLower,
    )) {
      attachmentRefs.push(ref);
    }
    for (const ref of collectFrontmatterAttachmentRefs(
      note.frontmatter,
      slug,
      attachmentIds,
    )) {
      attachmentRefs.push(ref);
    }
  }

  // Also collect attachment refs from private notes so the closure correctly excludes
  // attachments referenced ONLY by private notes.
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined || publicSlugs.has(slug)) continue;
    for (const ref of collectAttachmentRefs(n.body, slug, attachmentByBasenameLower)) {
      attachmentRefs.push(ref);
    }
    for (const ref of collectFrontmatterAttachmentRefs(
      n.frontmatter,
      slug,
      attachmentIds,
    )) {
      attachmentRefs.push(ref);
    }
  }

  // Serialize public mdasts to HTML — heading anchors are applied here so the
  // HTML reaching every adapter (Astro loader, audit CLI) carries them.
  const renderedHtml = new Map<string, string>();
  for (const slug of publicSlugs) {
    const tree = rewrittenMdastBySlug.get(slug);
    if (tree === undefined) continue;
    renderedHtml.set(slug, renderMdastToHtml(tree));
  }

  // Frontmatter allowlist + tag blocklist per public note.
  const publicFrontmatter = new Map<string, Record<string, unknown>>();
  const publicTags = new Map<string, string[]>();
  const isBlockedTag =
    config.publishing.tagBlocklist.length > 0
      ? picomatch(config.publishing.tagBlocklist as string[])
      : (): boolean => false;
  // The publish-gate tag (and its `/...` subtags) is the marker that opts a
  // note INTO publication — its presence on every public note is a structural
  // tautology, so surfacing it in tag chips / tag pages / tag indexes adds
  // zero reader value and would make every note look like it shares a tag
  // with every other note. Strip it here, alongside the user-configured
  // tagBlocklist, so all adapters/themes/audits see the same cleaned set.
  const gateTag = classifyRule.publicTag;
  const isGateTag = (t: string): boolean =>
    t === gateTag || t.startsWith(`${gateTag}/`);

  for (const slug of publicSlugs) {
    const note = notesBySlug.get(slug);
    if (note === undefined) continue;
    publicFrontmatter.set(
      slug,
      filterFrontmatter(note.frontmatter, config.publishing.frontmatterAllowlist),
    );
    publicTags.set(
      slug,
      note.tags.filter((t) => !isBlockedTag(t) && !isGateTag(t)),
    );
  }

  // Full graph → public subgraph.
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
      attachmentByBasenameLower,
    )) {
      graphEdges.push(edge);
    }
  }

  const fullGraph = buildGraph(graphNodes, graphEdges);
  const pubGraph = filterToPublicSubgraph(fullGraph);

  // Attachment closure.
  const closure = buildAttachmentClosure({
    publicNoteIds: publicSlugs,
    allReferences: attachmentRefs,
    allowedExtensions: config.attachments.allowedExtensions,
  });
  for (const frontmatter of publicFrontmatter.values()) {
    sanitizePublicImageFrontmatter(frontmatter, closure.included);
  }

  // First-image extraction per public slug. Walked AFTER linkRewriter +
  // expandTransclusions so wikilink-embedded `![[image.png]]` references have
  // already been normalised into mdast `image` nodes with `/attachments/<id>`
  // urls. The closure check below ensures a private-only attachment cannot ride
  // the hero channel out to dist (privacy first: same gate as the image's own
  // <img src>; the hero just consumes a side-channel from the same closure).
  const firstImage = new Map<string, string>();
  const embeddedImages = new Map<string, readonly string[]>();
  for (const slug of publicSlugs) {
    const tree = rewrittenMdastBySlug.get(slug);
    if (tree === undefined) continue;
    const urls = findAllImageUrls(tree).filter((url) =>
      isPublicImageUrl(url, closure.included),
    );
    if (urls.length === 0) continue;
    embeddedImages.set(slug, urls);
    firstImage.set(slug, urls[0]!);
  }

  // Alias redirects from frontmatter `aliases`. Built only from the publishable
  // subset — private notes' aliases must never reach an adapter (single privacy
  // funnel: classify → publishable filter → buildAliasRedirects).
  const publishableIndexed = indexedNotes.filter((n) => publicSlugs.has(n.id));
  const aliasResult = buildAliasRedirects(publishableIndexed);
  for (const message of aliasResult.warnings) {
    warnings.push({ code: 'ALIAS_WARNING', message });
  }

  // Private note titles + bare filenames — surfaced for downstream audit so that
  // independent dist scanners can detect leaked private mentions without re-running
  // classification (privacy-first: classify once, consume everywhere).
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
    notes,
    publicSlugs,
    renderedHtml,
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
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function discoverNotes(
  root: string,
  vaultId: string,
  ignore: readonly string[],
): Promise<ParsedNote[]> {
  const out: ParsedNote[] = [];
  for await (const entry of walkVault({ root, ignore, extensions: ['.md'] })) {
    const content = await fs.readFile(entry.path, 'utf8');
    out.push(
      parseNote({
        path: entry.path,
        vaultId,
        relativePath: entry.relativePath,
        content,
      }),
    );
  }
  return out;
}

async function discoverAttachments(
  root: string,
  ignore: readonly string[],
  allowedExtensions: readonly string[],
): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of walkVault({
    root,
    ignore,
    extensions: allowedExtensions,
  })) {
    out.push(entry.relativePath);
  }
  return out;
}

function toIndexedNotes(
  notes: readonly ParsedNote[],
  slugByRelPath: ReadonlyMap<string, string>,
): IndexedNote[] {
  const indexed: IndexedNote[] = [];
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    const basename = path.posix.basename(n.relativePath).replace(MD_EXT_RE, '');

    const aliasSet = new Set<string>();
    const rawAliases = n.frontmatter['aliases'];
    if (Array.isArray(rawAliases)) {
      for (const a of rawAliases) {
        if (typeof a === 'string') {
          const cleaned = a.trim().toLowerCase();
          if (cleaned.length > 0) aliasSet.add(cleaned);
        }
      }
    } else if (typeof rawAliases === 'string') {
      const cleaned = rawAliases.trim().toLowerCase();
      if (cleaned.length > 0) aliasSet.add(cleaned);
    }
    // Title becomes an implicit lookup alias so Obsidian-style wikilinks written in
    // title-case (e.g. `[[Another Public]]`) resolve to kebab-case filenames
    // (`another-public.md`). Without this, title↔filename mismatches wouldn't resolve.
    const title = n.frontmatter['title'];
    if (typeof title === 'string') {
      const cleaned = title.trim().toLowerCase();
      if (cleaned.length > 0) aliasSet.add(cleaned);
    }

    indexed.push({
      id: slug,
      relativePath: n.relativePath,
      basename,
      aliases: [...aliasSet],
    });
  }
  return indexed;
}

function indexAttachmentsByBasename(
  attachments: readonly string[],
): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const rel of attachments) {
    out.set(path.posix.basename(rel).toLowerCase(), rel);
  }
  return out;
}

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

function resolveForEmbed(
  raw: string,
  index: WikilinkIndex,
  attachmentByBasenameLower: ReadonlyMap<string, string>,
): { resolved: boolean; targetId?: string; kind: 'note' | 'attachment' } {
  const parsed = parseWikilinkTarget(raw);
  const targetLower = parsed.target.toLowerCase();
  const attachmentId = attachmentByBasenameLower.get(targetLower);
  if (attachmentId !== undefined) {
    return { resolved: true, targetId: attachmentId, kind: 'attachment' };
  }
  const res = resolveWikilink(raw, index);
  if (res.resolved && res.note !== undefined) {
    return { resolved: true, targetId: res.note.id, kind: 'note' };
  }
  return { resolved: false, kind: 'note' };
}

function collectAttachmentRefs(
  body: string,
  sourceSlug: string,
  attachmentByBasenameLower: ReadonlyMap<string, string>,
): AttachmentRef[] {
  const out: AttachmentRef[] = [];
  const re = /!\[\[([^[\]]*)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const parsed = parseWikilinkTarget(m[1] ?? '');
    const id = attachmentByBasenameLower.get(parsed.target.toLowerCase());
    if (id !== undefined) {
      out.push({ id, sourceNoteId: sourceSlug });
    }
  }
  return out;
}

function collectFrontmatterAttachmentRefs(
  frontmatter: Record<string, unknown>,
  sourceSlug: string,
  attachmentIds: ReadonlySet<string>,
): AttachmentRef[] {
  const out: AttachmentRef[] = [];
  for (const key of ['cover', 'thumbnail'] as const) {
    const value = frontmatter[key];
    if (typeof value !== 'string') continue;
    const cleaned = value.trim();
    if (!cleaned.startsWith('/attachments/')) continue;
    const id = cleaned.slice('/attachments/'.length);
    if (attachmentIds.has(id)) {
      out.push({ id, sourceNoteId: sourceSlug });
    }
  }
  return out;
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
    // Attachments are not graph edges (they are file closures, not note edges).
    if (attachmentByBasenameLower.has(parsed.target.toLowerCase())) continue;
    const res = resolveWikilink(raw, index);
    if (res.resolved && res.note !== undefined) {
      out.push({ from: fromSlug, to: res.note.id, kind: 'embed' });
    }
  }
  return out;
}

/**
 * Document-order `image` node URLs in an mdast tree. Walks pre-order
 * depth-first so the candidate picker matches the order a reader sees.
 */
function findAllImageUrls(tree: Root): string[] {
  interface ImageLike {
    type: string;
    url?: string;
    children?: ImageLike[];
  }
  const out: string[] = [];
  function walk(node: ImageLike): void {
    if (node.type === 'image' && typeof node.url === 'string') {
      out.push(node.url);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }
  walk(tree as unknown as ImageLike);
  return out;
}

function isPublicImageUrl(url: string, attachmentClosure: ReadonlySet<string>): boolean {
  if (/^https?:\/\//i.test(url)) return true;
  if (url.startsWith('/attachments/')) {
    const id = url.slice('/attachments/'.length);
    return attachmentClosure.has(id);
  }
  return false;
}

function sanitizePublicImageFrontmatter(
  frontmatter: Record<string, unknown>,
  attachmentClosure: ReadonlySet<string>,
): void {
  for (const key of ['cover', 'thumbnail'] as const) {
    const value = resolvePublicImageFrontmatterValue(
      frontmatter[key],
      attachmentClosure,
    );
    if (value === undefined) {
      delete frontmatter[key];
    } else {
      frontmatter[key] = value;
    }
  }
}

function resolvePublicImageFrontmatterValue(
  value: unknown,
  attachmentClosure: ReadonlySet<string>,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (!cleaned.startsWith('/')) return undefined;
  if (!cleaned.startsWith('/attachments/')) return cleaned;
  const id = cleaned.slice('/attachments/'.length);
  return attachmentClosure.has(id) ? cleaned : undefined;
}

function cloneTree(tree: Root | undefined): Root {
  if (tree === undefined) return { type: 'root', children: [] } as unknown as Root;
  return structuredClone(tree);
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
