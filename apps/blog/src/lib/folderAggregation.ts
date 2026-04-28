import type { FolderNode } from '@noteforge/theme-default';
import type { NoteEntry } from './viewModels.ts';

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function lastSegment(slug: string): string {
  const i = slug.lastIndexOf('/');
  return i === -1 ? slug : slug.slice(i + 1);
}

function noteTitle(entry: NoteEntry): string {
  return (
    entry.data.title ??
    asString(entry.data.frontmatter['title']) ??
    lastSegment(entry.id)
  );
}

function compareCaseInsensitive(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  if (al !== bl) return al < bl ? -1 : 1;
  if (a !== b) return a < b ? -1 : 1;
  return 0;
}

function sortTree(node: FolderNode): void {
  node.children.sort((x, y) => compareCaseInsensitive(x.name, y.name));
  node.notes.sort((x, y) => compareCaseInsensitive(x.slug, y.slug));
  for (const child of node.children) sortTree(child);
}

/**
 * Build a folder tree from publishable note entries.
 *
 * Pure function — no Astro / FS / privacy access. The caller passes the
 * already-filtered output of `filterPublishable`; alias-redirect entries
 * that slip in are silently skipped (validation happens at the routing
 * layer in step 6, not here).
 *
 * Folder-vs-note slug collisions (a `posts` note next to a `posts/` folder)
 * are recorded as-is on both sides — throwing is the routing layer's job.
 */
export function buildFolderTree(
  entries: readonly NoteEntry[],
): FolderNode {
  const root: FolderNode = { name: '', path: '', children: [], notes: [] };

  for (const entry of entries) {
    // Defensive skip: alias-redirect entries should have been filtered by
    // `filterPublishable` upstream, but we don't trust the type assertion at
    // the caller. Validation/throw is the routing layer's job (step 6).
    const kind = (entry.data as { kind?: string }).kind;
    if (kind !== 'note') continue;
    if (entry.id.length === 0) continue;

    const segments = entry.id.split('/');
    const folderSegments = segments.slice(0, -1);

    let cursor = root;
    for (let i = 0; i < folderSegments.length; i++) {
      const segName = folderSegments[i]!;
      let child = cursor.children.find((c) => c.name === segName);
      if (child === undefined) {
        child = {
          name: segName,
          path: folderSegments.slice(0, i + 1).join('/'),
          children: [],
          notes: [],
        };
        cursor.children.push(child);
      }
      cursor = child;
    }

    cursor.notes.push({ slug: entry.id, title: noteTitle(entry) });
  }

  sortTree(root);
  return root;
}
