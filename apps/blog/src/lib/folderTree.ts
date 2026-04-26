/**
 * Folder-tree derivation for the sidebar.
 *
 * Source of truth: each `NoteEntry`'s `id` (slug) carries POSIX-nested folder
 * structure (e.g. `daily-notes/welcome`). We rebuild a tree purely from those
 * already-public slugs — no second privacy decision, no new loader/core fields.
 *
 * Key invariants:
 *   - Input must already be `filterPublishable(...)`-narrowed. The tree mirrors
 *     `publicSlugs` exactly, so empty-on-disk folders cannot leak ("this folder
 *     exists" would itself disclose private structure).
 *   - Sort is deterministic at every level so SSR'd `<details open>` decisions
 *     and snapshot tests are stable across builds.
 *   - `relativePath` from core is intentionally NOT consulted — it can diverge
 *     from the slug when `frontmatter.slug`/`permalink` is set, and the sidebar
 *     groups by URL, not by disk path.
 */

import type { SidebarNode } from '@noteforge/theme-default';
import type { NoteEntry } from './viewModels.ts';

export interface FolderNode {
  readonly kind: 'folder';
  readonly path: string;
  readonly label: string;
  readonly children: readonly FolderTreeNode[];
  readonly noteCount: number;
}

export interface LeafNode {
  readonly kind: 'leaf';
  readonly slug: string;
  readonly label: string;
  readonly date?: string;
}

export type FolderTreeNode = FolderNode | LeafNode;

export interface FolderTree {
  readonly roots: readonly FolderTreeNode[];
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function lastSegment(slug: string): string {
  const i = slug.lastIndexOf('/');
  return i === -1 ? slug : slug.slice(i + 1);
}

function titleCaseSegment(segment: string): string {
  return segment
    .split('-')
    .filter((s) => s.length > 0)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

interface MutableFolder {
  readonly kind: 'folder';
  readonly path: string;
  readonly children: Map<string, MutableFolder | LeafNode>;
}

function getOrCreateFolder(
  parent: Map<string, MutableFolder | LeafNode>,
  segment: string,
  parentPath: string,
): MutableFolder {
  const existing = parent.get(segment);
  if (existing !== undefined && existing.kind === 'folder') return existing;
  const path = parentPath.length === 0 ? segment : `${parentPath}/${segment}`;
  const folder: MutableFolder = {
    kind: 'folder',
    path,
    children: new Map<string, MutableFolder | LeafNode>(),
  };
  parent.set(segment, folder);
  return folder;
}

function entryToLeaf(entry: NoteEntry): LeafNode {
  const fm = entry.data.frontmatter;
  const title =
    entry.data.title ?? asString(fm['title']) ?? lastSegment(entry.id);
  const date = asString(fm['date']);
  const leaf: LeafNode = { kind: 'leaf', slug: entry.id, label: title };
  if (date !== undefined) {
    return { ...leaf, date };
  }
  return leaf;
}

function compareLeaves(a: LeafNode, b: LeafNode): number {
  const ad = a.date ?? '';
  const bd = b.date ?? '';
  if (ad !== bd) {
    if (ad === '') return 1;
    if (bd === '') return -1;
    return bd.localeCompare(ad);
  }
  return a.slug.localeCompare(b.slug);
}

function compareFolders(a: FolderNode, b: FolderNode): number {
  const labelDelta = a.label.localeCompare(b.label, 'ko');
  if (labelDelta !== 0) return labelDelta;
  return a.path.localeCompare(b.path);
}

function freezeAndSort(
  map: Map<string, MutableFolder | LeafNode>,
): readonly FolderTreeNode[] {
  const folders: FolderNode[] = [];
  const leaves: LeafNode[] = [];
  for (const node of map.values()) {
    if (node.kind === 'folder') {
      const children = freezeAndSort(node.children);
      let noteCount = 0;
      for (const c of children) {
        noteCount += c.kind === 'leaf' ? 1 : c.noteCount;
      }
      folders.push({
        kind: 'folder',
        path: node.path,
        label: titleCaseSegment(lastSegment(node.path)),
        children,
        noteCount,
      });
    } else {
      leaves.push(node);
    }
  }
  folders.sort(compareFolders);
  leaves.sort(compareLeaves);
  return [...folders, ...leaves];
}

/**
 * Build a sorted, deterministic folder tree from public note entries.
 *
 * The caller MUST pass entries that have already been filtered through
 * `filterPublishable` from `viewModels.ts`. This function does not re-decide
 * publishability — passing a private entry would silently leak it into the
 * sidebar.
 */
export function buildFolderTree(entries: readonly NoteEntry[]): FolderTree {
  const root = new Map<string, MutableFolder | LeafNode>();

  for (const entry of entries) {
    const slug = entry.id;
    const parts = slug.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) continue;

    let cursor = root;
    let cursorPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i]!;
      const folder = getOrCreateFolder(cursor, segment, cursorPath);
      cursor = folder.children;
      cursorPath = folder.path;
    }

    const leafSegment = parts[parts.length - 1]!;
    cursor.set(leafSegment, entryToLeaf(entry));
  }

  return { roots: freezeAndSort(root) };
}

/**
 * Returns the path-prefix sequence from root to (excluding) the leaf for a
 * given slug. The sidebar uses this SSR-side to mark which `<details>` should
 * render with `open` so the active note's ancestor folders are pre-expanded.
 *
 *   'a/b/c/note'  -> ['a', 'a/b', 'a/b/c']
 *   'top-only'    -> []
 *   ''            -> []
 */
export function ancestorFolderPaths(slug: string): readonly string[] {
  const parts = slug.split('/').filter((p) => p.length > 0);
  if (parts.length <= 1) return [];
  const out: string[] = [];
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc = acc.length === 0 ? parts[i]! : `${acc}/${parts[i]!}`;
    out.push(acc);
  }
  return out;
}

/**
 * Project an internal `FolderTreeNode[]` (which carries `date` for sorting) into
 * the theme's `SidebarNode[]` view-model (allowlist-narrowed: no date). This is
 * the function pages should call when feeding `BaseLayout.sidebarRoots`.
 *
 * Why a separate mapper: keeping `date` off the rendered view-model is one
 * fewer field that could slip into HTML by accident, and the sidebar's visual
 * grammar deliberately does not show dates (see sidebar.css). The internal
 * node type still carries date so `buildFolderTree` can sort leaves chronologically.
 */
function toSidebarNodes(
  nodes: readonly FolderTreeNode[],
): readonly SidebarNode[] {
  return nodes.map((n) =>
    n.kind === 'folder'
      ? {
          kind: 'folder',
          path: n.path,
          label: n.label,
          noteCount: n.noteCount,
          children: toSidebarNodes(n.children),
        }
      : { kind: 'leaf', slug: n.slug, label: n.label },
  );
}

/**
 * Cache built trees by entries-array identity. In static build each page calls
 * `getCollection('notes')` separately, so this is a no-op across pages — but
 * within a single page render (where the same array may be threaded through
 * sidebar derivation + other logic) it avoids redundant work, and in dev/HMR
 * the same module-scoped reference may be reused across re-renders.
 */
const treeCache = new WeakMap<readonly NoteEntry[], FolderTree>();
const sidebarCache = new WeakMap<readonly NoteEntry[], readonly SidebarNode[]>();

export function getSharedFolderTree(
  entries: readonly NoteEntry[],
): FolderTree {
  const hit = treeCache.get(entries);
  if (hit !== undefined) return hit;
  const built = buildFolderTree(entries);
  treeCache.set(entries, built);
  return built;
}

/**
 * Page-facing entry point: returns the SSR-ready sidebar view-model.
 * Already pruned, sorted, allowlist-narrowed.
 */
export function getSharedSidebarRoots(
  entries: readonly NoteEntry[],
): readonly SidebarNode[] {
  const hit = sidebarCache.get(entries);
  if (hit !== undefined) return hit;
  const tree = getSharedFolderTree(entries);
  const projected = toSidebarNodes(tree.roots);
  sidebarCache.set(entries, projected);
  return projected;
}
