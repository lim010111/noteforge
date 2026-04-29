import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FEATURED_RAIL_CAP,
  RECENT_RAIL_CAP,
  selectFeatured,
  selectRecent,
} from './homeRails.ts';
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

describe('selectRecent', () => {
  it('exports RECENT_RAIL_CAP as a named constant equal to 10', () => {
    expect(RECENT_RAIL_CAP).toBe(10);
  });

  it('caps output at RECENT_RAIL_CAP when input exceeds it', () => {
    const entries: NoteEntry[] = [];
    for (let i = 0; i < RECENT_RAIL_CAP + 1; i += 1) {
      entries.push(
        makeEntry(`n${String(i).padStart(2, '0')}`, {
          frontmatter: { date: `2026-04-${String((i % 28) + 1).padStart(2, '0')}` },
        }),
      );
    }
    expect(entries).toHaveLength(RECENT_RAIL_CAP + 1);
    expect(selectRecent(entries)).toHaveLength(RECENT_RAIL_CAP);
  });

  it('returns all entries when input is below the cap', () => {
    const entries: NoteEntry[] = [];
    for (let i = 0; i < 8; i += 1) {
      entries.push(
        makeEntry(`n${i}`, {
          frontmatter: { date: `2026-04-${String(i + 1).padStart(2, '0')}` },
        }),
      );
    }
    expect(selectRecent(entries)).toHaveLength(8);
  });

  it('places dated entries first (date DESC) and undated entries last (id ASC)', () => {
    const dated1 = makeEntry('apple', { frontmatter: { date: '2026-01-01' } });
    const dated2 = makeEntry('banana', { frontmatter: { date: '2026-04-01' } });
    const undated1 = makeEntry('zebra', { frontmatter: {} });
    const undated2 = makeEntry('alpha', { frontmatter: {} });
    const sorted = selectRecent([dated1, undated1, dated2, undated2]).map(
      (e) => e.id,
    );
    // banana (2026-04-01) → apple (2026-01-01) → alpha (undated, id ASC) → zebra
    expect(sorted).toEqual(['banana', 'apple', 'alpha', 'zebra']);
  });
});

describe('selectFeatured', () => {
  it('exports FEATURED_RAIL_CAP as a named constant equal to 6', () => {
    expect(FEATURED_RAIL_CAP).toBe(6);
  });

  it('caps output at FEATURED_RAIL_CAP when more than that are featured', () => {
    const entries: NoteEntry[] = [];
    for (let i = 0; i < FEATURED_RAIL_CAP + 1; i += 1) {
      entries.push(
        makeEntry(`f${i}`, {
          frontmatter: {
            featured: true,
            date: `2026-04-${String(i + 1).padStart(2, '0')}`,
          },
        }),
      );
    }
    expect(selectFeatured(entries)).toHaveLength(FEATURED_RAIL_CAP);
  });

  it('returns [] when no entries have featured: true (so caller omits the section)', () => {
    const entries = [
      makeEntry('a', { frontmatter: { date: '2026-04-01' } }),
      makeEntry('b', { frontmatter: { date: '2026-03-01', featured: false } }),
      // Truthy non-boolean values do NOT qualify — gate is strict boolean true.
      makeEntry('c', { frontmatter: { featured: 'yes' } }),
      makeEntry('d', { frontmatter: { featured: 1 } }),
    ];
    expect(selectFeatured(entries)).toEqual([]);
  });

  it('breaks date ties by id ASC (stable order across rebuilds)', () => {
    const x = makeEntry('zeta', {
      frontmatter: { featured: true, date: '2026-04-25' },
    });
    const y = makeEntry('alpha', {
      frontmatter: { featured: true, date: '2026-04-25' },
    });
    const z = makeEntry('mu', {
      frontmatter: { featured: true, date: '2026-04-25' },
    });
    expect(selectFeatured([x, y, z]).map((e) => e.id)).toEqual([
      'alpha',
      'mu',
      'zeta',
    ]);
  });
});

describe('home-rails empty-featured render guard', () => {
  it('apps/blog/src/pages/index.astro wraps any Featured section in a length conditional', async () => {
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const indexPath = path.join(here, '..', 'pages', 'index.astro');
    const src = await fs.readFile(indexPath, 'utf8');
    // Source-level guard: any rendering of the Featured section must be
    // gated on a `.length > 0` check so that an empty featured list yields
    // *no* DOM (no heading, no empty <ul>, no fallback copy). This is the
    // static-analysis half of the v0.3 privacy contract — the runtime half
    // is the build-time grep on dist/index.html in the AC.
    expect(src).toMatch(/featured(?:Items)?\.length\s*>\s*0/);
  });
});
