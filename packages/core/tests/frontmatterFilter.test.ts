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

  it('passes exactly the 14 default allowlist fields, drops others', () => {
    const input: Record<string, unknown> = {
      title: 'T',
      description: 'D',
      date: '2026-01-01',
      updated: '2026-01-02',
      tags: ['a'],
      aliases: ['b'],
      cover: 'c.png',
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

  it('is case-sensitive: Title and title are distinct', () => {
    const result = filterFrontmatter({ Title: 'A', title: 'B' }, ['title']);
    expect(result).toEqual({ title: 'B' });
    expect(result).not.toHaveProperty('Title');
  });
});
