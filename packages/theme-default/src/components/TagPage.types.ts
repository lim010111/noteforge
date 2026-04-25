/**
 * View-model for `<TagPage />` (used on `/tags/<tag>`).
 *
 * INTENTIONALLY a STRICT SUBSET. `entries[i].slug` is a PUBLIC slug
 * (verified upstream via `PipelineResult.publicSlugs`); `title`/`date` come
 * from allowlist-filtered frontmatter. Adding fields without first widening
 * the allowlist in CLAUDE.md is forbidden — this type IS the contract.
 */
export interface TagPageEntry {
  /** Public slug. The component emits a link to `/<slug>`. */
  slug: string;
  /** Public display title (allowlist-respecting). */
  title: string;
  /** ISO 8601 date string (e.g. "2026-01-10"). */
  date?: string;
}

export interface TagPageViewModel {
  /** The tag this page is for. Already blocklist-filtered upstream. */
  tag: string;
  /** Public notes carrying this tag, in caller-defined order (typically date desc). */
  entries: TagPageEntry[];
}

export interface TagPageProps {
  tagpage: TagPageViewModel;
}
