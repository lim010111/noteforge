/**
 * Container-API tests for `<TagList />`.
 *
 * Why these six assertions:
 *   - empty tags → silent (1)            : an empty <section>/<h1>/<ul> would
 *                                          itself disclose "tags exist but were
 *                                          filtered" (private tags via blocklist).
 *                                          PRD/UI_GUIDE: do not leak existence —
 *                                          let the caller decide whether to
 *                                          render the page at all.
 *   - n tags → n links w/ encoded href (2): guards the link-emission contract;
 *                                          href must be exactly
 *                                          `/tags/<encodeURIComponent(tag)>`,
 *                                          matching Note.astro. Adjacent typo
 *                                          (`/tag/`) silently breaks routing.
 *                                          Non-ASCII tags must be percent-encoded
 *                                          so links work in URL bar / SEO.
 *   - count appears once per chip (3)    : guards display contract for `count`;
 *                                          missing/duplicated count is the most
 *                                          visible regression for users.
 *   - heading count is 1/0 (4)           : guards the single-region heading —
 *                                          zero when empty, one when non-empty,
 *                                          never two.
 *   - allowlist enforcement (5)          : the privacy CRITICAL — only `tag`
 *                                          and `count` may reach DOM. Extra
 *                                          keys (slugs, description, …) cast
 *                                          onto TagListViewModel must NEVER
 *                                          leak through.
 *   - tag is escaped, not raw (6)        : guards the no-`set:html` invariant.
 *                                          A tag like `<script>` must be
 *                                          HTML-escaped — Astro's default text
 *                                          interpolation handles this iff we
 *                                          never opt into raw HTML for it.
 *                                          encodeURIComponent must also escape
 *                                          it inside the href.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TagList from '../src/components/TagList.astro';
import type { TagListViewModel } from '../src/components/TagList.types';

async function render(taglist: TagListViewModel): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(TagList as never, { props: { taglist } });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('TagList', () => {
  it('(1) renders nothing when tags is empty (no <section>, no <h1>, no <ul>, no "태그" text)', async () => {
    const html = await render({ tags: [] });
    expect(
      countMatches(html, /<section\b/g),
      'empty tags must NOT emit <section> — an empty container leaks "something was filtered here"',
    ).toBe(0);
    expect(
      countMatches(html, /<h1\b/g),
      'empty tags must NOT emit <h1> — heading without content is the same disclosure',
    ).toBe(0);
    expect(
      countMatches(html, /<ul\b/g),
      'empty tags must NOT emit <ul> — empty list leaks the same signal',
    ).toBe(0);
    expect(
      html,
      '"태그" text must not appear in the empty-state output',
    ).not.toMatch(/태그/);
  });

  it('(2) emits one <a href="/tags/<encoded-tag>"> per tag (encodeURIComponent applied)', async () => {
    const html = await render({
      tags: [
        { tag: 'rust', count: 3 },
        { tag: '한국어', count: 1 },
      ],
    });
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/tags\/rust"/g),
      'tag "rust" must produce exactly one <a href="/tags/rust"> — wrong path breaks tag index routing',
    ).toBe(1);
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/tags\/%ED%95%9C%EA%B5%AD%EC%96%B4"/g),
      'non-ASCII tag must be percent-encoded — encodeURIComponent must be applied to href',
    ).toBe(1);
    expect(
      countMatches(html, /href="\/tag\//g),
      'href must be /tags/ (plural) — adjacent typo /tag/ silently breaks SEO',
    ).toBe(0);
  });

  it('(3) count appears inside each chip exactly once', async () => {
    const html = await render({
      tags: [
        { tag: 'rust', count: 3 },
        { tag: '한국어', count: 1 },
      ],
    });
    expect(
      countMatches(html, />3<\/span>/g),
      'count 3 must appear in exactly one <span> within the rust chip',
    ).toBe(1);
    expect(
      countMatches(html, />1<\/span>/g),
      'count 1 must appear in exactly one <span> within the 한국어 chip',
    ).toBe(1);
  });

  it('(4) exactly one <h1> when non-empty, zero when empty', async () => {
    const empty = await render({ tags: [] });
    expect(countMatches(empty, /<h1\b/g)).toBe(0);

    const populated = await render({ tags: [{ tag: 'rust', count: 1 }] });
    expect(
      countMatches(populated, /<h1\b/g),
      'non-empty tag list must contain exactly one <h1> heading',
    ).toBe(1);
  });

  it('(5) extra fields cast onto TagListViewModel never reach the DOM (allowlist enforcement)', async () => {
    const sneaky = {
      tags: [
        {
          tag: 'visible',
          count: 1,
          slugs: ['DO_NOT_LEAK_BANANA_6f3c1'],
          description: 'PRIVATE_FIELD_PROBE_xyz',
        },
      ],
    } as unknown as TagListViewModel;

    const html = await render(sneaky);
    expect(
      html,
      'slugs field must not leak — privacy CRITICAL (TagSummary is allowlist)',
    ).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(html, 'extra key names must not appear in HTML either').not.toContain('slugs');
    expect(html).not.toContain('description');
    expect(html, 'declared tag still renders').toContain('visible');
  });

  it('(6) tag is HTML-escaped and percent-encoded (no set:html, encodeURIComponent applied)', async () => {
    const html = await render({
      tags: [{ tag: '<script>alert(1)</script>', count: 1 }],
    });
    expect(
      countMatches(html, /<script\b/g),
      'tag containing <script> must be escaped — set:html must NOT be used on tag',
    ).toBe(0);
    expect(
      html,
      'href must percent-encode the tag — raw < or > in href is unsafe',
    ).toMatch(/href="\/tags\/%3Cscript%3E/);
  });

  it('(7) <section> root carries mobile + desktop viewport classes (UI_GUIDE: 인덱스 페이지는 md:max-w-4xl)', async () => {
    const html = await render({ tags: [{ tag: 'rust', count: 1 }] });
    const sectionMatch = html.match(/<section\s[^>]*\bclass="([^"]*)"/);
    expect(sectionMatch, '<section> must carry a class attribute for the viewport-responsive container').not.toBeNull();
    const cls = sectionMatch![1]!;
    for (const token of ['w-full', 'md:max-w-4xl']) {
      expect(
        cls,
        `<section> class must include "${token}" — UI_GUIDE: 홈/태그 인덱스는 max-w-4xl (본문 max-w-3xl보다 넓은 인덱스 폭)`,
      ).toContain(token);
    }
  });
});
