/**
 * Attachment closure — single owner of "which attachments are public, what
 * references built that closure, and how do those identifiers gate the output
 * of a per-note render". External code reaches the orchestrator's
 * `PipelineResult` through `pipeline.ts`; nothing else should reach across the
 * privacy package to recompute these decisions.
 *
 * Three responsibilities live here:
 *   1. `collectAttachmentRefs(note, vaultIndex)` — per-note pre-closure scan.
 *      Body `![[name.ext]]` embeds and frontmatter `cover`/`thumbnail` of the
 *      form `/attachments/<id>` are resolved against the vault's attachment
 *      basename map. Both public and private notes feed the same scanner so
 *      that the closure builder sees the full reference graph.
 *   2. `buildAttachmentClosure({...})` — pure decision function: an attachment
 *      id is `included` iff at least one PUBLIC note references it AND its
 *      extension is on the caller-supplied allowlist. Disallowed extensions
 *      always win over `no-public-referrer` (the extension rule is the blanket
 *      safety gate for binary executables / scripts).
 *   3. `applyAttachmentClosure(rendered, closure)` — post-closure gate over a
 *      `RenderedNote` produced by `renderPublicNote`. Frontmatter image fields
 *      and body image URLs that point at `/attachments/<id>` are kept only
 *      when `id` is in the closure; absolute http(s) URLs pass through; theme
 *      assets outside `/attachments/` pass through. The function returns a new
 *      `RenderedNote` — the input is not mutated, so callers can keep raw
 *      results alongside gated ones if they need to.
 *
 * `renderPublicNote` knows nothing about the closure: it always emits the raw
 * per-note view, and the pipeline calls `applyAttachmentClosure` once it has
 * computed the cross-note closure. The closure-aware path used to live in two
 * places (inside `renderPublicNote`'s optional `attachmentClosure` mode and
 * inside the pipeline's closure post-pass with copy-pasted helpers). Now it
 * lives only here, so a new caller (audit CLI, future MCP server, alternate
 * SSG adapter) cannot accidentally skip one of the two passes.
 *
 * Pure calculation — no filesystem I/O. Actual file-copy decisions live in the
 * build stage (astro-integration / CLI), which consumes `included` verbatim.
 *
 * Output ordering:
 *   - `buildAttachmentClosure().included` is a Set (unordered).
 *   - `buildAttachmentClosure().excluded` is sorted lexicographically by id for
 *     stable snapshots and audits.
 *   - `collectAttachmentRefs` returns body refs (document order) followed by
 *     frontmatter refs (`cover`, `thumbnail` order) — deterministic across runs.
 */

import * as path from 'node:path';

import { parseWikilinkTarget } from '../resolve/wikilink.ts';
import type { RenderedNote } from '../render/renderPublicNote.ts';
import type { ParsedNote } from '../types.ts';
import type { VaultIndexSnapshot } from '../vaultIndex/types.ts';

import { resolvePublicImageFrontmatter } from './imageFrontmatterResolver.ts';

export interface AttachmentRef {
  readonly id: string;
  readonly sourceNoteId: string;
}

export interface BuildAttachmentClosureOptions {
  readonly publicNoteIds: ReadonlySet<string>;
  readonly allReferences: readonly AttachmentRef[];
  readonly allowedExtensions: readonly string[];
}

export interface AttachmentClosure {
  readonly included: ReadonlySet<string>;
  readonly excluded: readonly ExcludedAttachment[];
}

export type ExcludeReason = 'no-public-referrer' | 'disallowed-extension';

export interface ExcludedAttachment {
  readonly id: string;
  readonly reason: ExcludeReason;
}

const ATTACHMENT_PREFIX = '/attachments/';
const EMBED_RE = /!\[\[([^[\]]*)\]\]/g;
const HTTP_URL_RE = /^https?:\/\//i;
const FRONTMATTER_IMAGE_FIELDS = ['cover', 'thumbnail'] as const;

export function buildAttachmentClosure(
  options: BuildAttachmentClosureOptions,
): AttachmentClosure {
  const { publicNoteIds, allReferences, allowedExtensions } = options;

  const allowed = new Set<string>();
  for (const ext of allowedExtensions) allowed.add(ext.toLowerCase());

  const seen = new Set<string>();
  const hasPublicReferrer = new Map<string, boolean>();

  for (const ref of allReferences) {
    seen.add(ref.id);
    const prev = hasPublicReferrer.get(ref.id) ?? false;
    hasPublicReferrer.set(ref.id, prev || publicNoteIds.has(ref.sourceNoteId));
  }

  const included = new Set<string>();
  const excluded: ExcludedAttachment[] = [];

  for (const id of seen) {
    const ext = path.posix.extname(id).toLowerCase();
    const extensionOk = ext.length > 0 && allowed.has(ext);
    if (!extensionOk) {
      excluded.push({ id, reason: 'disallowed-extension' });
      continue;
    }
    if (!(hasPublicReferrer.get(id) ?? false)) {
      excluded.push({ id, reason: 'no-public-referrer' });
      continue;
    }
    included.add(id);
  }

  excluded.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { included, excluded };
}

/**
 * Scan a note (public or private) for attachment references. Body `![[name]]`
 * embeds are resolved through `attachmentByBasenameLower`; frontmatter `cover`
 * and `thumbnail` of the form `/attachments/<id>` are accepted when `<id>` is
 * in `attachments`. The slug stored on each ref is the caller-supplied
 * `sourceNoteId` — the pipeline owns the `slugByRelPath` map, so we don't
 * re-derive it here.
 *
 * Frontmatter `attachments` lookup is built once per call (Set over
 * `vaultIndex.attachments`). The vault's full attachment array is small enough
 * (low thousands at worst), so the per-note cost is negligible compared to
 * mdast parsing upstream.
 *
 * Convenience overload: when `sourceNoteId` is omitted, `note.relativePath`
 * is used. Production callers (pipeline, renderPublicNote) always pass the
 * slug explicitly so that the resulting refs match the closure builder's
 * publicNoteIds set.
 */
export function collectAttachmentRefs(
  note: ParsedNote,
  vaultIndex: Pick<
    VaultIndexSnapshot,
    'attachments' | 'attachmentByBasenameLower'
  >,
  sourceNoteId?: string,
): readonly AttachmentRef[] {
  const slug = sourceNoteId ?? deriveSlugFromRelativePath(note.relativePath);
  const out: AttachmentRef[] = [];

  let m: RegExpExecArray | null;
  EMBED_RE.lastIndex = 0;
  while ((m = EMBED_RE.exec(note.body)) !== null) {
    const parsed = parseWikilinkTarget(m[1] ?? '');
    const id = vaultIndex.attachmentByBasenameLower.get(parsed.target.toLowerCase());
    if (id !== undefined) {
      out.push({ id, sourceNoteId: slug });
    }
  }

  const knownIds = new Set(vaultIndex.attachments);
  for (const key of FRONTMATTER_IMAGE_FIELDS) {
    const value = note.frontmatter[key];
    if (typeof value !== 'string') continue;
    const cleaned = value.trim();
    if (!cleaned.startsWith(ATTACHMENT_PREFIX)) continue;
    const id = cleaned.slice(ATTACHMENT_PREFIX.length);
    if (knownIds.has(id)) {
      out.push({ id, sourceNoteId: slug });
    }
  }

  return out;
}

function deriveSlugFromRelativePath(relativePath: string): string {
  return relativePath.replace(/\.(md|markdown)$/i, '');
}

/**
 * Apply a precomputed attachment closure to a raw `RenderedNote`:
 *   - body `embeddedImages` URLs pointing at `/attachments/<id>` are kept only
 *     when `id ∈ closure`; absolute `http(s)://…` URLs always pass; URLs
 *     outside `/attachments/` (theme assets) always pass.
 *   - `firstImage` is recomputed as the first surviving URL — when none
 *     survive, it becomes `undefined`.
 *   - frontmatter `cover` and `thumbnail` are sanitized via
 *     `resolvePublicImageFrontmatter`, the single decision point for
 *     frontmatter image surfaces.
 *
 * Returns a new `RenderedNote` — the input frontmatter object is not mutated.
 */
export function applyAttachmentClosure(
  rendered: RenderedNote,
  closure: ReadonlySet<string>,
): RenderedNote {
  const frontmatter: Record<string, unknown> = { ...rendered.frontmatter };
  for (const key of FRONTMATTER_IMAGE_FIELDS) {
    const resolved = resolvePublicImageFrontmatter(frontmatter[key], closure);
    if (resolved === undefined) {
      delete frontmatter[key];
    } else {
      frontmatter[key] = resolved;
    }
  }

  const gatedImages = rendered.embeddedImages.filter((url) =>
    isPublicImageUrl(url, closure),
  );

  return {
    ...rendered,
    frontmatter,
    embeddedImages: gatedImages,
    firstImage: gatedImages[0],
  };
}

function isPublicImageUrl(url: string, closure: ReadonlySet<string>): boolean {
  if (HTTP_URL_RE.test(url)) return true;
  if (url.startsWith(ATTACHMENT_PREFIX)) {
    return closure.has(url.slice(ATTACHMENT_PREFIX.length));
  }
  return false;
}
