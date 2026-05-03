import { describe, expect, it } from 'vitest';
import type {
  CategoryOverviewNote,
  FolderNode,
} from '@noteforge/theme-default';
import { buildCategoryOverviewSections } from '../src/lib/categoryOverviewPayload.ts';

function folder(
  name: string,
  path: string,
  overrides: Partial<FolderNode> = {},
): FolderNode {
  return {
    name,
    path,
    children: [],
    notes: [],
    ...overrides,
  };
}

describe('buildCategoryOverviewSections', () => {
  it('returns [] for an empty tree (no children, no root notes)', () => {
    const root = folder('', '');
    expect(buildCategoryOverviewSections(root, new Map())).toEqual([]);
  });

  it('emits one section per top-level folder with deep-link href', () => {
    const root = folder('', '', {
      children: [
        folder('AI', 'AI', {
          notes: [
            { slug: 'AI/foo', title: 'Foo' },
            { slug: 'AI/bar', title: 'Bar', thumbnail: '/attachments/bar.png' },
          ],
        }),
      ],
    });
    const sections = buildCategoryOverviewSections(root, new Map());
    expect(sections).toHaveLength(1);
    expect(sections[0]?.name).toBe('AI');
    expect(sections[0]?.href).toBe('/AI/');
    expect(sections[0]?.notes.map((n: CategoryOverviewNote) => n.href)).toEqual([
      '/AI/bar/',
      '/AI/foo/',
    ]);
    expect(sections[0]?.notes[0]?.thumbnail).toBe('/attachments/bar.png');
  });

  it('flattens nested descendants under the top-level section', () => {
    const root = folder('', '', {
      children: [
        folder('A', 'A', {
          notes: [{ slug: 'A/n1', title: 'A1' }],
          children: [
            folder('B', 'A/B', {
              notes: [{ slug: 'A/B/n2', title: 'A-B2' }],
              children: [
                folder('C', 'A/B/C', {
                  notes: [{ slug: 'A/B/C/n3', title: 'A-B-C3' }],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    const sections = buildCategoryOverviewSections(root, new Map());
    expect(sections).toHaveLength(1);
    expect(sections[0]?.notes.map((n: CategoryOverviewNote) => n.href)).toEqual([
      '/A/B/C/n3/',
      '/A/B/n2/',
      '/A/n1/',
    ]);
  });

  it('appends Uncategorized as the last section when the root carries notes', () => {
    const root = folder('', '', {
      notes: [{ slug: 'orphan', title: 'Orphan' }],
      children: [
        folder('Z-zone', 'Z-zone', {
          notes: [{ slug: 'Z-zone/inside', title: 'Inside' }],
        }),
      ],
    });
    const sections = buildCategoryOverviewSections(root, new Map());
    expect(sections.map((s) => s.name)).toEqual(['Z-zone', 'Uncategorized']);
    const uncategorized = sections[1];
    expect(uncategorized?.href).toBeUndefined();
    expect(uncategorized?.notes).toEqual([
      { href: '/orphan/', title: 'Orphan' },
    ]);
  });

  it('sorts sections case-insensitively, Uncategorized always last', () => {
    const root = folder('', '', {
      notes: [{ slug: 'root-note', title: 'Root' }],
      children: [
        folder('beta', 'beta'),
        folder('Alpha', 'Alpha'),
        folder('zeta', 'zeta'),
      ],
    });
    const sections = buildCategoryOverviewSections(root, new Map());
    expect(sections.map((s) => s.name)).toEqual([
      'Alpha',
      'beta',
      'zeta',
      'Uncategorized',
    ]);
  });

  it('sorts notes by date desc then href asc, with undated notes pushed last', () => {
    const root = folder('', '', {
      children: [
        folder('Mix', 'Mix', {
          notes: [
            { slug: 'Mix/old', title: 'Old' },
            { slug: 'Mix/new', title: 'New' },
            { slug: 'Mix/sameA', title: 'SameA' },
            { slug: 'Mix/sameB', title: 'SameB' },
            { slug: 'Mix/undated', title: 'Undated' },
          ],
        }),
      ],
    });
    const dateBySlug = new Map<string, string>([
      ['Mix/old', '2025-01-01'],
      ['Mix/new', '2026-01-01'],
      ['Mix/sameA', '2025-06-01'],
      ['Mix/sameB', '2025-06-01'],
    ]);
    const sections = buildCategoryOverviewSections(root, dateBySlug);
    expect(sections[0]?.notes.map((n: CategoryOverviewNote) => n.href)).toEqual([
      '/Mix/new/',
      '/Mix/sameA/',
      '/Mix/sameB/',
      '/Mix/old/',
      '/Mix/undated/',
    ]);
    expect(sections[0]?.notes[0]?.date).toBe('2026-01-01');
    expect(sections[0]?.notes[4]?.date).toBeUndefined();
  });

  it('omits section href when sectionLinks option is false (category mode)', () => {
    const root = folder('', '', {
      notes: [{ slug: 'orphan', title: 'Orphan' }],
      children: [
        folder('Tech', 'Tech', {
          notes: [{ slug: 'temp/x', title: 'X' }],
        }),
        folder('에세이', '에세이', {
          children: [
            folder('2026', '에세이/2026', {
              notes: [{ slug: 'temp/diary', title: 'Diary' }],
            }),
          ],
        }),
      ],
    });
    const sections = buildCategoryOverviewSections(root, new Map(), {
      sectionLinks: false,
    });
    for (const s of sections) {
      expect(s.href).toBeUndefined();
    }
    // Note hrefs are unaffected — they still resolve via the vault-path routes.
    expect(sections.find((s) => s.name === 'Tech')?.notes[0]?.href).toBe(
      '/temp/x/',
    );
    expect(sections.find((s) => s.name === 'Uncategorized')).toBeDefined();
  });

  it('keeps section href by default (sectionLinks defaults to true)', () => {
    const root = folder('', '', {
      children: [
        folder('AI', 'AI', { notes: [{ slug: 'AI/x', title: 'X' }] }),
      ],
    });
    const sections = buildCategoryOverviewSections(root, new Map());
    expect(sections[0]?.href).toBe('/AI/');
  });

  it('carries preview metadata from folder notes into overview notes', () => {
    const root = folder('', '', {
      children: [
        folder('AI', 'AI', {
          notes: [
            {
              slug: 'AI/preview',
              title: 'Preview',
              description: 'Short intro',
              tags: ['astro', 'obsidian'],
              date: '2026-02-03',
              thumbnail: '/attachments/preview.png',
            },
          ],
        }),
      ],
    });
    const [section] = buildCategoryOverviewSections(root, new Map());
    expect(section?.notes[0]).toEqual({
      href: '/AI/preview/',
      title: 'Preview',
      description: 'Short intro',
      tags: ['astro', 'obsidian'],
      date: '2026-02-03',
      thumbnail: '/attachments/preview.png',
    });
  });
});
