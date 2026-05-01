import { describe, expect, it } from 'vitest';
import { filterFrontmatter } from '../src/privacy/frontmatterFilter.ts';

const DEFAULT_ALLOWLIST = [
  'title',
  'description',
  'date',
  'updated',
  'tags',
  'aliases',
  'cover',
  'thumbnail',
  'author',
  'draft',
  'public',
  'slug',
  'permalink',
  'lang',
  'featured',
] as const;

describe('filterFrontmatter', () => {
  it('returns {} for empty frontmatter', () => {
    expect(filterFrontmatter({}, ['title'])).toEqual({});
  });

  it('drops keys outside the allowlist', () => {
    const result = filterFrontmatter({ title: 'A', personalNote: 'secret' }, ['title']);
    expect(result).toEqual({ title: 'A' });
    expect(result).not.toHaveProperty('personalNote');
  });

  it('keeps only allowlist keys from a large frontmatter', () => {
    const input = {
      title: 'Hello',
      description: 'desc',
      secretKey: 'nope',
      mood: 'happy',
      'reading-time': 5,
      internalRef: { db: 'pg' },
    };
    const result = filterFrontmatter(input, ['title', 'description']);
    expect(result).toEqual({ title: 'Hello', description: 'desc' });
    expect(Object.keys(result)).toHaveLength(2);
  });

  it('passes exactly the 15 default allowlist fields, drops others', () => {
    const input: Record<string, unknown> = {
      title: 'T',
      description: 'D',
      date: '2026-01-01',
      updated: '2026-01-02',
      tags: ['a'],
      aliases: ['b'],
      cover: 'c.png',
      thumbnail: 't.png',
      author: 'me',
      draft: false,
      public: true,
      slug: 's',
      permalink: '/p',
      lang: 'ko',
      featured: true,
      // outside allowlist
      personalNote: 'leak',
      apiKey: 'sk-xxxx',
      mood: 'x',
    };
    const result = filterFrontmatter(input, DEFAULT_ALLOWLIST);
    expect(Object.keys(result).sort()).toEqual([...DEFAULT_ALLOWLIST].sort());
    for (const key of DEFAULT_ALLOWLIST) {
      expect(result[key]).toBe(input[key]);
    }
    expect(result).not.toHaveProperty('personalNote');
    expect(result).not.toHaveProperty('apiKey');
    expect(result).not.toHaveProperty('mood');
  });

  it('returns {} when allowlist is empty, regardless of input', () => {
    expect(filterFrontmatter({ title: 'A', description: 'D' }, [])).toEqual({});
  });

  it('does not mutate the input frontmatter object', () => {
    const input = Object.freeze({ title: 'A', personalNote: 'secret' });
    const beforeKeys = Object.keys(input);
    const beforeCount = beforeKeys.length;
    filterFrontmatter(input, ['title']);
    expect(Object.keys(input)).toEqual(beforeKeys);
    expect(Object.keys(input)).toHaveLength(beforeCount);
    expect(input.title).toBe('A');
    expect(input.personalNote).toBe('secret');
  });

  it('preserves explicit null values for allowlist keys', () => {
    const result = filterFrontmatter({ title: null }, ['title']);
    expect(result).toEqual({ title: null });
    expect('title' in result).toBe(true);
  });

  it('drops keys whose value is undefined (treated as absent)', () => {
    const result = filterFrontmatter({ title: undefined }, ['title']);
    expect(result).toEqual({});
    expect('title' in result).toBe(false);
  });

  it('copies nested object values by reference (shallow), structure preserved', () => {
    const cover = { src: 'x.png', alt: 'pic' };
    const input = { cover };
    const result = filterFrontmatter(input, ['cover']);
    expect(result).toEqual({ cover: { src: 'x.png', alt: 'pic' } });
    expect(result.cover).toBe(cover);
  });

  it('prefers exact (case-sensitive) match when both casings are present', () => {
    // When the author wrote the canonical key, that's their intent — use it
    // verbatim and ignore any other casing variants that would otherwise be
    // picked up by the case-insensitive fallback below.
    const result = filterFrontmatter({ Title: 'A', title: 'B' }, ['title']);
    expect(result).toEqual({ title: 'B' });
    expect(result).not.toHaveProperty('Title');
  });

  it('falls back to case-insensitive match for allowlisted keys', () => {
    // Obsidian's Property panel preserves the user's typed casing
    // (e.g. `Date: 2026-05-01`). Without case-insensitive fallback, those
    // notes lose their date silently because the allowlist is documented
    // lowercase and the strict match drops `Date`. Output uses the canonical
    // (allowlisted) key so consumers always read `frontmatter['date']`.
    const result = filterFrontmatter(
      { Date: '2026-05-01', Title: 'Hello' },
      ['date', 'title'],
    );
    expect(result).toEqual({ date: '2026-05-01', title: 'Hello' });
  });

  it('case-insensitive fallback does not introduce non-allowlisted keys', () => {
    // Privacy contract: case-insensitive matching only relaxes the casing of
    // *allowlisted* semantic fields. A non-allowlisted key like `Mood` must
    // still be dropped — otherwise we would smuggle arbitrary fields through
    // by varying their case.
    const result = filterFrontmatter(
      { Mood: 'happy', personalNote: 'secret' },
      ['title'],
    );
    expect(result).toEqual({});
  });

  it('case-insensitive fallback returns the first matching variant only', () => {
    // If the same semantic key appears multiple times under different casing,
    // we keep the first one we encounter and ignore the rest. The exact
    // canonical match (`date`) would have been picked up by the precedence
    // branch already; the fallback only fires when the canonical key is
    // absent, so callers see deterministic output even with authoring drift.
    const result = filterFrontmatter(
      { DATE: '2026-01-01', Date: '2026-05-01' },
      ['date'],
    );
    expect(Object.keys(result)).toEqual(['date']);
    expect(typeof result.date).toBe('string');
  });
});
