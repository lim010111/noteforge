import { describe, expect, it } from 'vitest';
import {
  coerceDate,
  descriptionForEntry,
  slugBasename,
  tagsForEntry,
  thumbnailForEntry,
} from './viewModels.ts';
import type { NoteEntry } from './viewModels.ts';

describe('coerceDate', () => {
  it('passes a string through unchanged', () => {
    expect(coerceDate('2026-05-01')).toBe('2026-05-01');
  });

  it('formats a Date object as YYYY-MM-DD', () => {
    // gray-matter (js-yaml default schema) parses unquoted YAML date scalars
    // like `Date: 2026-05-01` as JS Date objects rather than strings. Without
    // this coercion the home/category/tag rails see a non-string and fall
    // back to the `——` placeholder even though the note has a date.
    const d = new Date(Date.UTC(2026, 4, 1));
    expect(coerceDate(d)).toBe('2026-05-01');
  });

  it('returns undefined for invalid Date instances', () => {
    expect(coerceDate(new Date('not-a-date'))).toBeUndefined();
  });

  it('returns undefined for non-string, non-Date values', () => {
    expect(coerceDate(undefined)).toBeUndefined();
    expect(coerceDate(null)).toBeUndefined();
    expect(coerceDate(20260501)).toBeUndefined();
    expect(coerceDate({ year: 2026 })).toBeUndefined();
  });
});

describe('slugBasename', () => {
  it('returns the trailing segment of a multi-level slug', () => {
    // The whole point of the helper: a deep slug renders as just its last
    // segment when the note's frontmatter `title` is missing. Without this,
    // the home/listing fallback used `entry.id` and surfaced the full path
    // ("ai/gen-ai/공부-일지/lora") to readers — the v0.5 "/" rail bug.
    expect(slugBasename('ai/gen-ai/공부-일지/lora')).toBe('lora');
  });

  it('returns the input verbatim when there is no slash', () => {
    expect(slugBasename('lora')).toBe('lora');
  });

  it('handles the trailing-slash edge case as the empty segment', () => {
    // A slug ending in `/` is malformed for our routing, but the helper
    // must not crash or invent a name. Returning '' makes the misuse
    // visible in test output rather than masking it with a guess.
    expect(slugBasename('foo/bar/')).toBe('');
  });
});

describe('thumbnailForEntry', () => {
  function entry(data: Record<string, unknown>): NoteEntry {
    return {
      id: 'note',
      collection: 'notes',
      data: {
        kind: 'note',
        frontmatter: {},
        tags: [],
        backlinks: [],
        ...data,
      },
      rendered: { html: '', metadata: {} },
    } as unknown as NoteEntry;
  }

  it('prefers thumbnailImage over heroImage', () => {
    expect(
      thumbnailForEntry(
        entry({
          heroImage: '/attachments/hero.png',
          thumbnailImage: '/attachments/thumb.png',
        }),
      ),
    ).toBe('/attachments/thumb.png');
  });

  it('falls back to heroImage and ignores non-string values', () => {
    expect(thumbnailForEntry(entry({ heroImage: '/attachments/hero.png' }))).toBe(
      '/attachments/hero.png',
    );
    expect(thumbnailForEntry(entry({ heroImage: 123 }))).toBeUndefined();
  });
});

describe('listing preview helpers', () => {
  function entry(data: Record<string, unknown>, html = ''): NoteEntry {
    return {
      id: 'note',
      collection: 'notes',
      data: {
        kind: 'note',
        frontmatter: {},
        tags: [],
        backlinks: [],
        ...data,
      },
      rendered: { html, metadata: {} },
    } as unknown as NoteEntry;
  }

  it('trims non-empty description frontmatter for list previews', () => {
    expect(
      descriptionForEntry(
        entry({ frontmatter: { description: '  Short intro  ' } }),
      ),
    ).toBe('Short intro');
    expect(
      descriptionForEntry(entry({ frontmatter: { description: '   ' } })),
    ).toBeUndefined();
    expect(
      descriptionForEntry(entry({ frontmatter: { description: 123 } })),
    ).toBeUndefined();
  });

  it('prefers frontmatter description over rendered body text', () => {
    expect(
      descriptionForEntry(
        entry(
          { frontmatter: { description: '  Curated intro  ' } },
          '<p>Body fallback should not win.</p>',
        ),
      ),
    ).toBe('Curated intro');
  });

  it('falls back to the beginning of rendered body text when description is absent', () => {
    expect(
      descriptionForEntry(
        entry(
          { frontmatter: {} },
          '<p>First <strong>public</strong> sentence &amp; more.</p><p>Second paragraph.</p>',
        ),
      ),
    ).toBe('First public sentence & more. Second paragraph.');
  });

  it('skips leading body tag markers in rendered body excerpts', () => {
    expect(
      descriptionForEntry(
        entry(
          { frontmatter: {} },
          '<p>#public #essay Actual intro starts here.</p>',
        ),
      ),
    ).toBe('Actual intro starts here.');
  });

  it('truncates long rendered body excerpts', () => {
    const longText = 'a'.repeat(200);
    expect(
      descriptionForEntry(entry({ frontmatter: {} }, `<p>${longText}</p>`)),
    ).toBe(`${'a'.repeat(157)}...`);
  });

  it('trims tags and drops empty tags for list previews', () => {
    expect(tagsForEntry(entry({ tags: [' rust ', '', '  ', 'astro'] }))).toEqual(
      ['rust', 'astro'],
    );
  });
});
