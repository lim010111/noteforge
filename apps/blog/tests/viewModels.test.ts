import { describe, expect, it } from 'vitest';
import {
  buildBacklinksViewModel,
  deriveExcerpt,
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
  it('returns from/to/canonicalUrl with leading slash on `to`', () => {
    const entry = makeAliasEntry('legacy-name', 'projects/foo');
    const vm = entryToAliasRedirectViewModel(
      entry,
      'https://example.com/projects/foo',
    );
    expect(vm).toEqual({
      from: 'legacy-name',
      to: '/projects/foo',
      canonicalUrl: 'https://example.com/projects/foo',
    });
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

describe('deriveExcerpt', () => {
  it('returns "" for empty / non-string input', () => {
    expect(deriveExcerpt('')).toBe('');
    expect(deriveExcerpt(undefined as unknown as string)).toBe('');
  });

  it('strips HTML tags and returns plain text', () => {
    expect(deriveExcerpt('<p>Hello <em>world</em>.</p>')).toBe('Hello world.');
  });

  it('inserts whitespace between block elements so words do not fuse', () => {
    expect(deriveExcerpt('<h2>Title</h2><p>Body.</p>')).toBe('Title Body.');
  });

  it('treats <br> (a void element with no closing tag) as a block separator', () => {
    // The previous closing-tag regex listed `br`, which was a no-op since
    // browsers/parsers never emit `</br>`. This test pins the void-element
    // handling so the regression cannot quietly come back.
    expect(deriveExcerpt('<p>Line one<br>Line two</p>')).toBe('Line one Line two');
    expect(deriveExcerpt('<p>Line one<br />Line two</p>')).toBe('Line one Line two');
    expect(deriveExcerpt('<p>Line one<br/>Line two</p>')).toBe('Line one Line two');
  });

  it('decodes the small set of named entities Astro emits', () => {
    expect(deriveExcerpt('<p>A &amp; B &lt;3 &quot;hi&quot; &#39;ok&#39;</p>')).toBe(
      'A & B <3 "hi" \'ok\'',
    );
  });

  it('drops <script> and <style> contents entirely', () => {
    const html = '<style>.x{color:red}</style><p>Text</p><script>evil()</script>';
    const out = deriveExcerpt(html);
    expect(out).toBe('Text');
    expect(out).not.toContain('color');
    expect(out).not.toContain('evil');
  });

  it('truncates at a word boundary with an ellipsis when over the budget', () => {
    const long = 'word '.repeat(50).trim(); // 5 chars * 50 = 250 with spaces
    const out = deriveExcerpt(`<p>${long}</p>`, 60);
    expect(out.length).toBeLessThanOrEqual(60 + 1); // +1 for the …
    expect(out.endsWith('…')).toBe(true);
    // No trailing partial word before the ellipsis
    expect(out).not.toMatch(/\swor…$/);
  });

  it('does not append ellipsis when content fits within the budget', () => {
    expect(deriveExcerpt('<p>Short note.</p>', 80)).toBe('Short note.');
  });

  it('only takes content from the first block visually (collapsed whitespace)', () => {
    const html =
      '<p>First paragraph.</p><p>Second paragraph that follows.</p>';
    const out = deriveExcerpt(html);
    expect(out.startsWith('First paragraph.')).toBe(true);
    // The two paragraphs are joined by a single space (block-separator rule),
    // so we DO see Second… within the budget. That is intended for short
    // posts; the budget cap is the only truncation strategy.
    expect(out).toContain('Second paragraph');
  });

  it('handles content with collapsed whitespace and trims edges', () => {
    expect(deriveExcerpt('   <p>   spaced   text   </p>   ')).toBe('spaced text');
  });

  it('falls back to a hard-cut when no word boundary exists in the prefix', () => {
    // A single 200-char word with no spaces
    const word = 'a'.repeat(200);
    const out = deriveExcerpt(`<p>${word}</p>`, 50);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
  });
});
