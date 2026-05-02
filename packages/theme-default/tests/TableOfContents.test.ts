/**
 * Container-API tests for `<TableOfContents />`.
 *
 * Six assertions, each guarding a distinct contract:
 *   - empty headings (1)         : no markup at all — empty <aside> would still
 *                                  claim grid column space at xl+
 *   - h2 + h3 grouping (2)       : flat list reshaped into nested <ul> tree
 *                                  with h3 hung under the most-recent h2
 *   - href byte equality (3)     : every link's `#…` matches the heading id
 *                                  exactly — drift would 404 in-page jumps
 *   - HTML escape on text (4)    : malicious heading text must not surface as
 *                                  raw HTML — interpolation, never set:html
 *   - maxDepth filter (5)        : maxDepth: 2 hides h3 entries; defaults to 3
 *                                  so h4 stays out without an explicit prop
 *   - script ships (6)           : the IntersectionObserver scroll-spy script
 *                                  is bundled — Container does not run it,
 *                                  but its absence in HTML would mean the
 *                                  enhancement never reaches the browser
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import TableOfContents from '../src/components/TableOfContents.astro';

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(TableOfContents as never, { props });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('TableOfContents', () => {
  it('(1) empty headings → renders nothing (no <aside>, no <nav>, no <ul>)', async () => {
    const html = await render({ headings: [] });
    expect(html).not.toMatch(/<aside\b/);
    expect(html).not.toMatch(/<nav\b/);
    expect(html).not.toMatch(/<ul\b/);
    expect(html).not.toMatch(/note-toc/);
  });

  it('(2) two h2 + one h3 → exactly one <aside>, two top-level <li>, one nested <ul.note-toc__sublist>', async () => {
    const html = await render({
      headings: [
        { id: 'intro', depth: 2, text: 'Introduction' },
        { id: 'shift', depth: 2, text: 'The Shift' },
        { id: 'perf', depth: 3, text: 'Performance Benefits' },
      ],
    });
    expect(countMatches(html, /<aside\b[^>]*\bclass="[^"]*\bnote-toc-rail\b/g)).toBe(1);
    expect(countMatches(html, /<ul\b[^>]*\bclass="note-toc__list\b/g)).toBe(1);
    expect(countMatches(html, /<ul\b[^>]*\bclass="note-toc__sublist\b/g)).toBe(1);
    // Anchor on `<li class="note-toc__item` to count list items regardless of
    // whether they also carry the `--sub` modifier; bare `note-toc__item`
    // appears inside the modifier substring too, which would inflate the count.
    expect(countMatches(html, /<li\s+class="note-toc__item/g)).toBe(3);
    // Sub-link carries the modifier so the connector pseudo-element kicks in.
    expect(countMatches(html, /\bnote-toc__link--sub\b/g)).toBe(1);
  });

  it('(3) every link href is "#" + id, byte-for-byte (no leading slash, no encoding drift)', async () => {
    const html = await render({
      headings: [
        { id: 'plain', depth: 2, text: 'Plain' },
        { id: '한글-슬러그', depth: 3, text: '한글 슬러그' },
        { id: 'foo-1', depth: 2, text: 'Foo' },
      ],
    });
    expect(html).toMatch(/<a\s[^>]*\bhref="#plain"/);
    // Non-ASCII id passes through unchanged — rehype-slug already preserves
    // the unicode form; the theme must not normalize it differently.
    expect(html).toMatch(/<a\s[^>]*\bhref="#한글-슬러그"/);
    expect(html).toMatch(/<a\s[^>]*\bhref="#foo-1"/);
  });

  it('(4) heading text containing < is HTML-escaped, never injected as raw HTML', async () => {
    const html = await render({
      headings: [
        { id: 'oops', depth: 2, text: '<script>alert(1)</script>' },
      ],
    });
    expect(
      html,
      'raw <script> appearing in TOC text would be a stored-XSS path — Astro auto-escape must be in force',
    ).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(html).toContain('&lt;script&gt;');
  });

  it('(5) maxDepth: 2 filters h3 entries; default (3) keeps them and excludes h4', async () => {
    const headings = [
      { id: 'a', depth: 2 as const, text: 'A' },
      { id: 'b', depth: 3 as const, text: 'B' },
      { id: 'c', depth: 4 as const, text: 'C' },
    ];
    const def = await render({ headings });
    expect(def).toContain('href="#a"');
    expect(def).toContain('href="#b"');
    // h4 hidden by default to keep the visual hierarchy at 2 levels.
    expect(def).not.toContain('href="#c"');

    const shallow = await render({ headings, maxDepth: 2 });
    expect(shallow).toContain('href="#a"');
    expect(shallow).not.toContain('href="#b"');
    expect(shallow).not.toContain('href="#c"');
  });

  it('(6) component ships a <script type="module"> + emits data-toc-id hooks the script will read', async () => {
    // Astro processes non-`is:inline` <script> tags by emitting a module
    // reference that the bundler resolves; the source itself does not appear
    // in the SSR output. We assert two surrogates instead: (a) a module-script
    // tag for the component, proving the script export reached the bundler,
    // and (b) the `data-toc-id` data attribute on every link, which is the
    // only contract the script-side code needs from the rendered DOM.
    const html = await render({
      headings: [{ id: 'x', depth: 2, text: 'X' }],
    });
    expect(html).toMatch(
      /<script\s[^>]*\btype="module"[^>]*\bsrc="[^"]*TableOfContents\.astro/,
    );
    expect(html).toMatch(/<a\s[^>]*\bdata-toc-id="x"/);
  });

  it('(7) custom title prop replaces the default "목차" label', async () => {
    const html = await render({
      headings: [{ id: 'x', depth: 2, text: 'X' }],
      title: 'On This Page',
    });
    expect(html).toContain('On This Page');
    expect(html).not.toContain('목차');
  });
});
