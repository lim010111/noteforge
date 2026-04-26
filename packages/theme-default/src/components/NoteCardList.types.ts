/**
 * View-model for `<NoteCardList />` — the homepage's recent-posts surface.
 *
 * INTENTIONALLY a strict subset, mirroring the allowlist discipline of
 * NoteListEntry. Six fields max — title, date, excerpt, tags, featured plus
 * the href the caller built. Adding more is forbidden without first
 * justifying the privacy/allowlist implications.
 */
export interface NoteCardEntry {
  /** Caller-built href (already public-slug-prefixed). Rendered verbatim into <a>. */
  href: string;
  /** Public display title (allowlist-respecting). */
  title: string;
  /** ISO 8601 date string. Optional — `<time>` row omitted when absent. */
  date?: string;
  /** Plain-text excerpt. Optional — excerpt row omitted when absent or empty. */
  excerpt?: string;
  /** Already-blocklist-filtered tags. Render as small chips. */
  tags: readonly string[];
  /** Show a "featured" ribbon on the card. */
  featured?: boolean;
}

export interface NoteCardListProps {
  entries: readonly NoteCardEntry[];
  /** Empty-state message. Required so callers explicitly opt into the wording. */
  emptyMessage: string;
}
