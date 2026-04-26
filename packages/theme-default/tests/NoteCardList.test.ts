/**
 * Container-API tests for `<NoteCardList />`.
 *
 * Pin: empty state, allowlist enforcement, conditional <time>/<p>/ribbon,
 * escape (no set:html), and tag rendering.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import NoteCardList from '../src/components/NoteCardList.astro';
import type {
  NoteCardEntry,
  NoteCardListProps,
} from '../src/components/NoteCardList.types';

async function render(props: NoteCardListProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(NoteCardList as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('NoteCardList', () => {
  it('renders the empty message exactly once and emits no <ul> when entries is []', async () => {
    const html = await render({
      entries: [],
      emptyMessage: '아직 공개된 글이 없습니다.',
    });
    expect(countMatches(html, /아직 공개된 글이 없습니다\./g)).toBe(1);
    expect(countMatches(html, /<ul\b/g)).toBe(0);
    expect(countMatches(html, /<a\b/g)).toBe(0);
  });

  it('renders one <li class="note-card"> per entry with title + href verbatim', async () => {
    const entries: NoteCardEntry[] = [
      { href: '/a', title: 'A', tags: [] },
      { href: '/posts/b', title: 'B', tags: [] },
    ];
    const html = await render({ entries, emptyMessage: 'unused' });
    expect(countMatches(html, /<li[^>]*\bclass="note-card[^"]*"/g)).toBe(2);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/a"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="\/posts\/b"/);
    expect(html).toMatch(/<h3[^>]*\bclass="note-card__title"[^>]*>A</);
    expect(html).toMatch(/<h3[^>]*\bclass="note-card__title"[^>]*>B</);
  });

  it('emits <time> only when entry.date is present', async () => {
    const entries: NoteCardEntry[] = [
      { href: '/a', title: 'A', tags: [] },
      { href: '/b', title: 'B', date: '2026-04-26', tags: [] },
    ];
    const html = await render({ entries, emptyMessage: 'unused' });
    expect(countMatches(html, /<time\b/g)).toBe(1);
    expect(html).toMatch(
      /<time\s[^>]*\bdatetime="2026-04-26"[^>]*>2026-04-26<\/time>/,
    );
  });

  it('renders excerpt only when present and non-empty', async () => {
    const entries: NoteCardEntry[] = [
      { href: '/a', title: 'A', tags: [] },
      { href: '/b', title: 'B', excerpt: '', tags: [] },
      { href: '/c', title: 'C', excerpt: 'short note', tags: [] },
    ];
    const html = await render({ entries, emptyMessage: 'unused' });
    expect(countMatches(html, /<p\s[^>]*\bclass="note-card__excerpt"/g)).toBe(1);
    expect(html).toContain('>short note<');
  });

  it('renders tag list only when non-empty', async () => {
    const entries: NoteCardEntry[] = [
      { href: '/a', title: 'A', tags: [] },
      { href: '/b', title: 'B', tags: ['note', 'design'] },
    ];
    const html = await render({ entries, emptyMessage: 'unused' });
    expect(countMatches(html, /<ul\s[^>]*\bclass="note-card__tags"/g)).toBe(1);
    expect(countMatches(html, /<li\s[^>]*\bclass="note-card__tag"/g)).toBe(2);
    expect(html).toContain('#note');
    expect(html).toContain('#design');
  });

  it('renders featured ribbon only when entry.featured is true', async () => {
    const entries: NoteCardEntry[] = [
      { href: '/a', title: 'A', tags: [], featured: true },
      { href: '/b', title: 'B', tags: [] },
    ];
    const html = await render({ entries, emptyMessage: 'unused' });
    expect(countMatches(html, /\bnote-card__ribbon\b/g)).toBe(1);
    expect(countMatches(html, /\bis-featured\b/g)).toBe(1);
    expect(html).toMatch(/<span\s[^>]*\bclass="note-card__ribbon"[^>]*>featured</);
  });

  it('drops extra fields cast onto NoteCardEntry — allowlist enforcement', async () => {
    const sneaky = {
      entries: [
        {
          href: '/visible',
          title: 'Visible',
          tags: [],
          body: 'DO_NOT_LEAK_BANANA_6f3c1',
          frontmatter: { secret: 'PRIVATE_FIELD_PROBE_xyz' },
          permalink: '/some-other-route',
        },
      ],
      emptyMessage: 'unused',
    } as unknown as NoteCardListProps;
    const html = await render(sneaky);
    expect(html).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(html).not.toContain('frontmatter');
    expect(html).not.toContain('permalink');
    expect(html).toContain('Visible');
  });

  it('HTML-escapes title, excerpt, and tags (no set:html) — XSS guard', async () => {
    const html = await render({
      entries: [
        {
          href: '/x',
          title: '<img src=x onerror=alert(1)>',
          excerpt: '<script>steal()</script>',
          tags: ['<b>bold</b>'],
        },
      ],
      emptyMessage: 'unused',
    });
    expect(countMatches(html, /<img\b/g)).toBe(0);
    expect(countMatches(html, /<script\b/g)).toBe(0);
    expect(html).toMatch(/&lt;img/);
    expect(html).toMatch(/&lt;script/);
    expect(html).toMatch(/#&lt;b&gt;bold/);
  });

  it('uses note-card__* classes (page-neutral, no leakage)', async () => {
    const html = await render({
      entries: [
        {
          href: '/a',
          title: 'A',
          date: '2026-04-26',
          excerpt: 'x',
          tags: ['t'],
          featured: true,
        },
      ],
      emptyMessage: 'unused',
    });
    expect(html).toMatch(/<ul\s[^>]*\bclass="note-card-list"/);
    expect(html).toContain('note-card__title');
    expect(html).toContain('note-card__date');
    expect(html).toContain('note-card__excerpt');
    expect(html).toContain('note-card__tag');
    expect(html).toContain('note-card__ribbon');
    // anti-regression: must not borrow note-list / tag-page scoped names
    expect(html).not.toContain('note-list__');
    expect(html).not.toContain('tag-page__');
  });
});
