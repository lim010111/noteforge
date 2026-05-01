import { describe, expect, it } from 'vitest';
import {
  buildBacklinksViewModel,
  ensureTrailingSlash,
  entryToAliasRedirectViewModel,
  entryToNoteViewModel,
  filterPublishable,
  sortForHome,
  type AliasRedirectEntry,
  type NoteEntry,
  type NotesEntry,
} from '../src/lib/viewModels.ts';

interface NoteEntryDataInput {
  title?: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
  backlinks?: string[];
}

function makeEntry(
  id: string,
  data: NoteEntryDataInput,
  rendered = '',
): NoteEntry {
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
    rendered: { html: rendered, metadata: {} },
  } as unknown as NoteEntry;
}

function makeAliasEntry(from: string, to: string): AliasRedirectEntry {
  return {
    id: from,
    collection: 'notes',
    data: { kind: 'alias-redirect', to },
  } as unknown as AliasRedirectEntry;
}

describe('entryToNoteViewModel', () => {
  it('uses entry.data.title when present', () => {
    const entry = makeEntry('posts/hello', {
      title: 'Hello, World',
      frontmatter: { title: 'Hello, World' },
      tags: ['public'],
    });
    const vm = entryToNoteViewModel(entry, '<p>hi</p>');
    expect(vm.title).toBe('Hello, World');
    expect(vm.body).toBe('<p>hi</p>');
    expect(vm.tags).toEqual(['public']);
  });

  it('falls back to slug last segment when title is missing', () => {
    const entry = makeEntry('notes/2026/about-me', { frontmatter: {} });
    const vm = entryToNoteViewModel(entry, '');
    expect(vm.title).toBe('about-me');
  });

  it('does not leak frontmatter keys outside the NoteViewModel subset', () => {
    const entry = makeEntry('p/leak', {
      title: 'Title',
      frontmatter: {
        title: 'Title',
        date: '2026-04-25',
        // Allowlisted by core but NOT part of NoteViewModel — must not leak.
        cover: 'cover.png',
        author: 'someone',
        permalink: '/custom',
        // A core-allowlisted but theme-irrelevant field.
        public: true,
        // Extra fields a hostile/old vault might smuggle through if upstream
        // ever regresses — must also not appear in the view-model.
        secret: 'DO_NOT_LEAK',
      },
    });
    const vm = entryToNoteViewModel(entry, '');
    const allowedKeys = new Set([
      'slug',
      'title',
      'date',
      'updated',
      'tags',
      'description',
      'body',
    ]);
    for (const k of Object.keys(vm)) {
      expect(allowedKeys.has(k)).toBe(true);
    }
    expect(JSON.stringify(vm)).not.toContain('DO_NOT_LEAK');
    expect(JSON.stringify(vm)).not.toContain('cover.png');
    expect(JSON.stringify(vm)).not.toContain('someone');
    expect(vm.date).toBe('2026-04-25');
  });

  it('omits date/updated/description when frontmatter values are not strings', () => {
    const entry = makeEntry('p/x', {
      title: 'X',
      frontmatter: { title: 'X', date: 123, updated: null, description: [] },
    });
    const vm = entryToNoteViewModel(entry, '');
    expect(vm.date).toBeUndefined();
    expect(vm.updated).toBeUndefined();
    expect(vm.description).toBeUndefined();
  });
});

describe('sortForHome', () => {
  it('places featured entries first', () => {
    const a = makeEntry('a', { frontmatter: { date: '2026-01-01' } });
    const b = makeEntry('b', {
      frontmatter: { date: '2025-01-01', featured: true },
    });
    const c = makeEntry('c', { frontmatter: { date: '2026-04-01' } });
    const sorted = sortForHome([a, b, c]).map((e) => e.id);
    expect(sorted[0]).toBe('b');
  });

  it('breaks date ties by slug ASC', () => {
    const x = makeEntry('zeta', { frontmatter: { date: '2026-04-25' } });
    const y = makeEntry('alpha', { frontmatter: { date: '2026-04-25' } });
    const z = makeEntry('mu', { frontmatter: { date: '2026-04-25' } });
    const sorted = sortForHome([x, y, z]).map((e) => e.id);
    expect(sorted).toEqual(['alpha', 'mu', 'zeta']);
  });

  it('orders by date DESC for non-featured entries', () => {
    const old = makeEntry('old', { frontmatter: { date: '2024-01-01' } });
    const mid = makeEntry('mid', { frontmatter: { date: '2025-06-01' } });
    const recent = makeEntry('recent', { frontmatter: { date: '2026-04-25' } });
    const sorted = sortForHome([old, mid, recent]).map((e) => e.id);
    expect(sorted).toEqual(['recent', 'mid', 'old']);
  });
});

describe('filterPublishable', () => {
  it('removes entries with frontmatter.draft === true', () => {
    const a = makeEntry('a', { frontmatter: { draft: true } });
    const b = makeEntry('b', { frontmatter: {} });
    const c = makeEntry('c', { frontmatter: { draft: false } });
    expect(filterPublishable([a, b, c]).map((e) => e.id)).toEqual(['b', 'c']);
  });

  it('drops alias-redirect entries so listings never see them', () => {
    const note = makeEntry('a', { frontmatter: {} });
    const alias = makeAliasEntry('legacy-name', 'a');
    const mixed: NotesEntry[] = [note, alias];
    const result = filterPublishable(mixed);
    expect(result.map((e) => e.id)).toEqual(['a']);
    // After filterPublishable the discriminator narrows to 'note' — the next
    // line is a compile-time guarantee disguised as a runtime check.
    for (const e of result) expect(e.data.kind).toBe('note');
  });
});

describe('entryToAliasRedirectViewModel', () => {
  it('returns from/to/canonicalUrl with leading + trailing slash on `to`', () => {
    const entry = makeAliasEntry('legacy-name', 'projects/foo');
    const vm = entryToAliasRedirectViewModel(
      entry,
      'https://example.com/projects/foo',
    );
    expect(vm).toEqual({
      from: 'legacy-name',
      to: '/projects/foo/',
      canonicalUrl: 'https://example.com/projects/foo/',
    });
  });

  it('does not double-slash a `to` value that already trails with /', () => {
    const entry = makeAliasEntry('legacy', 'projects/foo/');
    const vm = entryToAliasRedirectViewModel(entry, 'https://x.com/projects/foo/');
    expect(vm.to).toBe('/projects/foo/');
    expect(vm.canonicalUrl).toBe('https://x.com/projects/foo/');
  });
});

describe('ensureTrailingSlash', () => {
  it('appends a trailing slash to URLs without one', () => {
    expect(ensureTrailingSlash('https://x.com/foo')).toBe('https://x.com/foo/');
    expect(ensureTrailingSlash('/foo')).toBe('/foo/');
  });

  it('leaves URLs that already trail with / untouched', () => {
    expect(ensureTrailingSlash('https://x.com/foo/')).toBe('https://x.com/foo/');
    expect(ensureTrailingSlash('/foo/')).toBe('/foo/');
  });

  it('preserves query and fragment by inserting / before them', () => {
    expect(ensureTrailingSlash('/foo?x=1')).toBe('/foo/?x=1');
    expect(ensureTrailingSlash('/foo#hash')).toBe('/foo/#hash');
    expect(ensureTrailingSlash('/foo/?x=1')).toBe('/foo/?x=1');
  });

  it('returns / for the empty input', () => {
    expect(ensureTrailingSlash('')).toBe('/');
  });
});

describe('buildBacklinksViewModel', () => {
  it('maps backlink slugs to {slug, title} entries via the title map', () => {
    const titleBySlug = new Map<string, string>([
      ['posts/foo', 'Foo Post'],
      ['posts/bar', 'Bar Post'],
    ]);
    const entry = makeEntry('posts/main', {
      backlinks: ['posts/foo', 'posts/bar', 'posts/missing'],
    });
    const vm = buildBacklinksViewModel(entry, titleBySlug);
    expect(vm.entries).toEqual([
      { slug: 'posts/foo', title: 'Foo Post' },
      { slug: 'posts/bar', title: 'Bar Post' },
      { slug: 'posts/missing', title: 'posts/missing' },
    ]);
  });
});
