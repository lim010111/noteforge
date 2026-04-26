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

  it('(5) skip link is the first child of <body> and carries the .skip-link class', async () => {
    const html = await render({ title: 'T' });
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    expect(bodyMatch, '<body> must be present in the rendered document').not.toBeNull();
    const bodyInner = bodyMatch![1]!.replace(/^\s+/, '');
    expect(
      bodyInner,
      'skip link must be the FIRST element inside <body> so a fresh Tab press lands on it (UI_GUIDE: keyboard-first a11y)',
    ).toMatch(/^<a\b[^>]*\bhref="#main"/);
    expect(
      bodyInner,
      'skip link must carry the .skip-link class — visually-hidden until focused (layout.css)',
    ).toMatch(/^<a\b[^>]*\bclass="skip-link"/);
  });

  it('(6) <main> root carries the v0.2 site-main container class', async () => {
    const html = await render({ title: 'T' });
    const mainMatch = html.match(/<main\s[^>]*\bclass="([^"]*)"/);
    expect(mainMatch, '<main> must carry a class attribute for the v0.2 layout container').not.toBeNull();
    const cls = mainMatch![1]!;
    expect(
      cls,
      '<main> class must include "site-main" — owns max-width / padding via layout.css tokens (TOKENS.md: --container-main, --space-4/5/8)',
    ).toContain('site-main');
  });

  it('(7) emits og:url, og:type, og:title (and conditionally og:description, og:site_name) when canonicalUrl is provided', async () => {
    const html = await render({
      title: 'Article Title',
      description: 'A short note.',
      canonicalUrl: 'https://example.com/posts/hello',
      ogType: 'article',
      siteName: 'shine notes',
    });
    expect(
      countMatches(html, /<meta\s+property="og:url"\s+content="https:\/\/example\.com\/posts\/hello"/g),
      'canonicalUrl must surface as <meta property="og:url"> for OpenGraph crawlers (Facebook, Slack, Discord) — without it, link unfurls fall back to <title> only',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:type"\s+content="article"/g),
      'ogType="article" must be reflected verbatim — note pages need og:type=article so social cards render with article-style framing',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:title"\s+content="Article Title"/g),
      'props.title must echo into og:title byte-for-byte — the unfurl preview shows this exact string',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:description"\s+content="A short note\."/g),
      'description prop must mirror into og:description when present — same content as <meta name="description">',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:site_name"\s+content="shine notes"/g),
      'siteName prop must mirror into og:site_name when present — distinguishes which site the article belongs to in the unfurl',
    ).toBe(1);
  });

  it('(8) emits zero og:* meta when canonicalUrl is omitted (gates on canonicalUrl, mirroring the <link rel="canonical"> guard pattern)', async () => {
    const html = await render({
      title: 'T',
      description: 'desc',
      ogType: 'article',
      siteName: 'shine notes',
    });
    expect(
      countMatches(html, /<meta\s+property="og:[^"]+"/g),
      'no canonicalUrl ⇒ no OpenGraph meta of any kind — pages without a stable absolute URL (e.g. 404) must not emit partial OG metadata',
    ).toBe(0);
  });

  it('(9) defaults ogType to "website" when canonicalUrl is provided but ogType is omitted', async () => {
    const html = await render({
      title: 'Home',
      canonicalUrl: 'https://example.com/',
    });
    expect(
      countMatches(html, /<meta\s+property="og:type"\s+content="website"/g),
      'ogType default must be "website" — index/tag/graph pages are not articles',
    ).toBe(1);
  });

  it('(10) emits exactly one <link rel="canonical"> (regression: must not be duplicated by the OG block)', async () => {
    const html = await render({
      title: 'T',
      canonicalUrl: 'https://example.com/posts/hello',
    });
    expect(
      countMatches(html, /<link\s+rel="canonical"/g),
      '<link rel="canonical"> must be emitted exactly once — search engines treat duplicate canonicals as a signal to ignore the page (or pick arbitrarily)',
    ).toBe(1);
  });

  it('(11) header carries a labelled <nav aria-label="주 메뉴"> for screen readers', async () => {
    const html = await render({ title: 'T' });
    const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/);
    expect(headerMatch, 'BaseLayout must render a <header> region').not.toBeNull();
    expect(
      headerMatch![1]!,
      'header must contain a <nav> with aria-label so AT users can jump to primary navigation',
    ).toMatch(/<nav[^>]*\baria-label="[^"]+"/);
  });

  it('(12) inlines themeInitScript inside <head> (FOUC prevention runs before <body> paints)', async () => {
    const html = await render({ title: 'T' });
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
    expect(headMatch, 'BaseLayout must render a <head> region').not.toBeNull();
    const headInner = headMatch![1]!;
    expect(
      headInner,
      'theme-init must be inlined as <script> inside <head> — external/deferred scripts cannot prevent FOUC',
    ).toMatch(/<script\b[^>]*>[^<]*localStorage\.getItem\("theme"\)[^<]*<\/script>/);
  });

  it('(13) does NOT set [data-theme] on <html> in the SSR result (sync inline script owns first paint)', async () => {
    const html = await render({ title: 'T' });
    const openTag = html.match(/<html[^>]*>/);
    expect(openTag, '<html> open tag must be present').not.toBeNull();
    expect(
      openTag![0]!,
      'SSR must NOT bake a data-theme attribute — that responsibility belongs solely to the inline FOUC script reading localStorage at runtime',
    ).not.toMatch(/\bdata-theme=/);
  });

  it('(14) renders a theme-toggle button + a JS-less <details> mobile menu', async () => {
    const html = await render({ title: 'T' });
    expect(
      html,
      'theme toggle button must exist and carry an accessible label',
    ).toMatch(/<button\b[^>]*\bid="theme-toggle"[^>]*\baria-label="[^"]+"/);
    expect(
      html,
      'mobile menu must use semantic <details> so it works without JS',
    ).toMatch(/<details\b[^>]*\bclass="[^"]*\bmobile-menu\b/);
  });

  it('(7) emits og:url, og:type, og:title (and conditionally og:description, og:site_name) when canonicalUrl is provided', async () => {
    const html = await render({
      title: 'Article Title',
      description: 'A short note.',
      canonicalUrl: 'https://example.com/posts/hello',
      ogType: 'article',
      siteName: 'shine notes',
    });
    expect(
      countMatches(html, /<meta\s+property="og:url"\s+content="https:\/\/example\.com\/posts\/hello"/g),
      'canonicalUrl must surface as <meta property="og:url"> for OpenGraph crawlers (Facebook, Slack, Discord) — without it, link unfurls fall back to <title> only',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:type"\s+content="article"/g),
      'ogType="article" must be reflected verbatim — note pages need og:type=article so social cards render with article-style framing',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:title"\s+content="Article Title"/g),
      'props.title must echo into og:title byte-for-byte — the unfurl preview shows this exact string',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:description"\s+content="A short note\."/g),
      'description prop must mirror into og:description when present — same content as <meta name="description">',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:site_name"\s+content="shine notes"/g),
      'siteName prop must mirror into og:site_name when present — distinguishes which site the article belongs to in the unfurl',
    ).toBe(1);
  });

  it('(8) emits zero og:* meta when canonicalUrl is omitted (gates on canonicalUrl, mirroring the <link rel="canonical"> guard pattern)', async () => {
    const html = await render({
      title: 'T',
      description: 'desc',
      ogType: 'article',
      siteName: 'shine notes',
    });
    expect(
      countMatches(html, /<meta\s+property="og:[^"]+"/g),
      'no canonicalUrl ⇒ no OpenGraph meta of any kind — pages without a stable absolute URL (e.g. 404) must not emit partial OG metadata',
    ).toBe(0);
  });

  it('(9) defaults ogType to "website" when canonicalUrl is provided but ogType is omitted', async () => {
    const html = await render({
      title: 'Home',
      canonicalUrl: 'https://example.com/',
    });
    expect(
      countMatches(html, /<meta\s+property="og:type"\s+content="website"/g),
      'ogType default must be "website" — index/tag/graph pages are not articles',
    ).toBe(1);
  });

  it('(10) emits exactly one <link rel="canonical"> (regression: must not be duplicated by the OG block)', async () => {
    const html = await render({
      title: 'T',
      canonicalUrl: 'https://example.com/posts/hello',
    });
    expect(
      countMatches(html, /<link\s+rel="canonical"/g),
      '<link rel="canonical"> must be emitted exactly once — search engines treat duplicate canonicals as a signal to ignore the page (or pick arbitrarily)',
    ).toBe(1);
  });

  it('(15) without sidebarRoots, layout stays single-column — no .site-shell, no <aside>', async () => {
    const html = await render({ title: 'T' });
    expect(
      countMatches(html, /\bclass="site-shell"/g),
      'absent sidebarRoots ⇒ no .site-shell wrapper — pages without a sidebar must render the pre-existing single-column structure (zero regression)',
    ).toBe(0);
    expect(
      countMatches(html, /<aside\b/g),
      'absent sidebarRoots ⇒ no <aside> in the document — the sidebar is opt-in',
    ).toBe(0);
  });

  it('(16) with sidebarRoots, renders <aside> in both desktop and mobile-menu positions', async () => {
    const html = await render({
      title: 'T',
      sidebarRoots: [
        { kind: 'leaf', slug: 'hello', label: 'Hello' },
      ],
    });
    expect(
      html,
      'sidebarRoots present ⇒ .site-shell wraps <main> and the desktop sidebar column',
    ).toMatch(/\bclass="site-shell"/);
    // Two <aside> instances: desktop + mobile-menu copy
    expect(
      countMatches(html, /<aside\s[^>]*\bclass="folder-tree"/g),
      'sidebar must render at two SSR positions: the .site-shell column (desktop) and the .mobile-menu__panel (mobile) — both pure SSR, no JS to move it',
    ).toBe(2);
  });

  it('(17) propagates currentSlug → aria-current="page" on the matching leaf', async () => {
    const html = await render({
      title: 'T',
      sidebarRoots: [
        {
          kind: 'folder',
          path: 'a',
          label: 'A',
          noteCount: 1,
          children: [{ kind: 'leaf', slug: 'a/x', label: 'X' }],
        },
      ],
      currentSlug: 'a/x',
    });
    // aria-current appears once per sidebar copy (desktop + mobile) = 2
    expect(countMatches(html, /\baria-current="page"/g)).toBe(2);
  });

  it('(18) ignores empty sidebarRoots — falls through to single-column', async () => {
    const html = await render({ title: 'T', sidebarRoots: [] });
    expect(countMatches(html, /\bclass="site-shell"/g)).toBe(0);
    expect(countMatches(html, /<aside\b/g)).toBe(0);
  });
});
