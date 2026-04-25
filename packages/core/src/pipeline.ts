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
import { toHast } from 'mdast-util-to-hast';
import { toHtml } from 'hast-util-to-html';
import type { Root } from 'mdast';

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
  /** Allowlist-filtered frontmatter per public slug. */
  publicFrontmatter: Map<string, Record<string, unknown>>;
  /** Blocklist-filtered tag list per public slug. */
  publicTags: Map<string, string[]>;
  /** Public subgraph — both nodes and edge endpoints are guaranteed public. */
  publicGraph: PublicGraph;
  /** Vault-relative paths of attachments included in the public closure. */
  attachmentClosure: Set<string>;
  /**
   * Title-shaped strings of every private note (frontmatter `title` and the bare
   * filename, both included). Audit consumers scan rendered HTML for these to detect
   * leaked private-note mentions.
   */
  privateNoteTitles: Set<string>;
  /** Vault-relative paths of all discovered attachments (public + private). */
  allAttachments: Set<string>;
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

  const wikilinkIndex = buildIndex(notes, slugByRelPath);
  const attachmentByBasenameLower = indexAttachmentsByBasename(attachments);

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
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined) continue;
    notesBySlug.set(slug, n);
    if (publicSlugs.has(slug)) {
      rewrittenMdastBySlug.set(slug, fromMarkdown(n.body) as unknown as Root);
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
  }

  // Also collect attachment refs from private notes so the closure correctly excludes
  // attachments referenced ONLY by private notes.
  for (const n of notes) {
    const slug = slugByRelPath.get(n.relativePath);
    if (slug === undefined || publicSlugs.has(slug)) continue;
    for (const ref of collectAttachmentRefs(n.body, slug, attachmentByBasenameLower)) {
      attachmentRefs.push(ref);
    }
  }

  // Serialize public mdasts to HTML.
  const renderedHtml = new Map<string, string>();
  for (const slug of publicSlugs) {
    const tree = rewrittenMdastBySlug.get(slug);
    if (tree === undefined) continue;
    const hast = toHast(tree, { allowDangerousHtml: false });
    if (hast === null || hast === undefined) {
      renderedHtml.set(slug, '');
      continue;
    }
    renderedHtml.set(slug, toHtml(hast));
  }

  // Frontmatter allowlist + tag blocklist per public note.
  const publicFrontmatter = new Map<string, Record<string, unknown>>();
  const publicTags = new Map<string, string[]>();
  const isBlockedTag =
    config.publishing.tagBlocklist.length > 0
      ? picomatch(config.publishing.tagBlocklist as string[])
      : (): boolean => false;

  for (const slug of publicSlugs) {
    const note = notesBySlug.get(slug);
    if (note === undefined) continue;
    publicFrontmatter.set(
      slug,
      filterFrontmatter(note.frontmatter, config.publishing.frontmatterAllowlist),
    );
    publicTags.set(
      slug,
      note.tags.filter((t) => !isBlockedTag(t)),
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
    privateNoteTitles,
    allAttachments: new Set(attachments),
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

function buildIndex(
  notes: readonly ParsedNote[],
  slugByRelPath: ReadonlyMap<string, string>,
): WikilinkIndex {
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
  return buildWikilinkIndex(indexed);
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
