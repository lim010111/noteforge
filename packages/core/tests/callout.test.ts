/**
 * Tests for Obsidian-callout rendering.
 *
 * Two surfaces are pinned here:
 *   1. `parseCalloutMarker` — pure parser over the marker line text. Cheap and
 *      exhaustive (alias coverage, fold detection, unknown-type fallback).
 *   2. `renderMdastToHtml` end-to-end — exercises the registered blockquote
 *      handler so a future regression in wiring (e.g. forgetting to pass the
 *      handler into `toHast`) surfaces here, not as a visual diff.
 *
 * Privacy integration (wikilinks / transclusions sitting inside a callout) is
 * covered separately in the vault-mixed integration suite — the unit-level
 * pipeline doesn't run linkRewriter / expandTransclusions, so it cannot prove
 * those passes descend into callout bodies.
 */

import { describe, expect, it } from 'vitest';
import { fromMarkdown } from 'mdast-util-from-markdown';
import {
  CALLOUT_TYPES,
  parseCalloutMarker,
  type CalloutKind,
} from '../src/render/callout.ts';
import { renderMdastToHtml } from '../src/render/htmlFromMdast.ts';

function render(md: string): string {
  return renderMdastToHtml(fromMarkdown(md));
}

describe('parseCalloutMarker', () => {
  it('returns null for non-marker text', () => {
    expect(parseCalloutMarker('just a quote')).toBeNull();
    expect(parseCalloutMarker('[note] no exclamation')).toBeNull();
    expect(parseCalloutMarker('  [!note] leading space')).toBeNull();
  });

  it('extracts kind from canonical type', () => {
    const result = parseCalloutMarker('[!warning] Heads up');
    expect(result).not.toBeNull();
    expect(result?.kind).toBe<CalloutKind>('warning');
    expect(result?.title).toBe('Heads up');
    expect(result?.fold).toBeNull();
  });

  it('collapses aliases to their canonical kind (case-insensitive)', () => {
    // One representative per group — the full alias table is exercised below
    // via the `CALLOUT_TYPES` map.
    expect(parseCalloutMarker('[!tldr]')?.kind).toBe<CalloutKind>('abstract');
    expect(parseCalloutMarker('[!HINT]')?.kind).toBe<CalloutKind>('tip');
    expect(parseCalloutMarker('[!Caution]')?.kind).toBe<CalloutKind>('warning');
    expect(parseCalloutMarker('[!error]')?.kind).toBe<CalloutKind>('danger');
    expect(parseCalloutMarker('[!cite]')?.kind).toBe<CalloutKind>('quote');
  });

  it('falls back to "note" kind for unknown types (Obsidian behaviour)', () => {
    const result = parseCalloutMarker('[!my-custom]');
    expect(result?.kind).toBe<CalloutKind>('note');
    // Raw type is preserved so the renderer can echo the user's spelling.
    expect(result?.rawKind).toBe('my-custom');
  });

  it('detects foldable variants', () => {
    expect(parseCalloutMarker('[!note]+')?.fold).toBe('open');
    expect(parseCalloutMarker('[!note]- collapsed by default')?.fold).toBe('closed');
    expect(parseCalloutMarker('[!note]')?.fold).toBeNull();
  });

  it('treats an empty title as null (renderer applies the default label)', () => {
    expect(parseCalloutMarker('[!note]')?.title).toBeNull();
    expect(parseCalloutMarker('[!note]   ')?.title).toBeNull();
    expect(parseCalloutMarker('[!note]\n')?.title).toBeNull();
  });

  it('reports `consumed` so callers can slice the marker line off the source', () => {
    // No trailing newline — consumed length is the marker + title segment.
    expect(parseCalloutMarker('[!note] hi')?.consumed).toBe('[!note] hi'.length);
    // Trailing newline IS consumed so the body starts cleanly after.
    expect(parseCalloutMarker('[!note] hi\nbody')?.consumed).toBe('[!note] hi\n'.length);
  });

  it('every documented Obsidian alias maps to a canonical CalloutKind', () => {
    // The map is the source-of-truth; this test guards against typos /
    // accidental removal. If a future PR drops an alias, this fails loudly.
    const expectedAliases = [
      'note',
      'abstract',
      'summary',
      'tldr',
      'info',
      'todo',
      'tip',
      'hint',
      'important',
      'success',
      'check',
      'done',
      'question',
      'help',
      'faq',
      'warning',
      'caution',
      'attention',
      'failure',
      'fail',
      'missing',
      'danger',
      'error',
      'bug',
      'example',
      'quote',
      'cite',
    ];
    for (const alias of expectedAliases) {
      expect(CALLOUT_TYPES.has(alias), `missing alias '${alias}'`).toBe(true);
    }
  });
});

describe('renderMdastToHtml — callout integration', () => {
  it('wraps a callout in <div class="callout callout-{kind}"> with data attribute', () => {
    const html = render('> [!warning] Heads up\n> body line');
    expect(html).toMatch(/<div class="callout callout-warning" data-callout="warning">/);
    expect(html).toContain('Heads up');
    expect(html).toContain('body line');
  });

  it('marker line is stripped — the literal `[!warning]` does not leak into HTML', () => {
    const html = render('> [!warning] Heads up\n> body line');
    expect(html).not.toContain('[!warning]');
    expect(html).not.toContain('[!');
  });

  it('renders the default title for known types when no explicit title is given', () => {
    const html = render('> [!note]\n> body');
    expect(html).toContain('>Note<');
  });

  it('echoes the user-spelled type as the default title for unknown kinds', () => {
    // Obsidian shows "My-custom" (raw, capitalised) when the type is unknown —
    // it does NOT silently say "Note".
    const html = render('> [!my-custom]\n> body');
    expect(html).toContain('callout-note'); // styling falls back to note
    expect(html).toContain('data-callout="note"');
    expect(html).toContain('>My-custom<');
  });

  it('foldable `+` emits <details open>, `-` emits closed <details>', () => {
    const open = render('> [!note]+\n> body');
    expect(open).toMatch(/<details[^>]+class="callout callout-note"[^>]+open[^>]*>/);
    expect(open).toContain('<summary');

    const closed = render('> [!note]-\n> body');
    expect(closed).toMatch(/<details[^>]+class="callout callout-note"/);
    // No `open` attribute on the closed variant.
    expect(closed).not.toMatch(/<details[^>]+open/);
    expect(closed).toContain('<summary');
  });

  it('non-foldable callouts use <div> + <div class="callout-title">', () => {
    const html = render('> [!note]\n> body');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('<summary');
    expect(html).toContain('class="callout-title"');
  });

  it('inlines an SVG icon inside the title (Lucide-style line art)', () => {
    const html = render('> [!warning] Hi\n> body');
    expect(html).toMatch(/<svg[^>]+class="callout-icon"[^>]*>/);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('aria-hidden="true"');
    // The icon is structural, not text — assert a path element is emitted.
    expect(html).toMatch(/<path d=/);
  });

  it('plain blockquotes (no marker) keep rendering as <blockquote> — no regression', () => {
    const html = render('> just a regular quote\n> with two lines');
    expect(html).toMatch(/<blockquote>/);
    expect(html).not.toContain('callout');
    expect(html).toContain('just a regular quote');
  });

  it('content after the marker line is preserved as the callout body', () => {
    const html = render('> [!info] Title text\n> body paragraph one\n>\n> body paragraph two');
    expect(html).toContain('class="callout-content"');
    expect(html).toContain('body paragraph one');
    expect(html).toContain('body paragraph two');
  });

  it('marker with no body still renders cleanly (just title)', () => {
    const html = render('> [!success] All good');
    expect(html).toContain('callout-success');
    expect(html).toContain('All good');
    expect(html).toContain('class="callout-content"');
  });

  it('preserves markdown formatting inside the callout body', () => {
    const html = render('> [!info]\n> body with **bold** and `code`');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
  });

  it('nested callout (a callout inside another) renders both as callouts', () => {
    const html = render('> [!info] Outer\n> some prose\n>\n> > [!warning] Inner\n> > inner body');
    // Two callout containers — assert each kind once.
    expect(html).toContain('callout-info');
    expect(html).toContain('callout-warning');
    expect(html).toContain('Inner');
    expect(html).toContain('Outer');
  });

  it('heading-anchor pipeline still runs on content inside a callout', () => {
    // A `### Sub` placed inside a callout body must still receive an id +
    // appended heading anchor — proves the slug/autolink rehype passes walk
    // through the new wrapper elements (they don't gate on parent tagName).
    const html = render('> [!note]\n>\n> ### Sub heading');
    expect(html).toMatch(/<h3\b[^>]*\bid="sub-heading"/);
    expect(html).toMatch(/<a\s[^>]*\bclass="heading-anchor"/);
  });
});
