import type { CollectionEntry } from 'astro:content';
import { isPublishable } from '@noteforge/core/privacy/publishable';
import type {
  BacklinkEntry,
  BacklinksViewModel,
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

function lastSegment(slug: string): string {
  const i = slug.lastIndexOf('/');
  return i === -1 ? slug : slug.slice(i + 1);
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
  const date = asString(fm['date']);
  const updated = asString(fm['updated']);
  const description = asString(fm['description']);

  const vm: NoteViewModel = {
    title,
    tags: entry.data.tags,
    body,
  };
  if (date !== undefined) vm.date = date;
  if (updated !== undefined) vm.updated = updated;
  if (description !== undefined) vm.description = description;
  return vm;
}

export function sortForHome(entries: readonly NoteEntry[]): NoteEntry[] {
  return [...entries].sort((a, b) => {
    const af = a.data.frontmatter['featured'] === true ? 1 : 0;
    const bf = b.data.frontmatter['featured'] === true ? 1 : 0;
    if (af !== bf) return bf - af;

    const ad = asString(a.data.frontmatter['date']) ?? '';
    const bd = asString(b.data.frontmatter['date']) ?? '';
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
 */
export function entryToAliasRedirectViewModel(
  entry: AliasRedirectEntry,
  canonicalUrl: string,
): { from: string; to: string; canonicalUrl: string } {
  return {
    from: entry.id,
    to: `/${entry.data.to}`,
    canonicalUrl,
  };
}

/**
 * Derive a short, plain-text excerpt from rendered note HTML.
 *
 * Used by the homepage card list when no `frontmatter.description` is set.
 * Pure string transform — no DOM, no jsdom — so it runs in any test/build
 * environment.
 *
 * Pipeline:
 *   1. Drop everything inside `<script>`/`<style>` blocks (defense-in-depth;
 *      the privacy pipeline already strips these from public HTML, but
 *      excerpting plain content shouldn't depend on that having happened).
 *   2. Replace block-level closing tags with whitespace so paragraph breaks
 *      don't fuse words together when tags are stripped.
 *   3. Strip remaining tags and decode the small set of named entities Astro
 *      emits (&amp; &lt; &gt; &quot; &#39;).
 *   4. Collapse whitespace and clip to a soft 160-char budget at a word
 *      boundary, appending an ellipsis if truncated.
 *
 * Returns '' when there is no text to extract — callers can branch on
 * empty-string to omit the excerpt row entirely (no empty <p> markup).
 */
export function deriveExcerpt(html: string, maxChars = 160): string {
  if (typeof html !== 'string' || html.length === 0) return '';

  const noScripts = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  const blockSeparated = noScripts.replace(
    /<\/(p|div|li|h[1-6]|blockquote|br|tr|td|th|pre|figure|figcaption|section|article)\s*>/gi,
    ' ',
  );
  const tagless = blockSeparated.replace(/<[^>]+>/g, '');
  const decoded = tagless
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const collapsed = decoded.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return '';
  if (collapsed.length <= maxChars) return collapsed;

  const slice = collapsed.slice(0, maxChars);
  const lastBoundary = slice.lastIndexOf(' ');
  const cut = lastBoundary > maxChars * 0.5 ? slice.slice(0, lastBoundary) : slice;
  return `${cut.trimEnd()}…`;
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
