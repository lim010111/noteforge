import { describe, expect, it } from 'vitest';
import { normalizeTags } from '../src/tags.ts';

describe('normalizeTags', () => {
  describe('frontmatter tags', () => {
    it('returns empty array when no frontmatter tags and no body tags', () => {
      expect(normalizeTags(undefined, '')).toEqual([]);
    });

    it('accepts YAML array of strings', () => {
      expect(normalizeTags(['public', 'essay'], '')).toEqual(['public', 'essay']);
    });

    it('accepts a comma-separated string', () => {
      expect(normalizeTags('public, essay, wip', '')).toEqual(['public', 'essay', 'wip']);
    });

    it('strips leading # from frontmatter tags', () => {
      expect(normalizeTags(['#public', '#foo'], '')).toEqual(['public', 'foo']);
    });

    it('lowercases tags', () => {
      expect(normalizeTags(['Public', 'Essay/Thoughts'], '')).toEqual(['public', 'essay/thoughts']);
    });

    it('ignores non-string frontmatter values silently', () => {
      expect(normalizeTags([42, true, null, 'ok'], '')).toEqual(['ok']);
    });

    it('returns empty array for non-array, non-string frontmatter value', () => {
      expect(normalizeTags({ some: 'object' }, '')).toEqual([]);
    });
  });

  describe('inline body tags', () => {
    it('extracts single inline #tag', () => {
      expect(normalizeTags(undefined, 'hello #public world')).toEqual(['public']);
    });

    it('extracts nested #a/b tag', () => {
      expect(normalizeTags(undefined, 'category #public/essays here')).toEqual(['public/essays']);
    });

    it('merges frontmatter + inline tags without duplicates', () => {
      expect(normalizeTags(['public'], 'also see #essay and #public')).toEqual([
        'public',
        'essay',
      ]);
    });

    it('ignores tags inside fenced code blocks', () => {
      const body = 'before\n```\nsome code with #not-a-tag inside\n```\nafter #real';
      expect(normalizeTags(undefined, body)).toEqual(['real']);
    });

    it('ignores tags inside tilde fenced code blocks', () => {
      const body = 'before\n~~~\n#not-a-tag\n~~~\nafter #real';
      expect(normalizeTags(undefined, body)).toEqual(['real']);
    });

    it('ignores tags inside inline code spans', () => {
      expect(normalizeTags(undefined, 'use `#example` as syntax, but #real-tag counts')).toEqual([
        'real-tag',
      ]);
    });

    it('does not match # at end of line without text', () => {
      expect(normalizeTags(undefined, 'not a tag #\nnor this #.')).toEqual([]);
    });

    it('does not treat markdown headings as tags', () => {
      expect(normalizeTags(undefined, '# Heading\n## Another')).toEqual([]);
    });

    it('does not match # preceded by a word character (URL fragments)', () => {
      expect(normalizeTags(undefined, 'see https://example.com/page#section or foo#bar')).toEqual(
        [],
      );
    });

    it('extracts multiple inline tags', () => {
      expect(normalizeTags(undefined, '#one #two #three/nested')).toEqual([
        'one',
        'two',
        'three/nested',
      ]);
    });
  });

  describe('normalization', () => {
    it('produces a readonly array (as stable Tag[] for classify)', () => {
      const tags = normalizeTags(['#Public'], 'also #Essay');
      expect(tags).toContain('public');
      expect(tags).toContain('essay');
    });

    it('preserves tag order: frontmatter first, then inline', () => {
      expect(normalizeTags(['first'], '#second #third')).toEqual(['first', 'second', 'third']);
    });

    it('deduplicates case-insensitively', () => {
      expect(normalizeTags(['Public'], '#PUBLIC #public')).toEqual(['public']);
    });
  });
});
