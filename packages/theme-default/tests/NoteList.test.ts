/**
 * Container-API tests for `<NoteList />`.
 *
 * NoteList is the shared listing primitive used by both the home page and
 * TagPage. The assertions below pin the contract that lets one component
 * back two pages without coupling them: structural shape, allowlist
 * enforcement, conditional `<time>`, and `set:html` absence.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import NoteList from '../src/components/NoteList.astro';
import type {
  NoteListEntry,
  NoteListProps,
} from '../src/components/NoteList.types';

async function render(props: NoteListProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(NoteList as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('NoteList', () => {
  it('renders the empty message exactly once and emits no <ul>/<a> when entries is []', async () => {
    const html = await render({ entries: [], emptyMessage: '아직 공개된 글이 없습니다.' });
    expect(countMatches(html, /아직 공개된 글이 없습니다\./g)).toBe(1);
    expect(countMatches(html, /<ul\b/g)).toBe(0);
    expect(countMatches(html, /<a\b/g)).toBe(0);
  });

  it('renders one <li> + <a href> per entry, preserving caller-provided href verbatim', async () => {
    const entries: NoteListEntry[] = [
      { href: '/a', title: 'A' },
      { href: '/posts/b', title: 'B' },
    ];
    const html = await render({ entries, emptyMessage: 'unused' });
    expect(countMatches(html, /<li\b/g)).toBe(2);
    expect(countMatches(html, /<a\s[^>]*\bhref="\/a"/g)).toBe(1);
    expect(countMatches(html, /<a\s[^>]*\bhref="\/posts\/b"/g)).toBe(1);
    expect(html).toMatch(
      /<span\s[^>]*\bclass="post-preview__title note-list__link"[^>]*>A<\/span>/,
    );
    expect(html).toMatch(
      /<span\s[^>]*\bclass="post-preview__title note-list__link"[^>]*>B<\/span>/,
    );
  });

  it('emits <time> only when entry.date is present (no empty <time> leak)', async () => {
    const entries: NoteListEntry[] = [
      { href: '/a', title: 'A' },
      { href: '/b', title: 'B', date: '2026-01-10' },
    ];
    const html = await render({ entries, emptyMessage: 'unused' });
    expect(countMatches(html, /<time\b/g)).toBe(1);
    expect(html).toMatch(
      /<time\s[^>]*\bdatetime="2026-01-10"[^>]*>2026-01-10<\/time>/,
    );
  });

  it('renders decorative thumbnails and fixed placeholders without using title as alt text', async () => {
    const html = await render({
      entries: [
        { href: '/a', title: 'A', thumbnail: '/attachments/a.png' },
        { href: '/b', title: 'B' },
      ],
      emptyMessage: 'unused',
    });
    expect(html).toMatch(
      /<img\s[^>]*\bclass="post-preview__thumb note-list__thumb not-prose"[^>]*\bsrc="\/attachments\/a\.png"[^>]*\balt=""/,
    );
    expect(html).toContain('note-list__thumb--placeholder');
    expect(html).not.toMatch(/\balt="A"/);
  });

  it('orders preview text as title, intro, then tags | date', async () => {
    const html = await render({
      entries: [
        {
          href: '/a',
          title: 'A title',
          description: 'A short intro',
          tags: ['rust', 'astro'],
          date: '2026-01-10',
        },
      ],
      emptyMessage: 'unused',
    });
    const titleIdx = html.indexOf('A title');
    const introIdx = html.indexOf('A short intro');
    const tagsIdx = html.indexOf('#rust #astro');
    const sepIdx = html.indexOf('post-preview__sep');
    const dateIdx = html.indexOf('2026-01-10');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(introIdx).toBeGreaterThan(titleIdx);
    expect(tagsIdx).toBeGreaterThan(introIdx);
    expect(sepIdx).toBeGreaterThan(tagsIdx);
    expect(dateIdx).toBeGreaterThan(sepIdx);
  });

  it('drops extra fields cast onto NoteListEntry — allowlist enforcement', async () => {
    const sneaky = {
      entries: [
        {
          href: '/visible',
          title: 'Visible',
          body: 'DO_NOT_LEAK_BANANA_6f3c1',
          frontmatter: { secret: 'PRIVATE_FIELD_PROBE_xyz' },
        },
      ],
      emptyMessage: 'unused',
    } as unknown as NoteListProps;
    const html = await render(sneaky);
    expect(html).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(html).not.toContain('frontmatter');
    expect(html).toContain('Visible');
  });

  it('HTML-escapes title (no set:html) — XSS guard', async () => {
    const html = await render({
      entries: [{ href: '/s', title: '<img src=x onerror=alert(1)>' }],
      emptyMessage: 'unused',
    });
    expect(countMatches(html, /<img\b/g)).toBe(0);
    expect(html).toMatch(/&lt;img/);
  });

  it('HTML-escapes emptyMessage too', async () => {
    const html = await render({
      entries: [],
      emptyMessage: '<script>alert(1)</script>',
    });
    expect(countMatches(html, /<script\b/g)).toBe(0);
    expect(html).toMatch(/&lt;script/);
  });

  it('uses note-list__* classes (not tag-page__*) so listing visuals are page-neutral', async () => {
    const html = await render({
      entries: [{ href: '/a', title: 'A', date: '2026-01-10' }],
      emptyMessage: 'unused',
    });
    expect(html).toMatch(/<ul\s[^>]*\bclass="note-list"/);
    expect(html).toContain('note-list__item');
    expect(html).toContain('post-preview');
    expect(html).toContain('note-list__date');
    expect(html).toContain('note-list__link');
    // Anti-regression: a future home page must not borrow tag-page__ scoped names.
    expect(html).not.toContain('tag-page__list');
    expect(html).not.toContain('tag-page__item');
  });
});
