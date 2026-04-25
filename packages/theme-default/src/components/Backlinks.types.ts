/**
 * View-model for `<Backlinks />`.
 *
 * INTENTIONALLY a STRICT SUBSET of the data the privacy pipeline emits.
 * Only entries whose target is PUBLIC may appear here — `@obpub/core/privacy`
 * is the single decider, and the caller must build this object from
 * `PipelineResult.publicGraph` (already public-filtered) so that no private
 * note title or slug ever reaches this component.
 *
 * Caller responsibilities (the component does NOT re-derive any of these):
 *   - all `entries[i].slug` are PUBLIC slugs (verified upstream).
 *   - `title` is the PUBLIC display title (allowlist-respecting), not the
 *     raw filename or any private-side override.
 */
export interface BacklinkEntry {
  /** Public slug. The component emits a link to `/<slug>`. */
  slug: string;
  /** Public display title. The component renders this as the link text. */
  title: string;
}

export interface BacklinksViewModel {
  entries: BacklinkEntry[];
}

export interface BacklinksProps {
  backlinks: BacklinksViewModel;
}
