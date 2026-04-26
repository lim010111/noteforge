/**
 * View-model for `<NoteList />` — the shared listing primitive used by the
 * home page and TagPage.
 *
 * INTENTIONALLY a STRICT SUBSET. `entries[i].href` is rendered verbatim into
 * an `<a>` so callers MUST construct it (already public-slug-prefixed). Title
 * and date come from allowlist-respecting frontmatter. Adding fields without
 * widening the CLAUDE.md allowlist is forbidden — this type IS the contract.
 */
export interface NoteListEntry {
  /** href the link points to. Caller is responsible for the leading `/`. */
  href: string;
  /** Public display title (allowlist-respecting). */
  title: string;
  /** ISO 8601 date string (e.g. "2026-01-10"). Optional — `<time>` is omitted when absent. */
  date?: string;
}

export interface NoteListProps {
  entries: NoteListEntry[];
  /** Empty-state message. Required so callers explicitly opt into the wording shown. */
  emptyMessage: string;
}
