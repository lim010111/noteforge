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
import { renderMdastToHtml } from '../src/render/htmlFromMdast.ts';

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
});
