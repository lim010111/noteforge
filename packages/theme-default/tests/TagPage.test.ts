/**
 * Container-API tests for `<TagPage />`.
 *
 * Why these six assertions:
 *   - <h1> echoes #<tag> (1)             : guards the tag-render contract; user
 *                                          requested `/tags/<tag>` so the page
 *                                          must announce which tag it is. Missing
 *                                          h1 is the most user-visible regression.
 *   - empty entries → 1 message <p> (2)  : guards the privacy-aware empty state.
 *                                          Unlike Backlinks/TagList, the user has
 *                                          explicitly routed here, so 200/empty
 *                                          MUST hold (404 would imply the tag
 *                                          exists privately). The message must
 *                                          appear exactly once with no list.
 *   - n entries → n /<slug> links (3)    : guards the link-emission contract;
 *                                          href must be `/<slug>` with NO
 *                                          trailing slash (theme convention).
 *   - <span> only when date present (4)  : an empty <span> would leak the
 *                                          frontmatter shape (signals the field
 *                                          exists). Skip the <span> entirely
 *                                          when date is absent.
 *   - allowlist enforcement (5)          : the privacy CRITICAL — only `slug`,
 *                                          `title`, `date` may reach DOM. Extra
 *                                          keys (body, frontmatter, …) cast onto
 *                                          TagPageViewModel must NEVER leak.
 *   - title is escaped, not raw (6)      : guards the no-`set:html` invariant.
 *                                          A title with `<img …onerror=…>` must
 *                                          be HTML-escaped — Astro's default
 *                                          text interpolation does this iff we
 *                                          never opt into raw HTML.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TagPage from '../src/components/TagPage.astro';
import type { TagPageViewModel } from '../src/components/TagPage.types';

async function render(tagpage: TagPageViewModel): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(TagPage as never, { props: { tagpage } });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('TagPage', () => {
  it('(1) <h1> echoes #<tag> exactly once', async () => {
    const html = await render({ tag: 'rust', entries: [] });
    expect(
      countMatches(html, /<h1\b[^>]*>[^<]*#rust[^<]*<\/h1>/g),
      '<h1> must contain "#rust" verbatim — the page must announce the tag the user requested',
    ).toBe(1);
  });

  it('(2) empty entries renders the message once with no <ul>/<a>', async () => {
    const html = await render({ tag: 'rust', entries: [] });
    expect(
      countMatches(html, /이 태그를 가진 공개 노트가 없습니다\./g),
      'empty entries must render the explicit message exactly once — page must respond 200, not 404',
    ).toBe(1);
    expect(
      countMatches(html, /<ul\b/g),
      'empty entries must NOT emit <ul> — there are no entries to list',
    ).toBe(0);
    expect(
      countMatches(html, /<a\b/g),
      'empty entries must NOT emit any <a> — no entries means no links',
    ).toBe(0);
  });

  it('(3) emits one <a href="/<slug>"> per entry, no trailing slash', async () => {
    const html = await render({
      tag: 'rust',
      entries: [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B', date: '2026-01-10' },
      ],
    });
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/a"[^>]*>A<\/a>/g),
      'slug "a" must produce exactly one <a href="/a">A</a>',
    ).toBe(1);
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/b"[^>]*>B<\/a>/g),
      'slug "b" must produce exactly one <a href="/b">B</a>',
    ).toBe(1);
    expect(
      countMatches(html, /href="\/a\//g),
      'href must NOT have a trailing slash — theme uses no-trailing-slash convention',
    ).toBe(0);
    expect(countMatches(html, /href="\/b\//g)).toBe(0);
  });

  it('(4) <time> appears once iff entry.date is present (v0.2: date carried by <time>, never empty)', async () => {
    const html = await render({
      tag: 'rust',
      entries: [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B', date: '2026-01-10' },
      ],
    });
    expect(
      countMatches(html, /<time\b/g),
      'absent date must NOT emit <time> — an empty <time> would leak that the field shape exists',
    ).toBe(1);
    expect(
      countMatches(html, /<time\s[^>]*\bdatetime="2026-01-10"[^>]*>2026-01-10<\/time>/g),
      'date "2026-01-10" must appear exactly once inside the single <time datetime="…"> element',
    ).toBe(1);
  });

  it('(5) extra fields cast onto TagPageViewModel never reach the DOM (allowlist enforcement)', async () => {
    const sneaky = {
      tag: 'rust',
      entries: [
        {
          slug: 'visible',
          title: 'Visible',
          body: 'DO_NOT_LEAK_BANANA_6f3c1',
          frontmatter: { secret: 'PRIVATE_FIELD_PROBE_xyz' },
        },
      ],
    } as unknown as TagPageViewModel;

    const html = await render(sneaky);
    expect(
      html,
      'body field must not leak — privacy CRITICAL (TagPageEntry is allowlist)',
    ).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(html, 'extra key names must not appear in HTML either').not.toContain('body');
    expect(html).not.toContain('frontmatter');
    expect(html, 'declared title still renders').toContain('Visible');
    expect(html, 'declared slug still produces correct href').toMatch(
      /<a\s[^>]*\bhref="\/visible"/,
    );
  });

  it('(6) title is HTML-escaped (no set:html on title)', async () => {
    const html = await render({
      tag: 'rust',
      entries: [{ slug: 's', title: '<img src=x onerror=alert(1)>' }],
    });
    expect(
      countMatches(html, /<img\b/g),
      'title containing <img> must be escaped — set:html must NOT be used on title',
    ).toBe(0);
    expect(
      html,
      'escaped form (&lt;img …&gt;) must appear instead',
    ).toMatch(/&lt;img/);
  });

  it('(7) <section> root carries v0.2 token-based class (UI_GUIDE v0.2: BaseLayout owns container; component owns visual class only)', async () => {
    const html = await render({ tag: 'rust', entries: [] });
    const sectionMatch = html.match(/<section\s[^>]*\bclass="([^"]*)"/);
    expect(sectionMatch, '<section> must carry a class attribute pointing to components.css').not.toBeNull();
    expect(
      sectionMatch![1]!,
      '<section> class must be "tag-page" — UI_GUIDE v0.2: width comes from BaseLayout `.site-main`, not the component',
    ).toContain('tag-page');
  });

  it('(8) v0.2 visual: no hardcoded hex colours and no v0.1 zinc/blue Tailwind palette tokens reach the DOM', async () => {
    const html = await render({
      tag: 'rust',
      entries: [{ slug: 'a', title: 'A', date: '2026-01-10' }],
    });
    expect(
      html,
      'inline hex must not appear — light/dark token transition relies on CSS variables',
    ).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    for (const token of ['text-zinc-', 'text-blue-', 'hover:text-blue-']) {
      expect(
        html,
        `v0.1 Tailwind palette class "${token}*" must not appear — v0.2 uses semantic class names referencing CSS vars`,
      ).not.toContain(token);
    }
  });
});
