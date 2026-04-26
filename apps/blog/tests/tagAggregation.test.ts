import { describe, expect, it } from 'vitest';
import {
  entriesForTag,
  summarizeTags,
} from '../src/lib/tagAggregation.ts';
import type { NoteEntry } from '../src/lib/viewModels.ts';

interface NoteEntryDataInput {
  title?: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
  backlinks?: string[];
}

function makeEntry(id: string, data: NoteEntryDataInput): NoteEntry {
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

describe('summarizeTags', () => {
  it('returns [] for empty input', () => {
    expect(summarizeTags([])).toEqual([]);
  });

  it('counts a tag once per note that carries it', () => {
    const a = makeEntry('a', { tags: ['rust'] });
    const b = makeEntry('b', { tags: ['rust', 'go'] });
    const summaries = summarizeTags([a, b]);
    const rust = summaries.find((s) => s.tag === 'rust');
    expect(rust?.count).toBe(2);
  });

  it('sorts by count DESC, ties broken by tag ASC', () => {
    const a = makeEntry('a', { tags: ['z', 'a'] });
    const b = makeEntry('b', { tags: ['z', 'a'] });
    const c = makeEntry('c', { tags: ['m'] });
    const summaries = summarizeTags([a, b, c]);
    expect(summaries.map((s) => s.tag)).toEqual(['a', 'z', 'm']);
    expect(summaries.map((s) => s.count)).toEqual([2, 2, 1]);
  });

  it('drops empty / whitespace-only tag strings', () => {
    const a = makeEntry('a', { tags: ['', '  ', 'rust'] });
    const summaries = summarizeTags([a]);
    expect(summaries).toEqual([{ tag: 'rust', count: 1 }]);
  });
});

describe('entriesForTag', () => {
  it('returns only entries carrying the tag', () => {
    const a = makeEntry('a', { tags: ['rust'], title: 'A' });
    const b = makeEntry('b', { tags: ['go'], title: 'B' });
    const c = makeEntry('c', { tags: ['rust', 'go'], title: 'C' });
    const result = entriesForTag('rust', [a, b, c]);
    expect(result.map((e) => e.slug).sort()).toEqual(['a', 'c']);
  });

  it('orders by date DESC and pushes entries without date to the end', () => {
    const newest = makeEntry('newest', {
      tags: ['t'],
      title: 'newest',
      frontmatter: { date: '2026-04-25' },
    });
    const older = makeEntry('older', {
      tags: ['t'],
      title: 'older',
      frontmatter: { date: '2024-01-01' },
    });
    const undated = makeEntry('undated', {
      tags: ['t'],
      title: 'undated',
      frontmatter: {},
    });
    const result = entriesForTag('t', [undated, older, newest]);
    expect(result.map((e) => e.slug)).toEqual(['newest', 'older', 'undated']);
  });

  it('falls back to last segment of slug when title is missing', () => {
    const e = makeEntry('notes/2026/no-title', {
      tags: ['t'],
      frontmatter: {},
    });
    const [item] = entriesForTag('t', [e]);
    expect(item?.title).toBe('no-title');
  });

  it('omits TagPageEntry.date when frontmatter date is not a string', () => {
    const a = makeEntry('a', {
      tags: ['t'],
      title: 'A',
      frontmatter: { date: 12345 },
    });
    const [item] = entriesForTag('t', [a]);
    expect(item?.date).toBeUndefined();
  });
});
