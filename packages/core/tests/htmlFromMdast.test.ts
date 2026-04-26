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
  renderMdastToHtml,
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
