/**
 * Tests for `parseMarkdownToMdast` — the GFM + math + Obsidian-transform
 * parsing seam — exercised through `renderMdastToHtml` so the assertions pin
 * the *published HTML*, which is what the reported bug was about.
 *
 * Covers: GFM footnotes (the reported `[^1]` bug), Obsidian inline footnotes
 * `^[…]`, tables, strikethrough, task lists + extended checkbox states,
 * autolink literals, `==highlight==`, lang-aware footnote labels, and the
 * structural-recursion privacy guarantee (wikilinks nested in the new nodes
 * still pass through `rewriteWikilinks`).
 */

import { describe, expect, it } from 'vitest';
import { parseMarkdownToMdast } from '../src/render/parseMarkdown.ts';
import { renderMdastToHtml } from '../src/render/htmlFromMdast.ts';
import { rewriteWikilinks } from '../src/privacy/linkRewriter.ts';

function render(md: string, lang?: string): string {
  return renderMdastToHtml(parseMarkdownToMdast(md), lang === undefined ? {} : { lang });
}

describe('GFM footnotes — the reported bug', () => {
  it('a `[^1]` reference with a definition renders a footnote, not literal text', () => {
    const html = render('Body text.[^1]\n\n[^1]: The footnote.');
    expect(html, 'raw footnote syntax must not survive to HTML').not.toContain('[^1]');
    expect(html).toMatch(/data-footnote-ref/);
    expect(html).toContain('The footnote.');
  });

  it('emits a footnotes section with the definition body', () => {
    const html = render('See note.[^a]\n\n[^a]: Detailed explanation here.');
    expect(html).toMatch(/<section[^>]*\bclass="footnotes"/);
    expect(html).toContain('Detailed explanation here.');
  });
});

describe('Obsidian inline footnotes', () => {
  it('`^[inline text]` becomes a footnote reference + definition', () => {
    const html = render('A claim^[the inline source] stands.');
    expect(html, 'inline footnote syntax must not survive').not.toContain('^[');
    expect(html).toMatch(/data-footnote-ref/);
    expect(html).toContain('the inline source');
  });

  it('numbers multiple inline footnotes independently', () => {
    const html = render('One^[first] and two^[second].');
    expect(html).toContain('first');
    expect(html).toContain('second');
    expect(html.match(/data-footnote-ref/g) ?? []).toHaveLength(2);
  });
});

describe('GFM block elements', () => {
  it('renders a table wrapped in a horizontal-scroll container', () => {
    const html = render('| A | B |\n| - | - |\n| 1 | 2 |');
    expect(html).toContain('<table>');
    expect(html).toMatch(/<div[^>]*\bclass="table-scroll"/);
    expect(html).toContain('<th>A</th>');
  });

  it('renders strikethrough `~~text~~` as <del>', () => {
    expect(render('This is ~~wrong~~ fixed.')).toContain('<del>wrong</del>');
  });

  it('turns a bare URL into a link (autolink literal)', () => {
    const html = render('Visit https://example.com today.');
    expect(html).toMatch(/<a[^>]*href="https:\/\/example\.com"/);
  });
});

describe('task lists', () => {
  it('GFM `[ ]` / `[x]` items get a data-task state', () => {
    const html = render('- [ ] todo\n- [x] done');
    expect(html).toMatch(/data-task=" "/);
    expect(html).toMatch(/data-task="x"/);
  });

  it('an extended state `[/]` is recognized and stripped from the text', () => {
    const html = render('- [/] in progress');
    expect(html).toMatch(/data-task="\/"/);
    expect(html, 'the [/] marker must not render as literal text').not.toContain('[/]');
    expect(html).toContain('in progress');
  });

  it('an unusual state `[?]` is still captured generically', () => {
    const html = render('- [?] uncertain');
    expect(html).toMatch(/data-task="\?"/);
    expect(html).not.toContain('[?]');
  });
});

describe('Obsidian highlight', () => {
  it('`==text==` becomes a <mark>', () => {
    expect(render('A ==key point== here.')).toContain('<mark>key point</mark>');
  });

  it('does not highlight `== spaced ==` (whitespace adjacent to delimiters)', () => {
    expect(render('Not == a highlight == really.')).not.toContain('<mark>');
  });

  it('leaves `==` inside inline code untouched', () => {
    expect(render('Use `a == b` to compare.')).not.toContain('<mark>');
  });
});

describe('lang-aware footnote labels', () => {
  it('defaults to the English "Footnotes" label', () => {
    const html = render('x[^1]\n\n[^1]: y');
    expect(html).toContain('Footnotes');
  });

  it('uses the Korean label when lang is ko', () => {
    const html = render('x[^1]\n\n[^1]: y', 'ko');
    expect(html).toContain('각주');
    expect(html).not.toContain('Footnotes');
  });
});

describe('privacy — new nodes still flow through linkRewriter', () => {
  function renderWithPrivateLinks(md: string): string {
    const tree = parseMarkdownToMdast(md);
    rewriteWikilinks({
      tree,
      resolve: (raw) => ({ resolved: true, targetId: raw.toLowerCase() }),
      isPublic: () => false, // every target is private
      hrefFor: (id) => `/${id}`,
    });
    return renderMdastToHtml(tree);
  }

  it('strips a private wikilink nested inside a `==highlight==`', () => {
    const html = renderWithPrivateLinks('Text ==see [[Secret]]== end.');
    expect(html).toContain('<mark>');
    expect(html, 'private target must not become a link').not.toMatch(/<a[^>]*href="\/secret"/);
    expect(html, 'private note id must not leak as href').not.toContain('href="/secret"');
  });

  it('strips a private wikilink nested inside a footnote definition', () => {
    const html = renderWithPrivateLinks('Claim.[^1]\n\n[^1]: source is [[Secret]] here.');
    expect(html).toMatch(/data-footnote-ref/);
    expect(html).not.toContain('href="/secret"');
  });

  it('strips a private wikilink nested inside a table cell', () => {
    const html = renderWithPrivateLinks('| Col |\n| - |\n| [[Secret]] |');
    expect(html).toContain('<table>');
    expect(html).not.toContain('href="/secret"');
  });
});
