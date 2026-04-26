/**
 * Unit tests for the folder-tree derivation that backs the sidebar.
 *
 * The sidebar's privacy story rests on this helper: it must not invent folders
 * the input did not justify, must prune empty branches, and must produce a
 * deterministic order so SSR'd `<details open>` decisions are stable.
 */

import { describe, expect, it } from 'vitest';
import {
  ancestorFolderPaths,
  buildFolderChips,
  buildFolderTree,
  getSharedFolderTree,
  getSharedSidebarRoots,
  type FolderNode,
  type LeafNode,
} from '../src/lib/folderTree.ts';
import type { NoteEntry } from '../src/lib/viewModels.ts';

interface MakeEntryInput {
  title?: string;
  frontmatter?: Record<string, unknown>;
}

function makeEntry(id: string, input: MakeEntryInput = {}): NoteEntry {
  return {
    id,
    collection: 'notes',
    data: {
      kind: 'note',
      frontmatter: input.frontmatter ?? {},
      tags: [],
      backlinks: [],
      ...(input.title !== undefined ? { title: input.title } : {}),
    },
    rendered: { html: '', metadata: {} },
  } as unknown as NoteEntry;
}

function asFolder(node: { kind: string }): FolderNode {
  if (node.kind !== 'folder') throw new Error(`expected folder, got ${node.kind}`);
  return node as FolderNode;
}

function asLeaf(node: { kind: string }): LeafNode {
  if (node.kind !== 'leaf') throw new Error(`expected leaf, got ${node.kind}`);
  return node as LeafNode;
}

describe('buildFolderTree', () => {
  it('returns no roots for empty input', () => {
    const tree = buildFolderTree([]);
    expect(tree.roots).toEqual([]);
  });

  it('places a top-level note as a leaf at root (no synthetic folder)', () => {
    const tree = buildFolderTree([
      makeEntry('hello', { title: 'Hello' }),
    ]);
    expect(tree.roots).toHaveLength(1);
    const leaf = asLeaf(tree.roots[0]!);
    expect(leaf.slug).toBe('hello');
    expect(leaf.label).toBe('Hello');
  });

  it('groups two notes under the same folder with transitive count', () => {
    const tree = buildFolderTree([
      makeEntry('daily-notes/welcome', { title: 'Welcome' }),
      makeEntry('daily-notes/diary', { title: 'My Diary' }),
    ]);
    expect(tree.roots).toHaveLength(1);
    const folder = asFolder(tree.roots[0]!);
    expect(folder.path).toBe('daily-notes');
    expect(folder.label).toBe('Daily Notes');
    expect(folder.noteCount).toBe(2);
    expect(folder.children).toHaveLength(2);
    for (const c of folder.children) {
      expect(c.kind).toBe('leaf');
    }
  });

  it('builds nested folders and counts leaves transitively', () => {
    const tree = buildFolderTree([
      makeEntry('a/b/c/note', { title: 'Deep' }),
      makeEntry('a/b/other', { title: 'Other' }),
      makeEntry('a/peer', { title: 'Peer' }),
    ]);
    expect(tree.roots).toHaveLength(1);
    const a = asFolder(tree.roots[0]!);
    expect(a.path).toBe('a');
    expect(a.noteCount).toBe(3);
    // a's children: folder b first, then leaf peer
    expect(a.children).toHaveLength(2);
    const ab = asFolder(a.children[0]!);
    expect(ab.path).toBe('a/b');
    expect(ab.noteCount).toBe(2);
    const abc = asFolder(ab.children[0]!);
    expect(abc.path).toBe('a/b/c');
    expect(abc.noteCount).toBe(1);
    expect(asLeaf(abc.children[0]!).slug).toBe('a/b/c/note');
    expect(asLeaf(ab.children[1]!).slug).toBe('a/b/other');
    expect(asLeaf(a.children[1]!).slug).toBe('a/peer');
  });

  it('prunes folders whose only contributors are private (i.e. not in input)', () => {
    // 'agentic-engineering' folder on disk is empty (no public notes); the
    // caller filters by isPublishable so it never enters this function.
    const tree = buildFolderTree([
      makeEntry('ai-news/transformer', { title: 'T' }),
      makeEntry('daily-notes/diary', { title: 'D' }),
    ]);
    const paths = tree.roots.map((r) =>
      r.kind === 'folder' ? r.path : r.slug,
    );
    expect(paths).not.toContain('agentic-engineering');
    expect(paths).toEqual(['ai-news', 'daily-notes']);
  });

  it('orders folders before leaves at every level', () => {
    const tree = buildFolderTree([
      makeEntry('zzz-top', { title: 'Top Note' }),
      makeEntry('aardvark/inside', { title: 'Inside' }),
    ]);
    expect(tree.roots).toHaveLength(2);
    expect(tree.roots[0]!.kind).toBe('folder');
    expect(tree.roots[1]!.kind).toBe('leaf');
  });

  it('sorts folders by Korean-aware label, leaves by date DESC then slug ASC', () => {
    const tree = buildFolderTree([
      makeEntry('가-folder/inner', { title: 'in가' }),
      makeEntry('나-folder/inner', { title: 'in나' }),
      makeEntry('top-2024', {
        title: 'old',
        frontmatter: { date: '2024-01-01' },
      }),
      makeEntry('top-2026', {
        title: 'new',
        frontmatter: { date: '2026-04-01' },
      }),
      makeEntry('top-undated', { title: 'no-date' }),
    ]);
    const labels = tree.roots.map((r) =>
      r.kind === 'folder' ? r.label : r.slug,
    );
    // Folders first (by ko collation), then leaves (date DESC, missing date last)
    expect(labels).toEqual([
      '가 Folder',
      '나 Folder',
      'top-2026',
      'top-2024',
      'top-undated',
    ]);
  });

  it('uses entry.data.title for leaf label and falls back to last segment', () => {
    const tree = buildFolderTree([
      makeEntry('folder/with-title', { title: '제목' }),
      makeEntry('folder/no-title'),
    ]);
    const folder = asFolder(tree.roots[0]!);
    const labels = folder.children.map((c) =>
      c.kind === 'leaf' ? c.label : c.path,
    );
    expect(labels).toContain('제목');
    expect(labels).toContain('no-title');
  });

  it('preserves date on leaves so callers can render meta if they want', () => {
    const tree = buildFolderTree([
      makeEntry('a', {
        title: 'A',
        frontmatter: { date: '2026-01-10' },
      }),
    ]);
    const leaf = asLeaf(tree.roots[0]!);
    expect(leaf.date).toBe('2026-01-10');
  });

  it('does not pull from frontmatter beyond title/date (allowlist discipline)', () => {
    const tree = buildFolderTree([
      makeEntry('a', {
        frontmatter: {
          title: 'From FM',
          date: '2026-01-10',
          description: 'Desc',
          body: 'DO_NOT_LEAK_BANANA_6f3c1',
        },
      }),
    ]);
    const leaf = asLeaf(tree.roots[0]!);
    // entry.data.title was undefined, so it falls back to fm.title (allowlisted)
    expect(leaf.label).toBe('From FM');
    expect(leaf.date).toBe('2026-01-10');
    // No leaked field reaches the leaf shape
    const json = JSON.stringify(leaf);
    expect(json).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(json).not.toContain('Desc');
  });
});

describe('ancestorFolderPaths', () => {
  it('returns the chain of prefix paths excluding the leaf', () => {
    expect(ancestorFolderPaths('a/b/c/note')).toEqual(['a', 'a/b', 'a/b/c']);
  });

  it('returns [] for a top-level slug', () => {
    expect(ancestorFolderPaths('top')).toEqual([]);
  });

  it('returns [] for empty', () => {
    expect(ancestorFolderPaths('')).toEqual([]);
  });

  it('returns only the parent for a one-deep slug', () => {
    expect(ancestorFolderPaths('daily-notes/welcome')).toEqual(['daily-notes']);
  });
});

describe('getSharedFolderTree', () => {
  it('returns identical structure across calls for the same array reference', () => {
    const entries: NoteEntry[] = [
      makeEntry('a/x', { title: 'X' }),
      makeEntry('b/y', { title: 'Y' }),
    ];
    const first = getSharedFolderTree(entries);
    const second = getSharedFolderTree(entries);
    expect(second).toBe(first);
  });

  it('rebuilds when a new array is passed', () => {
    const a: NoteEntry[] = [makeEntry('a', { title: 'A' })];
    const b: NoteEntry[] = [makeEntry('b', { title: 'B' })];
    const first = getSharedFolderTree(a);
    const second = getSharedFolderTree(b);
    expect(second).not.toBe(first);
  });
});

describe('buildFolderChips', () => {
  it('returns top-level folders only (skips top-level leaves)', () => {
    const chips = buildFolderChips([
      makeEntry('top-level-note', { title: 'Top' }),
      makeEntry('a/inner', { title: 'Inner' }),
      makeEntry('b/x', { title: 'X' }),
    ]);
    expect(chips.map((c) => c.path)).toEqual(['a', 'b']);
  });

  it('href points at the first deterministic leaf inside the folder', () => {
    const chips = buildFolderChips([
      makeEntry('a/sub/deep', { title: 'D' }),
      makeEntry('a/peer', { title: 'P' }),
    ]);
    expect(chips).toHaveLength(1);
    // Sort: folders before leaves; "a/sub" (folder) comes before "a/peer" (leaf),
    // and inside "a/sub" the only leaf is "a/sub/deep" → that's the href.
    expect(chips[0]!.href).toBe('/a/sub/deep');
  });

  it('exposes transitive noteCount on each chip', () => {
    const chips = buildFolderChips([
      makeEntry('a/x', { title: 'X' }),
      makeEntry('a/y', { title: 'Y' }),
      makeEntry('a/sub/z', { title: 'Z' }),
    ]);
    expect(chips[0]!.noteCount).toBe(3);
  });
});

describe('getSharedSidebarRoots', () => {
  it('returns SidebarNode shape (no date on leaves)', () => {
    const roots = getSharedSidebarRoots([
      makeEntry('a/x', {
        title: 'X',
        frontmatter: { date: '2026-01-10' },
      }),
    ]);
    expect(roots).toHaveLength(1);
    const folder = roots[0]!;
    expect(folder.kind).toBe('folder');
    if (folder.kind !== 'folder') return;
    const child = folder.children[0]!;
    expect(child.kind).toBe('leaf');
    if (child.kind !== 'leaf') return;
    expect(child.slug).toBe('a/x');
    expect(child.label).toBe('X');
    // crucially: no `date` on the projected sidebar leaf
    expect((child as unknown as Record<string, unknown>).date).toBeUndefined();
  });

  it('caches by array reference', () => {
    const entries: NoteEntry[] = [makeEntry('a', { title: 'A' })];
    expect(getSharedSidebarRoots(entries)).toBe(getSharedSidebarRoots(entries));
  });
});
