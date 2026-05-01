import type {
  FolderIndexViewModel,
  FolderNode,
} from '@noteforge/theme-default';
// Deep-import the slot helper so value-level resolution does not pull in the
// barrel's `.astro` re-exports (Vitest's default project lacks the Astro Vite
// plugin needed to parse `.astro`). Type-only imports from the barrel above
// are erased at compile time and remain safe.
import {
  CATEGORY_ACCENT_SLOT_COUNT,
  pickCategoryAccentSlot,
} from '@noteforge/theme-default/lib/categoryAccent.ts';
import {
  coerceDate,
  descriptionForEntry,
  tagsForEntry,
  thumbnailForEntry,
  type NoteEntry,
} from './viewModels.ts';

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

    const thumbnail = thumbnailForEntry(entry);
    const description = descriptionForEntry(entry);
    const tags = tagsForEntry(entry);
    const date = coerceDate(entry.data.frontmatter['date']);
    cursor.notes.push({
      slug: entry.id,
      title: noteTitle(entry),
      ...(description !== undefined ? { description } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(date !== undefined ? { date } : {}),
      ...(thumbnail !== undefined ? { thumbnail } : {}),
    });
  }

  sortTree(root);
  return root;
}

function countNotesRecursive(node: FolderNode): number {
  let n = node.notes.length;
  for (const child of node.children) n += countNotesRecursive(child);
  return n;
}

function findFolderByPath(
  root: FolderNode,
  path: string,
): FolderNode | null {
  if (path === '') return root;
  const segments = path.split('/');
  let cursor: FolderNode = root;
  for (const seg of segments) {
    const next = cursor.children.find((c) => c.name === seg);
    if (next === undefined) return null;
    cursor = next;
  }
  return cursor;
}

/**
 * Walk a folder tree and yield every non-root folder node. Used by the
 * routing layer to materialise one folder-index route per folder.
 */
export function* walkFolders(root: FolderNode): Generator<FolderNode> {
  for (const child of root.children) {
    yield child;
    yield* walkFolders(child);
  }
}

/**
 * Build a `<FolderIndex />` view-model for a single folder path.
 *
 * Pure function — no privacy/Astro access. Caller passes the already-built
 * tree and the folder path to render. Empty children/notes are reflected in
 * the empty arrays; the component decides empty-state copy.
 *
 * `categorySlot` is computed for the *first* path segment (depth 0) using the
 * same FNV-1a slot mapping as `FolderTree`. Returns `null` if the folder is
 * not found in the tree (caller should treat this as a programmer error —
 * the routing layer only emits routes for folders that exist in the tree).
 */
export function buildFolderIndexViewModel(
  root: FolderNode,
  folderPath: string,
): FolderIndexViewModel | null {
  const node = findFolderByPath(root, folderPath);
  if (node === null) return null;

  const segments = folderPath.length === 0 ? [] : folderPath.split('/');
  const breadcrumb: FolderIndexViewModel['breadcrumb'] = [
    { label: 'home', href: '/' },
  ];
  for (let i = 0; i < segments.length; i++) {
    const subPath = segments.slice(0, i + 1).join('/');
    breadcrumb.push({ label: segments[i]!, href: `/${subPath}/` });
  }

  const childFolders = node.children.map((child) => ({
    name: child.name,
    href: `/${child.path}/`,
    noteCount: countNotesRecursive(child),
  }));
  const childNotes = node.notes.map((n) => ({
    title: n.title,
    href: `/${n.slug}/`,
    ...(n.description !== undefined ? { description: n.description } : {}),
    ...(n.tags !== undefined ? { tags: n.tags } : {}),
    ...(n.date !== undefined ? { date: n.date } : {}),
    ...(n.thumbnail !== undefined ? { thumbnail: n.thumbnail } : {}),
  }));

  const vm: FolderIndexViewModel = {
    folderName: node.name,
    folderPath: node.path,
    breadcrumb,
    childFolders,
    childNotes,
  };

  const firstSegment = segments[0];
  if (firstSegment !== undefined) {
    const slot = pickCategoryAccentSlot(firstSegment, CATEGORY_ACCENT_SLOT_COUNT);
    if (slot !== null) {
      vm.categorySlot = slot as 1 | 2 | 3 | 4 | 5;
    }
  }

  return vm;
}
