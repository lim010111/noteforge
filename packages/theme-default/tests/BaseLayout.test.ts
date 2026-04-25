/**
 * Container-API tests for `<BaseLayout />`.
 *
 * Why these five assertions and not more:
 *   - lang default + override (1)  : guards the `lang` prop contract that downstream
 *                                    pages rely on (Korean default, override allowed).
 *   - <title> echo (2)             : guards that the explicit title prop reaches <head>;
 *                                    a missing title is the most user-visible regression.
 *   - description meta presence (3): guards both the present and absent branches —
 *                                    rendering an empty meta tag when description is
 *                                    omitted would silently leak an empty SEO surface.
 *   - single <main id="main"> (4)  : guards the screen-reader contract — multiple
 *                                    <main> regions are an accessibility violation.
 *   - skip link is body[0] (5)     : guards keyboard a11y — the skip link must be the
 *                                    first focusable element when Tab is pressed.
 *
 * The Astro Container API is intentionally minimal — we render to a string and grep
 * the resulting HTML. We do NOT instantiate jsdom for two reasons: (a) it pulls in a
 * heavy dependency for trivial assertions, (b) any quirky tag the compiler emits is
 * exactly what the browser will see, so string assertions match production reality.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import BaseLayout from '../src/layouts/BaseLayout.astro';

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(BaseLayout as never, { props });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('BaseLayout', () => {
  it('(1) defaults lang to "ko" and respects an explicit override', async () => {
    const defaultHtml = await render({ title: 'T' });
    expect(
      defaultHtml,
      'BaseLayout must default to lang="ko" — Korean is the primary audience for this OSS (CLAUDE.md / UI_GUIDE)',
    ).toMatch(/<html[^>]*\blang="ko"/);

    const overrideHtml = await render({ title: 'T', lang: 'en' });
    expect(
      overrideHtml,
      'lang prop must override the default — multilingual sites need to flip the html lang attribute per page',
    ).toMatch(/<html[^>]*\blang="en"/);
  });

  it('(2) <title> echoes props.title verbatim', async () => {
    const html = await render({ title: 'Hello, 안녕' });
    expect(
      html,
      '<title> must contain props.title byte-for-byte (including non-ASCII) — anything else means the layout is mangling the document head',
    ).toContain('<title>Hello, 안녕</title>');
  });

  it('(3) renders <meta name="description"> exactly once when description is provided, zero times otherwise', async () => {
    const without = await render({ title: 'T' });
    expect(
      countMatches(without, /<meta\s+name="description"/g),
      'a missing description prop must NOT emit <meta name="description"> — empty/blank meta tags are an SEO smell and a frontmatter-leak risk',
    ).toBe(0);

    const withDesc = await render({ title: 'T', description: 'A short note.' });
    expect(
      countMatches(withDesc, /<meta\s+name="description"\s+content="A short note\."/g),
      'description prop must emit exactly one <meta name="description" content="..."> with the verbatim value',
    ).toBe(1);
  });

  it('(4) emits exactly one <main> element with id="main"', async () => {
    const html = await render({ title: 'T' });
    const openTags = countMatches(html, /<main\b/g);
    expect(
      openTags,
      'document must contain exactly one <main> region — multiple <main> elements are an accessibility violation (WCAG 2.4.1) and confuse screen readers',
    ).toBe(1);
    expect(
      html,
      '<main> must carry id="main" so the skip link target resolves',
    ).toMatch(/<main[^>]*\bid="main"/);
  });

  it('(5) skip link <a href="#main"> is the first child of <body>', async () => {
    const html = await render({ title: 'T' });
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    expect(bodyMatch, '<body> must be present in the rendered document').not.toBeNull();
    const bodyInner = bodyMatch![1]!.replace(/^\s+/, '');
    expect(
      bodyInner,
      'skip link must be the FIRST element inside <body> so a fresh Tab press lands on it (UI_GUIDE: keyboard-first a11y)',
    ).toMatch(/^<a\b[^>]*\bhref="#main"/);
  });
});
