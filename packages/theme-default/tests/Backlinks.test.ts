/**
 * Container-API tests for `<Backlinks />`.
 *
 * Why these six assertions:
 *   - empty entries → silent (1)        : an empty <aside>/<h2> would itself
 *                                         disclose that backlinks were filtered
 *                                         away (private references existed).
 *                                         PRD/UI_GUIDE: do not leak existence.
 *   - n entries → n links (2)           : guards the link-emission contract;
 *                                         href must be exactly `/<slug>` with
 *                                         no trailing slash so the URL pattern
 *                                         matches the rest of the theme.
 *   - exactly one <h2> (3)              : guards the single-region heading
 *                                         outline. Zero when empty, one when
 *                                         non-empty — never two.
 *   - aria-label="백링크" (4)           : accessibility contract; the aside
 *                                         must announce its purpose to AT.
 *   - allowlist enforcement (5)         : the privacy CRITICAL — only `slug`
 *                                         and `title` may reach DOM. Extra
 *                                         keys (body, frontmatter, tags, …)
 *                                         cast onto BacklinksViewModel must
 *                                         NEVER leak through.
 *   - title is escaped, not raw (6)     : guards the no-`set:html` invariant.
 *                                         A title containing `<script>` must
 *                                         be HTML-escaped — Astro's default
 *                                         text interpolation handles this iff
 *                                         we never opt into raw HTML for it.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Backlinks from '../src/components/Backlinks.astro';
import type { BacklinksViewModel } from '../src/components/Backlinks.types';

async function render(backlinks: BacklinksViewModel): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Backlinks as never, { props: { backlinks } });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('Backlinks', () => {
  it('(1) renders nothing when entries is empty (no <aside>, no <h2>, no "백링크" text)', async () => {
    const html = await render({ entries: [] });
    expect(
      countMatches(html, /<aside\b/g),
      'empty entries must NOT emit <aside> — an empty container leaks "something was filtered here"',
    ).toBe(0);
    expect(
      countMatches(html, /<h2\b/g),
      'empty entries must NOT emit <h2> — heading without content is the same disclosure',
    ).toBe(0);
    expect(
      html,
      '"백링크" text must not appear in the empty-state output',
    ).not.toMatch(/백링크/);
  });

  it('(2) emits one <a href="/<slug>"> per entry, with no trailing slash', async () => {
    const html = await render({
      entries: [
        { slug: 'foo', title: 'Foo' },
        { slug: 'bar-baz', title: '바' },
      ],
    });
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/foo"/g),
      'slug "foo" must produce exactly one <a href="/foo"> — wrong path breaks routing',
    ).toBe(1);
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/bar-baz"/g),
      'slug "bar-baz" must produce exactly one <a href="/bar-baz">',
    ).toBe(1);
    expect(
      countMatches(html, /href="\/foo\//g),
      'href must NOT have a trailing slash — theme uses no-trailing-slash convention',
    ).toBe(0);
    expect(countMatches(html, /href="\/bar-baz\//g)).toBe(0);
    expect(html, 'link text must be the title verbatim').toContain('>Foo<');
    expect(html).toContain('>바<');
  });

  it('(3) exactly one <h2> when non-empty, zero when empty', async () => {
    const empty = await render({ entries: [] });
    expect(countMatches(empty, /<h2\b/g)).toBe(0);

    const populated = await render({
      entries: [{ slug: 'a', title: 'A' }],
    });
    expect(
      countMatches(populated, /<h2\b/g),
      'non-empty backlinks must contain exactly one <h2> heading',
    ).toBe(1);
  });

  it('(4) <aside aria-label="백링크"> exactly once when non-empty', async () => {
    const html = await render({
      entries: [{ slug: 'a', title: 'A' }],
    });
    expect(
      countMatches(html, /<aside\s[^>]*\baria-label="백링크"/g),
      'aside must announce its purpose with aria-label="백링크" for screen readers',
    ).toBe(1);
  });

  it('(5) extra fields cast onto BacklinksViewModel never reach the DOM (allowlist enforcement)', async () => {
    const sneaky = {
      entries: [
        {
          slug: 'visible',
          title: 'Visible Title',
          body: 'DO_NOT_LEAK_BANANA_6f3c1',
          frontmatter: { secret: 'PRIVATE_FIELD_PROBE_xyz' },
          tags: ['ANOTHER_PROBE_qrs'],
        },
      ],
    } as unknown as BacklinksViewModel;

    const html = await render(sneaky);
    expect(
      html,
      'body field must not leak — privacy CRITICAL (frontmatter allowlist)',
    ).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(html).not.toContain('ANOTHER_PROBE_qrs');
    expect(html, 'extra key names must not appear in HTML either').not.toContain('body');
    expect(html).not.toContain('frontmatter');
    expect(html).not.toContain('tags');
    expect(html, 'declared title still renders').toContain('Visible Title');
    expect(html, 'declared slug still produces correct href').toMatch(
      /<a\s[^>]*\bhref="\/visible"/,
    );
  });

  it('(6) title is HTML-escaped (no set:html on title)', async () => {
    const html = await render({
      entries: [{ slug: 's', title: '<script>alert(1)</script>' }],
    });
    expect(
      countMatches(html, /<script\b/g),
      'title containing <script> must be escaped — set:html must NOT be used on title',
    ).toBe(0);
    expect(
      html,
      'escaped form (&lt;script&gt;) must appear instead',
    ).toMatch(/&lt;script&gt;/);
  });
});
