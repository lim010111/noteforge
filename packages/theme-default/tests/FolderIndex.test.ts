/**
 * Container-API tests for `<FolderIndex />`.
 *
 * Why these assertions:
 *   - breadcrumb shape (1)        : root-to-current order, last segment is
 *                                   aria-current="page", separators between.
 *   - first-segment dot (2)       : depth-0 category dot mirrors FolderTree;
 *                                   subsequent segments are uncolored.
 *   - empty (3)                   : both lists empty → fallback copy renders,
 *                                   no list/heading shown.
 *   - empty copy (4)              : fallback text intentionally vague — must
 *                                   not disclose private-history of folder.
 *   - section omission (5)        : when childFolders empty, no folders <h2>;
 *                                   when childNotes empty, no notes <h2>.
 *   - all hrefs trail with `/` (6): UI_GUIDE §URL invariant under
 *                                   `trailingSlash: 'always'` (ADR-012).
 *   - no client directive (7)     : pure server render — privacy contract +
 *                                   no-new-JS guarantee from step10 design.
 *   - DOM nesting (8)             : <article> root with nested <nav>, <h1>,
 *                                   <section>, <ul> shape per design SSOT.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import FolderIndex from '../src/components/FolderIndex.astro';
import type { FolderIndexViewModel } from '../src/components/FolderIndex.types';

async function render(view: FolderIndexViewModel): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(FolderIndex as never, { props: { view } });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

const baseView: FolderIndexViewModel = {
  folderName: 'Claude',
  folderPath: 'AI/Claude',
  breadcrumb: [
    { label: 'home', href: '/' },
    { label: 'AI', href: '/AI/' },
    { label: 'Claude', href: '/AI/Claude/' },
  ],
  categorySlot: 3,
  childFolders: [
    { name: 'opus-4.7', href: '/AI/Claude/opus-4.7/', noteCount: 2 },
  ],
  childNotes: [
    {
      title: 'opus prompt guide',
      href: '/AI/Claude/opus-prompt-guide/',
      description: 'A practical introduction to opus prompts.',
      tags: ['claude', 'prompting'],
      date: '2026-04-26',
      thumbnail: '/attachments/opus.png',
    },
  ],
};

describe('FolderIndex', () => {
  it('(1) renders breadcrumb segments in order with aria-current="page" on the last', async () => {
    const html = await render(baseView);
    const homeIdx = html.indexOf('home</a>');
    const aiIdx = html.indexOf('AI</a>');
    const claudeIdx = html.indexOf('Claude</span>');
    expect(homeIdx).toBeGreaterThanOrEqual(0);
    expect(aiIdx).toBeGreaterThan(homeIdx);
    expect(claudeIdx).toBeGreaterThan(aiIdx);
    expect(html).toMatch(/aria-current=["']page["'][^>]*>Claude</);
  });

  it('(2) renders depth-0 category dot only before the first breadcrumb segment', async () => {
    const html = await render(baseView);
    expect(html).toMatch(/--color-accent-cat-3/);
    // Exactly one dot — the slot 3 reference in the inline style.
    expect(countMatches(html, /folder-index__dot/g)).toBe(1);
  });

  it('(3) renders empty fallback when both childFolders and childNotes are empty', async () => {
    const html = await render({
      ...baseView,
      childFolders: [],
      childNotes: [],
    });
    expect(countMatches(html, /<ul\b/g)).toBe(0);
    expect(countMatches(html, /<h2\b/g)).toBe(0);
    expect(html).toMatch(/이 폴더에는 공개된 글이 없습니다/);
  });

  it('(4) empty-state copy does NOT disclose any private-history hint', async () => {
    const html = await render({
      ...baseView,
      childFolders: [],
      childNotes: [],
    });
    expect(html).not.toMatch(/삭제/);
    expect(html).not.toMatch(/이전/);
    expect(html).not.toMatch(/비공개/);
    expect(html).not.toMatch(/없거나/);
  });

  it('(5) omits a section heading + list when its array is empty', async () => {
    const onlyNotes = await render({ ...baseView, childFolders: [] });
    expect(onlyNotes).not.toMatch(/▸ folders/);
    expect(onlyNotes).toMatch(/▸ notes/);

    const onlyFolders = await render({ ...baseView, childNotes: [] });
    expect(onlyFolders).toMatch(/▸ folders/);
    expect(onlyFolders).not.toMatch(/▸ notes/);
  });

  it('(6) every href in the rendered output ends with /', async () => {
    const html = await render(baseView);
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href, `href '${href}' must end with /`).toMatch(/\/$/);
    }
  });

  it('(7) emits no client:* directive (server-only render, no new JS)', async () => {
    const html = await render(baseView);
    expect(html).not.toMatch(/client:(load|idle|visible|media|only)/);
  });

  it('(8) wraps content in <article> with breadcrumb <nav>, <h1>, <section> shape', async () => {
    const html = await render(baseView);
    expect(countMatches(html, /<article\b/g)).toBeGreaterThan(0);
    expect(html).toMatch(/<nav\b[^>]*aria-label=["']breadcrumb["']/);
    expect(countMatches(html, /<h1\b/g)).toBe(1);
    // Two sections: folders + notes
    expect(countMatches(html, /<section\b/g)).toBe(2);
  });

  it('(9) renders note thumbnails as decorative images', async () => {
    const html = await render(baseView);
    expect(html).toMatch(
      /<img\s[^>]*\bclass="post-preview__thumb folder-index__thumb not-prose"[^>]*\bsrc="\/attachments\/opus\.png"[^>]*\balt=""/,
    );
    expect(html).not.toMatch(/\balt="opus prompt guide"/);
  });

  it('(10) orders note preview text as title, intro, then tags | date', async () => {
    const html = await render(baseView);
    const titleIdx = html.indexOf('opus prompt guide');
    const introIdx = html.indexOf('A practical introduction to opus prompts.');
    const tagsIdx = html.indexOf('#claude #prompting');
    const sepIdx = html.indexOf('post-preview__sep');
    const dateIdx = html.indexOf('2026-04-26');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(introIdx).toBeGreaterThan(titleIdx);
    expect(tagsIdx).toBeGreaterThan(introIdx);
    expect(sepIdx).toBeGreaterThan(tagsIdx);
    expect(dateIdx).toBeGreaterThan(sepIdx);
  });
});
