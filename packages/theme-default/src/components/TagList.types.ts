/**
 * View-model for `<TagList />` (used on the tag index page `/tags`).
 *
 * INTENTIONALLY a STRICT SUBSET. Each `TagSummary.tag` is already
 * blocklist-filtered by `@obpub/core/privacy` (see
 * `PipelineResult.publicTags`). The component MUST NOT re-filter, normalize,
 * or look anything else up.
 *
 * `count` is the number of PUBLIC notes carrying this tag. Counts derived
 * from private notes would leak the size of the private corpus.
 */
export interface TagSummary {
  /** Tag slug as it appears on note pages (e.g. "rust", "한국어"). */
  tag: string;
  /** Number of public notes carrying this tag. Must be ≥ 1 (no zero-count entries). */
  count: number;
}

export interface TagListViewModel {
  tags: TagSummary[];
}

export interface TagListProps {
  taglist: TagListViewModel;
}
