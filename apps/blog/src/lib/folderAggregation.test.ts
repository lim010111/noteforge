import { describe, expect, it } from 'vitest';
import {
  buildFolderIndexViewModel,
  buildFolderTree,
  walkFolders,
} from './folderAggregation.ts';
import type { NoteEntry } from './viewModels.ts';

interface NoteEntryDataInput {
  title?: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
  backlinks?: string[];
}

function makeEntry(id: string, data: NoteEntryDataInput = {}): NoteEntry {
  return {
    id,
    collection: 'notes',
    data: {
      kind: 'note',
      frontmatter: data.frontmatter ?? {},
      tags: data.tags ?? [],
      backlinks: data.backlinks ?? [],
      ...(data.title !== undefined ? { title: data.title } : {}),
    },
    rendered: { html: '', metadata: {} },
  } as unknown as NoteEntry;
}

function makeAlias(id: string, to: string): NoteEntry {
  return {
    id,
    collection: 'notes',
    data: { kind: 'alias-redirect', to },
    rendered: { html: '', metadata: {} },
  } as unknown as NoteEntry;
}

describe('buildFolderTree — empty input', () => {
  it('returns an empty root', () => {
    expect(buildFolderTree([])).toEqual({
      name: '',
      path: '',
      children: [],
      notes: [],
    });
  });
});

describe('buildFolderTree — root-level notes', () => {
  it('places single root note in root.notes with no children', () => {
    const tree = buildFolderTree([
      makeEntry('about', { title: 'About' }),
    ]);
    expect(tree.children).toEqual([]);
    expect(tree.notes).toEqual([{ slug: 'about', title: 'About' }]);
    expect(tree.name).toBe('');
    expect(tree.path).toBe('');
  });
});

describe('buildFolderTree — single-level folder', () => {
  it('groups two notes under the same first-level folder', () => {
    const tree = buildFolderTree([
      makeEntry('posts/foo', { title: 'Foo' }),
      makeEntry('posts/bar', { title: 'Bar' }),
    ]);
    expect(tree.children).toHaveLength(1);
    const posts = tree.children[0]!;
    expect(posts.name).toBe('posts');
    expect(posts.path).toBe('posts');
    expect(posts.children).toEqual([]);
    expect(posts.notes.map((n) => n.slug)).toEqual(['posts/bar', 'posts/foo']);
  });
});

describe('buildFolderTree — depth ≥ 3', () => {
  it('builds AI/Claude/agents nesting', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/agents', { title: 'agents' }),
    ]);
    expect(tree.children).toHaveLength(1);
    const ai = tree.children[0]!;
    expect(ai.name).toBe('AI');
    expect(ai.path).toBe('AI');
    expect(ai.notes).toEqual([]);
    expect(ai.children).toHaveLength(1);

    const claude = ai.children[0]!;
    expect(claude.name).toBe('Claude');
    expect(claude.path).toBe('AI/Claude');
    expect(claude.children).toEqual([]);
    expect(claude.notes).toEqual([
      { slug: 'AI/Claude/agents', title: 'agents' },
    ]);
  });

  it('handles 6-level nesting without throwing', () => {
    const tree = buildFolderTree([
      makeEntry('a/b/c/d/e/f', { title: 'f' }),
    ]);
    let cursor = tree;
    for (const seg of ['a', 'b', 'c', 'd', 'e']) {
      expect(cursor.children).toHaveLength(1);
      cursor = cursor.children[0]!;
      expect(cursor.name).toBe(seg);
    }
    expect(cursor.notes).toEqual([{ slug: 'a/b/c/d/e/f', title: 'f' }]);
  });
});

describe('buildFolderTree — sort stability', () => {
  it('produces the same tree regardless of input order', () => {
    const a = makeEntry('posts/Z', { title: 'Z' });
    const b = makeEntry('posts/a', { title: 'a' });
    const c = makeEntry('posts/m', { title: 'm' });

    const t1 = buildFolderTree([a, b, c]);
    const t2 = buildFolderTree([c, a, b]);
    const t3 = buildFolderTree([b, c, a]);
    expect(t1).toEqual(t2);
    expect(t2).toEqual(t3);
  });

  it('sorts notes case-insensitively (a, m, Z)', () => {
    const tree = buildFolderTree([
      makeEntry('posts/Z', { title: 'Z' }),
      makeEntry('posts/a', { title: 'a' }),
      makeEntry('posts/m', { title: 'm' }),
    ]);
    expect(tree.children[0]!.notes.map((n) => n.slug)).toEqual([
      'posts/a',
      'posts/m',
      'posts/Z',
    ]);
  });

  it('treats Posts/ and posts/ as different folders (case-sensitive segment id)', () => {
    const tree = buildFolderTree([
      makeEntry('Posts/a', { title: 'a' }),
      makeEntry('posts/b', { title: 'b' }),
    ]);
    const names = tree.children.map((c) => c.name);
    expect(names).toContain('Posts');
    expect(names).toContain('posts');
    expect(tree.children).toHaveLength(2);
  });

  it('sorts folders case-insensitively at each level', () => {
    const tree = buildFolderTree([
      makeEntry('Zeta/x', { title: 'x' }),
      makeEntry('alpha/x', { title: 'x' }),
      makeEntry('Mango/x', { title: 'x' }),
    ]);
    expect(tree.children.map((c) => c.name)).toEqual([
      'alpha',
      'Mango',
      'Zeta',
    ]);
  });
});

describe('buildFolderTree — does not filter', () => {
  it('keeps draft notes if caller passes them in (no filtering responsibility)', () => {
    // The contract: this function receives `filterPublishable` output.
    // If the caller violates that and passes a draft, the function must
    // include it (filtering is not its job).
    const tree = buildFolderTree([
      makeEntry('posts/draft', {
        title: 'draft',
        frontmatter: { draft: true },
      }),
    ]);
    expect(tree.children[0]!.notes.map((n) => n.slug)).toEqual([
      'posts/draft',
    ]);
  });
});

describe('buildFolderTree — alias-redirect entries', () => {
  it('silently skips alias-redirect entries without throwing', () => {
    const tree = buildFolderTree([
      makeAlias('legacy/old-slug', 'posts/new-slug'),
      makeEntry('posts/new-slug', { title: 'new' }),
    ]);
    // legacy/old-slug must not appear anywhere in the tree
    const allSlugs: string[] = [];
    function walk(n: { children: typeof tree.children; notes: typeof tree.notes }): void {
      for (const note of n.notes) allSlugs.push(note.slug);
      for (const child of n.children) walk(child);
    }
    walk(tree);
    expect(allSlugs).toEqual(['posts/new-slug']);
    // The alias's parent folder ('legacy') must not appear either,
    // since the only file inside it was the alias.
    expect(tree.children.map((c) => c.name)).not.toContain('legacy');
  });
});

describe('buildFolderTree — folder-vs-note slug collision', () => {
  it('records both a `posts` note and a `posts/` folder when both exist', () => {
    const tree = buildFolderTree([
      makeEntry('posts', { title: 'Posts index (note)' }),
      makeEntry('posts/foo', { title: 'foo' }),
    ]);
    // 'posts' as a note lives in root.notes
    expect(tree.notes.map((n) => n.slug)).toEqual(['posts']);
    // 'posts/' as a folder lives in root.children
    expect(tree.children).toHaveLength(1);
    const postsFolder = tree.children[0]!;
    expect(postsFolder.name).toBe('posts');
    expect(postsFolder.path).toBe('posts');
    expect(postsFolder.notes.map((n) => n.slug)).toEqual(['posts/foo']);
  });
});

describe('buildFolderTree — title fallback', () => {
  it('falls back to the slug when no title is provided', () => {
    const tree = buildFolderTree([
      makeEntry('posts/no-title', { frontmatter: {} }),
    ]);
    const note = tree.children[0]!.notes[0]!;
    // The contract leaves title fallback up to the implementation,
    // but at minimum it must be a non-empty string and stable.
    expect(typeof note.title).toBe('string');
    expect(note.title.length).toBeGreaterThan(0);
  });
});

describe('walkFolders', () => {
  it('yields every non-root folder, depth-first', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/agents', { title: 'agents' }),
      makeEntry('AI/Gemini/notes', { title: 'notes' }),
      makeEntry('DB/postgres', { title: 'pg' }),
    ]);
    const paths = [...walkFolders(tree)].map((n) => n.path);
    expect(paths).toEqual([
      'AI',
      'AI/Claude',
      'AI/Gemini',
      'DB',
    ]);
  });

  it('yields nothing for an empty tree', () => {
    expect([...walkFolders(buildFolderTree([]))]).toEqual([]);
  });
});

describe('buildFolderIndexViewModel', () => {
  it('returns null for paths that do not exist in the tree', () => {
    const tree = buildFolderTree([makeEntry('posts/foo', { title: 'foo' })]);
    expect(buildFolderIndexViewModel(tree, 'missing')).toBeNull();
  });

  it('builds breadcrumb root → leaf with trailing-slash hrefs', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/opus', { title: 'opus' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'AI/Claude');
    expect(vm).not.toBeNull();
    expect(vm!.folderName).toBe('Claude');
    expect(vm!.folderPath).toBe('AI/Claude');
    expect(vm!.breadcrumb).toEqual([
      { label: 'home', href: '/' },
      { label: 'AI', href: '/AI/' },
      { label: 'Claude', href: '/AI/Claude/' },
    ]);
  });

  it('aggregates child folder note counts recursively', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/a', { title: 'a' }),
      makeEntry('AI/Claude/b', { title: 'b' }),
      makeEntry('AI/Gemini/x', { title: 'x' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'AI');
    expect(vm).not.toBeNull();
    expect(vm!.childFolders).toEqual([
      { name: 'Claude', href: '/AI/Claude/', noteCount: 2 },
      { name: 'Gemini', href: '/AI/Gemini/', noteCount: 1 },
    ]);
    expect(vm!.childNotes).toEqual([]);
  });

  it('emits child note hrefs with trailing slash', () => {
    const tree = buildFolderTree([
      makeEntry('posts/foo', { title: 'Foo' }),
      makeEntry('posts/bar', { title: 'Bar' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'posts');
    expect(vm!.childNotes).toEqual([
      { title: 'Bar', href: '/posts/bar/' },
      { title: 'Foo', href: '/posts/foo/' },
    ]);
  });

  it('assigns categorySlot to depth-0 folder via the FNV-1a slot mapper', () => {
    const tree = buildFolderTree([
      makeEntry('AI/Claude/x', { title: 'x' }),
    ]);
    const aiVm = buildFolderIndexViewModel(tree, 'AI');
    expect(aiVm!.categorySlot).toBeDefined();
    expect([1, 2, 3, 4, 5]).toContain(aiVm!.categorySlot);
    // Deep folder still mirrors the depth-0 slot (first segment).
    const deepVm = buildFolderIndexViewModel(tree, 'AI/Claude');
    expect(deepVm!.categorySlot).toBe(aiVm!.categorySlot);
  });

  it('renders an empty viewmodel for a folder containing nothing visible', () => {
    // We can't directly construct a public-but-empty folder via the public API;
    // but a folder with only sub-folders is the same shape and is the more
    // realistic path. childNotes empty + childFolders non-empty is the
    // observable expectation here.
    const tree = buildFolderTree([
      makeEntry('AI/Claude/x', { title: 'x' }),
    ]);
    const vm = buildFolderIndexViewModel(tree, 'AI');
    expect(vm!.childNotes).toEqual([]);
    expect(vm!.childFolders.length).toBeGreaterThan(0);
  });
});
