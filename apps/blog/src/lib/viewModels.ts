import type { CollectionEntry } from 'astro:content';
import { isPublishable } from '@noteforge/core/privacy/publishable';
import type {
  BacklinkEntry,
  BacklinksViewModel,
  NoteHeading,
  NoteViewModel,
} from '@noteforge/theme-default';

export type NotesEntry = CollectionEntry<'notes'>;

/**
 * `notes` collection narrowed to note-shaped entries (i.e. `data.kind === 'note'`).
 * Listing pages, the slug detail page, tag aggregation, etc. all operate on this
 * narrowed type — alias redirects are routed separately and never appear in any
 * listing.
 */
export type NoteEntry = NotesEntry & { data: { kind: 'note' } };

/**
 * `notes` collection narrowed to alias-redirect entries (i.e. `data.kind === 'alias-redirect'`).
 * Only the alias route consumes this; nothing else in the app should read from it.
 */
export type AliasRedirectEntry = NotesEntry & {
  data: { kind: 'alias-redirect' };
};

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

const PREVIEW_EXCERPT_MAX_CHARS = 160;
const HTML_ENTITY_TEXT: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

/**
 * Normalize a frontmatter `date`-shaped value to a `YYYY-MM-DD` string.
 *
 * gray-matter (used in `parseNote`) runs js-yaml with its default schema,
 * which interprets unquoted YAML 1.1 timestamp scalars like `date: 2026-05-01`
 * as JS `Date` objects rather than strings. The home rails, category overview
 * and tag pages all gate display on `typeof === 'string'`, so a Date object
 * silently falls through to the `——` placeholder. Centralising the coercion
 * here keeps every listing on one fallback path.
 *
 * Date objects are formatted via `toISOString().slice(0, 10)` (UTC). Dates
 * authored as bare `YYYY-MM-DD` are normalised to UTC midnight by js-yaml so
 * the slice round-trips without timezone drift; values with explicit local
 * times can shift by ±1 day, which we accept — quote the value
 * (`date: "2026-05-01T09:00:00+09:00"`) to opt out and pass it through verbatim.
 */
export function coerceDate(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    const t = value.getTime();
    if (Number.isNaN(t)) return undefined;
    return value.toISOString().slice(0, 10);
  }
  return undefined;
}

/**
 * Trailing path segment of a slug (`a/b/c` → `c`). Exported so listing
 * pages share a single fallback when a note's frontmatter `title` is
 * missing — without it, callers default to `entry.id` and surface the
 * full slug path (e.g. `ai/gen-ai/공부-일지/lora`) as user-visible text.
 */
export function slugBasename(slug: string): string {
  const i = slug.lastIndexOf('/');
  return i === -1 ? slug : slug.slice(i + 1);
}

function lastSegment(slug: string): string {
  return slugBasename(slug);
}

/**
 * Append a trailing slash to a URL string if it does not already end with one.
 *
 * Astro's `trailingSlash: 'always'` is the SSOT for route URLs (ADR-012), but
 * `Astro.url.pathname` and the values flowing into `<meta refresh url=…>` can
 * still arrive without a trailing slash. Normalising here keeps canonical /
 * og:url / alias-refresh values aligned with the routing config so search
 * engines and the Cloudflare `_headers` path-prefix matcher all see the same
 * canonical form. Skips fragment/query-only edge cases by anchoring on the
 * URL pathname rather than re-parsing.
 */
export function ensureTrailingSlash(url: string): string {
  if (url.length === 0) return '/';
  // Strip query/fragment, append slash to the path, re-attach.
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  const cutIdx =
    hashIdx === -1 ? queryIdx : queryIdx === -1 ? hashIdx : Math.min(hashIdx, queryIdx);
  const head = cutIdx === -1 ? url : url.slice(0, cutIdx);
  const tail = cutIdx === -1 ? '' : url.slice(cutIdx);
  return head.endsWith('/') ? `${head}${tail}` : `${head}/${tail}`;
}

/**
 * Content Layer entry → `<Note />` view-model.
 *
 * The privacy pipeline in `@noteforge/core/privacy` already filtered `frontmatter`
 * through the allowlist and `tags` through the blocklist. This function maps
 * those pre-filtered fields into the strict subset that `NoteViewModel`
 * exposes — anything outside the subset is simply not read, which is the
 * compile-time guard that keeps arbitrary frontmatter from leaking into HTML.
 *
 * `body` arrives separately (from `entry.rendered.html`) because the loader
 * stores rendered HTML on `entry.rendered`, not in `entry.data`.
 */
export function entryToNoteViewModel(
  entry: NoteEntry,
  body: string,
): NoteViewModel {
  const fm = entry.data.frontmatter;
  const title =
    entry.data.title ?? asString(fm['title']) ?? lastSegment(entry.id);
  const date = coerceDate(fm['date']);
  const updated = coerceDate(fm['updated']);
  const description = asString(fm['description']);
  // `heroImage` is filled upstream (loader): cover-frontmatter or the
  // pipeline's first-image, both already privacy-checked. We pass it through
  // verbatim — re-deriving here would split the hero rule across two paths.
  const heroImage = asString(
    (entry.data as { heroImage?: unknown }).heroImage,
  );
  const thumbnailImage = asString(
    (entry.data as { thumbnailImage?: unknown }).thumbnailImage,
  );
  const embeddedImagesRaw = (entry.data as { embeddedImages?: unknown })
    .embeddedImages;
  const embeddedImages =
    Array.isArray(embeddedImagesRaw) &&
    embeddedImagesRaw.every((v) => typeof v === 'string')
      ? (embeddedImagesRaw as string[])
      : undefined;
  const sourcePath = asString(
    (entry.data as { sourcePath?: unknown }).sourcePath,
  );
  // The loader emits `headings` only when the post has at least one h2-h4;
  // when the field is missing, the TOC component never renders. We don't
  // re-derive — the heading list shares its surface area with the rendered
  // body, both produced from the same post-transclude hast pass.
  const headingsRaw = (entry.data as { headings?: unknown }).headings;
  const headings: readonly NoteHeading[] | undefined = Array.isArray(headingsRaw)
    ? (headingsRaw as readonly NoteHeading[])
    : undefined;

  const vm: NoteViewModel = {
    slug: entry.id,
    title,
    tags: entry.data.tags,
    body,
  };
  if (date !== undefined) vm.date = date;
  if (updated !== undefined) vm.updated = updated;
  if (description !== undefined) vm.description = description;
  if (heroImage !== undefined) vm.heroImage = heroImage;
  if (thumbnailImage !== undefined) vm.thumbnailImage = thumbnailImage;
  if (embeddedImages !== undefined) vm.embeddedImages = embeddedImages;
  if (sourcePath !== undefined) vm.sourcePath = sourcePath;
  if (headings !== undefined && headings.length > 0) vm.headings = headings;
  return vm;
}

export function thumbnailForEntry(entry: NoteEntry): string | undefined {
  return (
    asString((entry.data as { thumbnailImage?: unknown }).thumbnailImage) ??
    asString((entry.data as { heroImage?: unknown }).heroImage)
  );
}

export function descriptionForEntry(entry: NoteEntry): string | undefined {
  const description = asString(entry.data.frontmatter['description'])?.trim();
  if (description !== undefined && description.length > 0) {
    return description;
  }

  const html = asString(
    (entry as { rendered?: { html?: unknown } }).rendered?.html,
  );
  return html === undefined ? undefined : excerptFromRenderedHtml(html);
}

export function tagsForEntry(entry: NoteEntry): string[] {
  return entry.data.tags.map((t) => t.trim()).filter((t) => t.length > 0);
}

function excerptFromRenderedHtml(html: string): string | undefined {
  const text = renderedHtmlToText(html);
  if (text.length === 0) return undefined;
  return truncatePreviewText(text);
}

function renderedHtmlToText(html: string): string {
  const text = decodeHtmlEntities(
    html
      .replace(
        /<a\b(?=[^>]*\bclass=(?:"[^"]*\bheading-anchor\b[^"]*"|'[^']*\bheading-anchor\b[^']*'))[^>]*>[\s\S]*?<\/a>/gi,
        ' ',
      )
      .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|blockquote|pre|h[1-6]|tr|section|article)>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
  return stripLeadingBodyTags(text)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingBodyTags(text: string): string {
  return text.replace(/^(?:\s*#[A-Za-z][\w/-]*)+\s*/u, '');
}

function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,
    (match, raw: string) => {
      const key = raw.toLowerCase();
      if (key.startsWith('#x')) {
        return decodeNumericEntity(match, key.slice(2), 16);
      }
      if (key.startsWith('#')) {
        return decodeNumericEntity(match, key.slice(1), 10);
      }
      return HTML_ENTITY_TEXT[key] ?? match;
    },
  );
}

function decodeNumericEntity(
  fallback: string,
  value: string,
  radix: number,
): string {
  const codePoint = Number.parseInt(value, radix);
  if (
    Number.isNaN(codePoint) ||
    codePoint < 0 ||
    codePoint > 0x10ffff
  ) {
    return fallback;
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function truncatePreviewText(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= PREVIEW_EXCERPT_MAX_CHARS) return text;
  return `${chars
    .slice(0, PREVIEW_EXCERPT_MAX_CHARS - 3)
    .join('')
    .trimEnd()}...`;
}

export function sortForHome(entries: readonly NoteEntry[]): NoteEntry[] {
  return [...entries].sort((a, b) => {
    const af = a.data.frontmatter['featured'] === true ? 1 : 0;
    const bf = b.data.frontmatter['featured'] === true ? 1 : 0;
    if (af !== bf) return bf - af;

    const ad = coerceDate(a.data.frontmatter['date']) ?? '';
    const bd = coerceDate(b.data.frontmatter['date']) ?? '';
    if (ad !== bd) return bd.localeCompare(ad);

    return a.id.localeCompare(b.id);
  });
}

/**
 * Narrows `notes` collection entries to publishable note-kind items. Alias
 * redirects are filtered out here (and *only* here) — listing pages must
 * never see alias entries. The draft check delegates to
 * `@noteforge/core/privacy/publishable` so the publishability rule lives in
 * one place; all adapters/themes/feeds must call through it (see CLAUDE.md
 * single-source-of-truth contract). The `kind` discriminator carries through
 * TypeScript so downstream callers safely access `data.frontmatter`,
 * `data.tags`, etc.
 */
export function filterPublishable(
  entries: readonly NotesEntry[],
): NoteEntry[] {
  return entries.filter(
    (e): e is NoteEntry =>
      e.data.kind === 'note' && isPublishable(e.data.frontmatter),
  );
}

/**
 * Map an alias-redirect entry to the minimal view-model the alias route needs.
 * `canonicalUrl` is built by the caller from `Astro.site` because absolute URLs
 * depend on per-environment site config that this pure helper cannot see.
 *
 * Both `to` (the relative redirect target written into `<meta refresh url=…>`)
 * and `canonicalUrl` are normalised to a trailing slash so they align with the
 * site-wide `trailingSlash: 'always'` routing contract (ADR-012). A redirect
 * landing on `/foo` would force a second 301 from Cloudflare's path-prefix
 * matcher and break the canonical-URL invariant the audit relies on.
 */
export function entryToAliasRedirectViewModel(
  entry: AliasRedirectEntry,
  canonicalUrl: string,
): { from: string; to: string; canonicalUrl: string } {
  return {
    from: entry.id,
    to: ensureTrailingSlash(`/${entry.data.to}`),
    canonicalUrl: ensureTrailingSlash(canonicalUrl),
  };
}

/**
 * Build the `<Backlinks />` view-model from a single entry's backlink slugs.
 *
 * Loader has already restricted `entry.data.backlinks` to public targets.
 * Caller passes a `slug → title` map sourced from the same collection so
 * private slugs cannot enter via this path.
 */
export function buildBacklinksViewModel(
  entry: NoteEntry,
  titleBySlug: ReadonlyMap<string, string>,
): BacklinksViewModel {
  const entries: BacklinkEntry[] = entry.data.backlinks.map((slug) => ({
    slug,
    title: titleBySlug.get(slug) ?? slug,
  }));
  return { entries };
}
