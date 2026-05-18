import type { Root } from 'mdast';

import {
  collectAttachmentRefs,
  type AttachmentRef,
} from '../privacy/attachmentClosure.ts';
import { filterFrontmatter } from '../privacy/frontmatterFilter.ts';
import { expandTransclusions } from '../privacy/transclude.ts';
import { parseWikilinkTarget, resolveWikilink } from '../resolve/wikilink.ts';
import type { ParsedNote } from '../types.ts';
import type { VaultIndexSnapshot } from '../vaultIndex/types.ts';

import { dropDanglingFootnoteReferences } from './footnotes.ts';
import {
  renderMdastToHtmlWithHeadings,
  type NoteHeading,
} from './htmlFromMdast.ts';

/**
 * Per-note privacy render unit. Owns: transclusion expansion → HTML serialization
 * → frontmatter allowlist filter → tag blocklist + gate-tag strip → image
 * extraction → attachment-ref collection.
 *
 * Inputs that span multiple notes (the linkRewriter pass over all public notes,
 * the cross-note attachment closure, the public graph, alias redirects) are the
 * orchestrator's responsibility. The orchestrator (`pipeline.ts`) prepares the
 * `rewrittenMdast` for every public note in one pre-pass, then calls this
 * function once per note.
 *
 * Privacy contract: this module never decides public vs. private. Callers pass
 * `publicSlugs` (precomputed by `classify`) and the function uses it to gate
 * transclusion targets only — the public/private rule itself is not re-derived.
 *
 * Closure boundary: this function is intentionally closure-naive. `firstImage`,
 * `embeddedImages`, and frontmatter `cover` / `thumbnail` are emitted as the
 * raw post-transclude tree saw them. The orchestrator computes the cross-note
 * attachment closure separately and applies it via
 * `applyAttachmentClosure(rendered, closure)` from `privacy/attachmentClosure`.
 * Keeping the closure pass out of this module makes the per-note seam single-
 * minded and prevents a new caller from believing closure-gating happened when
 * it did not.
 */

export interface RenderPublicNoteInput {
  /** The note's pre-linkRewritten mdast — `pipeline.ts` builds this in a cross-note pass. */
  readonly rewrittenMdast: Root;
  /** The note itself (body, frontmatter, relativePath). */
  readonly note: ParsedNote;
  /** The note's canonical slug. Used as the transclusion `sourceId` (cycle seed). */
  readonly slug: string;
  /** Snapshot from `buildVaultIndex`/`createIncrementalVaultIndex().snapshot()`. */
  readonly vaultIndex: VaultIndexSnapshot;
  /** Slugs classified public. Transclusion targets outside this set are dropped. */
  readonly publicSlugs: ReadonlySet<string>;
  /**
   * Lookup for transclusion target trees. Returning `undefined` for a slug is
   * treated the same as a private target (the embed is dropped). The caller's
   * cache is responsible for ensuring the returned tree has already been
   * linkRewriter'd.
   */
  readonly getRewrittenMdast: (slug: string) => Root | undefined;
  readonly frontmatterAllowlist: readonly string[];
  readonly tagBlocklist: readonly string[];
  /**
   * The publish-gate tag (and any `gateTag/...` subtag) is stripped from the
   * note's tag list — it's a structural opt-in marker, not a reader-facing
   * label. Callers derive this from the classify rule.
   */
  readonly gateTag: string;
  /** Forwarded to `expandTransclusions` for source-locus warnings. */
  readonly sourceFile?: string;
}

export interface RenderedNote {
  readonly html: string;
  readonly headings: readonly NoteHeading[];
  readonly frontmatter: Record<string, unknown>;
  readonly tags: readonly string[];
  readonly attachmentRefs: readonly AttachmentRef[];
  /** First image URL from the rendered tree (document order). `undefined` when none. */
  readonly firstImage: string | undefined;
  /** All image URLs from the rendered tree, document order. */
  readonly embeddedImages: readonly string[];
}

const ATTACHMENT_PREFIX = '/attachments/';

export function renderPublicNote(input: RenderPublicNoteInput): RenderedNote {
  const tree = input.rewrittenMdast;

  // 1. Expand transclusions in place — public targets pull in their already
  //    linkRewriter'd subtrees (cloned per call so callers' caches stay
  //    untouched), private targets and unresolved targets are removed.
  expandTransclusions({
    tree,
    sourceId: input.slug,
    sourceFile: input.sourceFile ?? input.note.relativePath,
    resolve: (raw) => resolveForEmbed(raw, input.vaultIndex),
    isPublic: (id) => input.publicSlugs.has(id),
    mdastFor: (id) => cloneTree(input.getRewrittenMdast(id)),
    attachmentUrlFor: (id) => `${ATTACHMENT_PREFIX}${id}`,
  });

  // 2. Drop footnote references orphaned by a `![[Note#Section]]` slice — the
  //    referenced definition may live outside the transcluded heading range.
  //    Runs after transclusion, before serialization, so no broken `<sup>`
  //    anchor reaches the HTML.
  dropDanglingFootnoteReferences(tree);

  // 3. Serialize → HTML + headings (h2/h3/h4) in one hast pass. Private
  //    transclusion subtrees were already removed above, so headings inside
  //    them cannot leak through this channel. `lang` drives footnote-section
  //    labels (Korean notes get Korean screen-reader text).
  const { html, headings } = renderMdastToHtmlWithHeadings(tree, {
    lang: typeof input.note.frontmatter['lang'] === 'string'
      ? input.note.frontmatter['lang']
      : undefined,
  });

  // 4. Frontmatter allowlist filter. Closure-aware sanitization is the
  //    orchestrator's job (see `applyAttachmentClosure`).
  const frontmatter = filterFrontmatter(input.note.frontmatter, input.frontmatterAllowlist);

  // 5. Tag blocklist + gate-tag strip.
  const isBlocked = matchesBlocklist(input.tagBlocklist);
  const isGate = (t: string): boolean =>
    t === input.gateTag || t.startsWith(`${input.gateTag}/`);
  const tags = input.note.tags.filter((t) => !isBlocked(t) && !isGate(t));

  // 6. Raw image extraction from the post-transclude tree. Closure-gating is
  //    applied later by the orchestrator; here we just report what the tree
  //    contains. Private-target image subtrees were already removed above.
  const embeddedImages = findAllImageUrls(tree);
  const firstImage = embeddedImages[0];

  // 7. Attachment refs from raw body + frontmatter. Both public and private
  //    notes are scanned by the orchestrator (in different loops) so the
  //    closure builder sees the full reference graph.
  const attachmentRefs = collectAttachmentRefs(input.note, input.vaultIndex, input.slug);

  return {
    html,
    headings,
    frontmatter,
    tags,
    attachmentRefs,
    firstImage,
    embeddedImages,
  };
}

function resolveForEmbed(
  raw: string,
  vaultIndex: VaultIndexSnapshot,
): { resolved: boolean; targetId?: string; kind: 'note' | 'attachment' } {
  const parsed = parseWikilinkTarget(raw);
  const targetLower = parsed.target.toLowerCase();
  const attachmentId = vaultIndex.attachmentByBasenameLower.get(targetLower);
  if (attachmentId !== undefined) {
    return { resolved: true, targetId: attachmentId, kind: 'attachment' };
  }
  const res = resolveWikilink(raw, vaultIndex.wikilinkIndex);
  if (res.resolved && res.note !== undefined) {
    return { resolved: true, targetId: res.note.id, kind: 'note' };
  }
  return { resolved: false, kind: 'note' };
}

function cloneTree(tree: Root | undefined): Root {
  if (tree === undefined) return { type: 'root', children: [] } as unknown as Root;
  return structuredClone(tree);
}

function matchesBlocklist(blocklist: readonly string[]): (tag: string) => boolean {
  if (blocklist.length === 0) return () => false;
  // Lazy: use simple equality + suffix prefix match. Picomatch usage in the
  // pipeline is preserved by the orchestrator if it wants glob support; this
  // module accepts a plain blocklist of literal tag strings to keep
  // dependencies tight. The orchestrator can still pass a precomputed list.
  const exact = new Set(blocklist);
  return (tag) => exact.has(tag);
}

interface ImageLike {
  type: string;
  url?: string;
  children?: ImageLike[];
}

function findAllImageUrls(tree: Root): string[] {
  const out: string[] = [];
  function walk(node: ImageLike): void {
    if (node.type === 'image' && typeof node.url === 'string') {
      out.push(node.url);
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }
  walk(tree as unknown as ImageLike);
  return out;
}

// Re-export for orchestrator + tests. These types are intentionally re-surfaced
// at the seam so external callers (audit CLI, future MCP) can consume them
// without reaching into `privacy/`.
export type { NoteHeading } from './htmlFromMdast.ts';
export type { AttachmentRef } from '../privacy/attachmentClosure.ts';

export const PUBLIC_ATTACHMENT_URL_PREFIX = ATTACHMENT_PREFIX;
