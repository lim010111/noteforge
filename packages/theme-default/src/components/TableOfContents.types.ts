/**
 * Props for `<TableOfContents />`.
 *
 * `headings` is the structured h2/h3/h4 list emitted by `@noteforge/core`'s
 * `noteHeadings` channel — derived from the post-transclude, post-privacy-
 * filter mdast tree at the same hast pass that produces rendered HTML. It is
 * not frontmatter; it does not need an allowlist entry.
 */
import type { NoteHeading } from '@noteforge/core/pipeline';

export interface TableOfContentsProps {
  /** Headings collected by core. Pass through verbatim — do not re-derive. */
  headings: readonly NoteHeading[];
  /**
   * Card label rendered above the list. Defaults to `"목차"` to match the
   * site's Korean-leaning supporting UI ("본문으로 건너뛰기" skip-link, etc.).
   */
  title?: string;
  /**
   * Maximum heading depth to render. h4 is collected by core but defaults off
   * here because the visual hierarchy stays cleaner at two levels — pass `4`
   * to surface deep structure on long posts.
   */
  maxDepth?: 2 | 3 | 4;
}
