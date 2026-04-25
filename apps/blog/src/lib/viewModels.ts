import type { CollectionEntry } from 'astro:content';
import type {
  BacklinkEntry,
  BacklinksViewModel,
  NoteViewModel,
} from '@obpub/theme-default';

export type NotesEntry = CollectionEntry<'notes'>;

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
 * The privacy pipeline in `@obpub/core/privacy` already filtered `frontmatter`
 * through the allowlist and `tags` through the blocklist. This function maps
 * those pre-filtered fields into the strict subset that `NoteViewModel`
 * exposes — anything outside the subset is simply not read, which is the
 * compile-time guard that keeps arbitrary frontmatter from leaking into HTML.
 *
 * `body` arrives separately (from `entry.rendered.html`) because the loader
 * stores rendered HTML on `entry.rendered`, not in `entry.data`.
 */
export function entryToNoteViewModel(
  entry: NotesEntry,
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

export function sortForHome(entries: readonly NotesEntry[]): NotesEntry[] {
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

export function filterPublishable(
  entries: readonly NotesEntry[],
): NotesEntry[] {
  return entries.filter((e) => e.data.frontmatter['draft'] !== true);
}

/**
 * Build the `<Backlinks />` view-model from a single entry's backlink slugs.
 *
 * Loader has already restricted `entry.data.backlinks` to public targets.
 * Caller passes a `slug → title` map sourced from the same collection so
 * private slugs cannot enter via this path.
 */
export function buildBacklinksViewModel(
  entry: NotesEntry,
  titleBySlug: ReadonlyMap<string, string>,
): BacklinksViewModel {
  const entries: BacklinkEntry[] = entry.data.backlinks.map((slug) => ({
    slug,
    title: titleBySlug.get(slug) ?? slug,
  }));
  return { entries };
}
