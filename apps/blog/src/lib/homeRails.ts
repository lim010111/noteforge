import type { NoteEntry } from './viewModels.ts';

/**
 * Caps for the home rails. Named constants (not magic numbers) so fork users
 * can tune them in one place and the test suite can guard against regressions.
 */
export const RECENT_RAIL_CAP = 10;
export const FEATURED_RAIL_CAP = 6;

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Recent rail selection — pure function over publishable notes.
 *
 * Sort order:
 *   1. Entries with a `date` string come first, sorted DESC by `date`.
 *   2. Entries with no `date` come last, sorted ASC by `id` for stability.
 * Then truncate to {@link RECENT_RAIL_CAP}.
 *
 * Privacy contract: callers MUST pass the result of `filterPublishable` —
 * this helper does not consult `isPublic` itself (single-source-of-truth in
 * `@noteforge/core/privacy`).
 */
export function selectRecent(entries: readonly NoteEntry[]): NoteEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const ad = asString(a.data.frontmatter['date']);
    const bd = asString(b.data.frontmatter['date']);
    if (ad !== undefined && bd !== undefined) {
      if (ad !== bd) return bd.localeCompare(ad);
      return a.id.localeCompare(b.id);
    }
    if (ad !== undefined) return -1;
    if (bd !== undefined) return 1;
    return a.id.localeCompare(b.id);
  });
  return sorted.slice(0, RECENT_RAIL_CAP);
}

/**
 * Featured rail selection — pure function over publishable notes.
 *
 * Filters to entries whose frontmatter has `featured: true` (boolean only —
 * truthy strings or 1 are intentionally rejected so the gate is unambiguous).
 * Sorts the survivors DESC by `date`; ties broken ASC by `id`. Then truncates
 * to {@link FEATURED_RAIL_CAP}. Returns `[]` when no entries qualify so the
 * caller can omit the section entirely (privacy: never render an empty
 * "Featured" heading).
 */
export function selectFeatured(entries: readonly NoteEntry[]): NoteEntry[] {
  const featured = entries.filter(
    (e) => e.data.frontmatter['featured'] === true,
  );
  const sorted = featured.sort((a, b) => {
    const ad = asString(a.data.frontmatter['date']) ?? '';
    const bd = asString(b.data.frontmatter['date']) ?? '';
    if (ad !== bd) return bd.localeCompare(ad);
    return a.id.localeCompare(b.id);
  });
  return sorted.slice(0, FEATURED_RAIL_CAP);
}
