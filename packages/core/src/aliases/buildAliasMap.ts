import type { IndexedNote } from '../resolve/wikilink.ts';
import { slugifySegment } from '../slug.ts';

export interface AliasRedirect {
  /** Slugified alias path (URL segments joined with `/`, no leading slash). */
  readonly from: string;
  /** Canonical slug of the destination note (no leading slash). */
  readonly to: string;
  /** Destination note's IndexedNote.id, retained for diagnostics. */
  readonly noteId: string;
}

export interface AliasMapResult {
  readonly redirects: readonly AliasRedirect[];
  readonly warnings: readonly string[];
}

/**
 * Build alias→canonical redirects for the publishable note set.
 *
 * Caller is responsible for filtering `publishable` to public notes only — this
 * function does not re-derive privacy. `IndexedNote.id` is treated as the canonical
 * slug (matches the contract used by the core pipeline when constructing the index).
 */
export function buildAliasRedirects(
  publishable: readonly IndexedNote[],
): AliasMapResult {
  const slugSet = new Set<string>();
  for (const note of publishable) slugSet.add(note.id);

  const redirectByFrom = new Map<string, AliasRedirect>();
  const warnings: string[] = [];

  for (const note of publishable) {
    for (const rawAlias of note.aliases) {
      const from = normalizeAliasPath(rawAlias);
      if (from.length === 0) {
        warnings.push(`empty alias on note '${note.id}' skipped`);
        continue;
      }

      if (from === note.id) continue;

      if (slugSet.has(from)) {
        warnings.push(
          `alias '${from}' on note '${note.id}' collides with slug of note '${from}'`,
        );
        continue;
      }

      const existing = redirectByFrom.get(from);
      if (existing !== undefined) {
        warnings.push(
          `alias '${from}' duplicated; first declared by '${existing.noteId}', ignored on '${note.id}'`,
        );
        continue;
      }

      redirectByFrom.set(from, { from, to: note.id, noteId: note.id });
    }
  }

  const redirects = [...redirectByFrom.values()].sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : 0,
  );

  return { redirects, warnings };
}

function normalizeAliasPath(raw: string): string {
  return raw
    .split('/')
    .map(slugifySegment)
    .filter((segment) => segment.length > 0)
    .join('/');
}
