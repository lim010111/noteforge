/**
 * Unit tests for `renderMdastToHtml` — the helper that pipeline.ts uses to
 * serialize each public note's mdast tree to HTML with v0.2 heading anchors.
 *
 * These tests do NOT exercise the full pipeline; they pin the rehype contract
 * (which tags get an id, which get an appended anchor, etc.) so a future
 * dependency bump or option tweak surfaces here instead of via a visual diff.
 */

import { describe, expect, it } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toHtml } from 'hast-util-to-html';
import type { Root as HastRoot } from 'hast';
import {
  applyHeadingAnchors,
  collectHeadings,
  renderMdastToHtml,
  renderMdastToHtmlWithHeadings,
} from '../src/render/htmlFromMdast.ts';

function render(md: string): string {
  return renderMdastToHtml(fromMarkdown(md));
}

describe('renderMdastToHtml', () => {
  it('h2 receives an id derived from heading text', () => {
    const html = render('## Hello World');
    expect(html).toMatch(/<h2\b[^>]*\bid="hello-world"/);
  });

  it('h2 receives an appended <a class="heading-anchor"> with #-text content', () => {
    const html = render('## Section');
    // Three independent assertions instead of one super-regex: attribute order
    // is plugin-internal and may shift across rehype-autolink-headings versions,
    // but the contract (anchor appended after heading text, links to #id, has
    // visible "#" content) is what matters.
    expect(html).toMatch(/<h2\b[^>]*>Section<a\s/);
    expect(html).toMatch(/<a\s[^>]*\bclass="heading-anchor"[^>]*\bhref="#section"/);
    expect(html).toMatch(/>#<\/a><\/h2>/);
  });

  it('h3 and h4 also receive id + heading-anchor', () => {
    expect(render('### Sub')).toMatch(/<h3\b[^>]*\bid="sub"/);
    expect(render('### Sub')).toMatch(/<a\s[^>]*\bclass="heading-anchor"/);
    expect(render('#### Subsub')).toMatch(/<h4\b[^>]*\bid="subsub"/);
    expect(render('#### Subsub')).toMatch(/<a\s[^>]*\bclass="heading-anchor"/);
  });

  it('h1 does NOT receive a heading-anchor (page URL already identifies it)', () => {
    const html = render('# Top');
    expect(html).toMatch(/<h1\b[^>]*\bid="top"/);
    expect(
      html,
      'h1 self-anchor would just be self-replication — autolink test gates h2-h4 only',
    ).not.toContain('heading-anchor');
  });

  it('paragraphs without headings render normally', () => {
    const html = render('plain paragraph');
    expect(html).toBe('<p>plain paragraph</p>');
  });

  it('aria-label="permalink" lands on every appended anchor', () => {
    const html = render('## Section');
    expect(html).toMatch(/<a\s[^>]*\baria-label="permalink"/);
  });

  it('is idempotent — re-running heading-anchor visitors does not stack a second anchor', () => {
    // Build a hast tree that already carries the anchor structure
    // applyHeadingAnchors would have produced. Running the visitor on it must
    // be a no-op for the heading: still exactly one `.heading-anchor` child,
    // same id. Without the guard in `htmlFromMdast.ts`'s `test` predicate,
    // rehype-autolink-headings would append a second anchor, doubling them on
    // every re-render path (e.g. partial-tree updates, future caching
    // experiments, or a test that round-trips HTML→hast→HTML).
    const tree: HastRoot = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'h2',
          properties: { id: 'section' },
          children: [
            { type: 'text', value: 'Section' },
            {
              type: 'element',
              tagName: 'a',
              properties: {
                className: ['heading-anchor'],
                href: '#section',
                'aria-label': 'permalink',
              },
              children: [{ type: 'text', value: '#' }],
            },
          ],
        },
      ],
    };
    applyHeadingAnchors(tree);
    const html = toHtml(tree);
    const anchorCount = (html.match(/class="heading-anchor"/g) ?? []).length;
    expect(anchorCount).toBe(1);
    expect(html).toMatch(/<h2\b[^>]*\bid="section"/);
  });
});

describe('collectHeadings / renderMdastToHtmlWithHeadings', () => {
  function headings(md: string) {
    return renderMdastToHtmlWithHeadings(fromMarkdown(md)).headings;
  }

  it('returns empty array for an empty tree', () => {
    expect(collectHeadings({ type: 'root', children: [] })).toEqual([]);
  });

  it('extracts h2 with id + plain text', () => {
    expect(headings('## Hello World')).toEqual([
      { depth: 2, id: 'hello-world', text: 'Hello World' },
    ]);
  });

  it('extracts h3 and h4, ignores h1', () => {
    expect(headings('# Top\n\n## Two\n\n### Three\n\n#### Four')).toEqual([
      { depth: 2, id: 'two', text: 'Two' },
      { depth: 3, id: 'three', text: 'Three' },
      { depth: 4, id: 'four', text: 'Four' },
    ]);
  });

  it('flattens inline emphasis / inline code into the heading text', () => {
    // The hast tree produced by mdast-util-to-hast for `**Bold** \`code\``
    // wraps the words in <strong> / <code>. The collected text must walk
    // through those wrappers and concatenate visible text only.
    expect(headings('## **Bold** `code` plain')).toEqual([
      { depth: 2, id: 'bold-code-plain', text: 'Bold code plain' },
    ]);
  });

  it('excludes the appended heading-anchor "#" from the collected text', () => {
    // Without skipping the autolink child, every TOC entry would end with "#".
    // collectHeadings runs AFTER applyHeadingAnchors, so the anchor exists in
    // the tree at collection time — proving the skip is real.
    const result = headings('## Section');
    expect(result[0]?.text).toBe('Section');
    expect(result[0]?.text.endsWith('#')).toBe(false);
  });

  it('reflects rehype-slug dedup for duplicate heading text', () => {
    // Two headings with identical text: rehype-slug appends -1 to the second
    // id. The TOC must mirror this so its hrefs match the actual anchor ids.
    expect(headings('## Foo\n\n## Foo')).toEqual([
      { depth: 2, id: 'foo', text: 'Foo' },
      { depth: 2, id: 'foo-1', text: 'Foo' },
    ]);
  });

  it('renderMdastToHtmlWithHeadings returns html identical to renderMdastToHtml', () => {
    // Backwards-compat guarantee: the new entrypoint must not regress the old
    // one's output. Both call the same hast pipeline; only the second return
    // value is added.
    const md = '## Alpha\n\nbody\n\n### Beta';
    const tree = fromMarkdown(md);
    const oldHtml = renderMdastToHtml(fromMarkdown(md));
    const { html } = renderMdastToHtmlWithHeadings(tree);
    expect(html).toBe(oldHtml);
  });

  it('returns empty headings for a tree with only paragraphs', () => {
    expect(headings('plain text only')).toEqual([]);
  });
});
