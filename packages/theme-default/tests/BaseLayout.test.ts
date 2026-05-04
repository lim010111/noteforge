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
import type { FolderNode } from '../src/lib/folderTree.types';
import { CATEGORY_ACCENT_SLOT_COUNT } from '../src/lib/categoryAccent';

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(BaseLayout as never, { props });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

/**
 * Sidebar fixture used by step-5 layout integration tests. Mirrors the
 * fixture in tests/Sidebar.test.ts (depth 3, mixed folders + leaf notes)
 * — kept identical so the same DOM contract is exercised end-to-end.
 */
function buildSidebarTree(): FolderNode {
  return {
    name: '',
    path: '',
    children: [
      {
        name: 'AI',
        path: 'AI',
        children: [
          {
            name: 'Claude',
            path: 'AI/Claude',
            children: [],
            notes: [{ slug: 'AI/Claude/agents', title: 'agents' }],
            noteCount: 1,
          },
        ],
        notes: [],
        noteCount: 1,
      },
      {
        name: 'posts',
        path: 'posts',
        children: [],
        notes: [
          { slug: 'posts/a', title: 'a' },
          { slug: 'posts/b', title: 'b' },
        ],
        noteCount: 2,
      },
    ],
    notes: [{ slug: 'about', title: 'about' }],
    noteCount: 4,
  };
}

function findDuplicateIds(html: string): string[] {
  const ids: string[] = [];
  const re = /\bid="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1] !== undefined) ids.push(m[1]);
  }
  const seen = new Map<string, number>();
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  const dupes: string[] = [];
  for (const [id, count] of seen) if (count > 1) dupes.push(id);
  return dupes;
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

  it('(11a) primary nav links target trailing-slash routes (matches site trailingSlash:"always")', async () => {
    const html = await render({ title: 'T' });
    for (const href of ['/categories/', '/about/']) {
      expect(
        html,
        `nav link to ${href} must include the trailing slash — without it Astro's trailingSlash:"always" policy serves a 404 redirect prompt instead of the page`,
      ).toMatch(new RegExp(`<a\\s[^>]*\\bhref="${href.replace(/\//g, '\\/')}"`));
    }
    expect(
      html,
      'no internal nav link should target a slashless category/about path',
    ).not.toMatch(/<a\s[^>]*\bhref="\/(categories|about)"/);
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

  // ── v0.3 sidebar integration (step 5) ────────────────────────────────────

  it('(15) sidebar prop omitted → no <aside class="sidebar"> in output, single-column shell preserved (v0.2 regression guard)', async () => {
    const html = await render({ title: 'T' });
    expect(
      countMatches(html, /<aside\s[^>]*\bclass="sidebar"/g),
      'sidebar prop is OPTIONAL — when omitted, BaseLayout must NOT render any <aside class="sidebar">. Forks that opt out of v0.3 navigation must keep the v0.2 single-column layout exactly.',
    ).toBe(0);
    expect(
      html,
      'no sidebar prop ⇒ no .site-shell--with-sidebar grid class — the wrapper stays a plain block-flow container so site-main keeps its v0.2 centering',
    ).not.toMatch(/site-shell--with-sidebar/);
    expect(
      html,
      'no sidebar prop ⇒ <body> must not carry the .has-sidebar class (a class drives the lg+ mobile-menu breakpoint shift; absent for v0.2)',
    ).not.toMatch(/<body[^>]*\bclass="[^"]*\bhas-sidebar\b/);
  });

  it('(16) sidebar prop provided → exactly two <aside class="sidebar"> (lg+ column + mobile drawer copy), no duplicate static ids', async () => {
    const html = await render({
      title: 'T',
      sidebar: {
        folderTree: buildSidebarTree(),
        slotCount: CATEGORY_ACCENT_SLOT_COUNT,
      },
    });
    expect(
      countMatches(html, /<aside\s[^>]*\bclass="sidebar"/g),
      'sidebar must render twice — once in the .site-shell__sidebar grid column (visible on lg+), once inside .mobile-menu (visible on < lg). CSS hides whichever copy is wrong for the viewport. Two server renders cost nothing on a static site.',
    ).toBe(2);
    expect(
      html,
      'with-sidebar shell modifier must be present so the lg+ grid layout engages',
    ).toMatch(/site-shell--with-sidebar/);
    expect(
      html,
      '<body> must carry .has-sidebar so the mobile-menu hide breakpoint shifts from md+ (v0.2) to lg+ (v0.3)',
    ).toMatch(/<body[^>]*\bclass="[^"]*\bhas-sidebar\b/);
    const dupes = findDuplicateIds(html);
    expect(
      dupes,
      `rendering Sidebar twice MUST NOT produce any duplicate id attribute — a regression in step 4 (e.g. attaching a static id to AvatarBlock or FolderTree) would surface here. Found duplicate ids: ${dupes.join(', ')}`,
    ).toEqual([]);
  });

  it('(17) sidebar.activeSlug threads through to FolderTree → exactly one aria-current="page" inside both <aside> copies combined', async () => {
    const html = await render({
      title: 'T',
      sidebar: {
        folderTree: buildSidebarTree(),
        activeSlug: 'AI/Claude/agents',
        slotCount: CATEGORY_ACCENT_SLOT_COUNT,
      },
    });
    // Per-aside count: each <aside> renders the FolderTree once with the
    // active note marked. Two asides ⇒ two aria-current="page" total. We
    // assert the per-render contract via the expected per-render markup.
    expect(
      countMatches(html, /\baria-current="page"/g),
      'two <aside> copies × one active link each = exactly two aria-current="page" attributes — anything else means activeSlug failed to thread through, or FolderTree is marking multiple rows',
    ).toBe(2);
    expect(
      html,
      'aria-current=page must land on the matching note slug link (trailing slash per ADR-012)',
    ).toMatch(
      /<a\s[^>]*\bhref="\/AI\/Claude\/agents\/"[^>]*\baria-current="page"/,
    );
  });

  it('(18) sidebar prop does not regress canonical/og meta — meta block is still gated solely on canonicalUrl', async () => {
    const html = await render({
      title: 'Article',
      description: 'desc',
      canonicalUrl: 'https://example.com/posts/hello',
      ogType: 'article',
      siteName: 'shine notes',
      sidebar: {
        folderTree: buildSidebarTree(),
        slotCount: CATEGORY_ACCENT_SLOT_COUNT,
      },
    });
    expect(
      countMatches(html, /<link\s+rel="canonical"/g),
      'introducing the sidebar prop must not alter canonical emission — canonicalUrl still gates exactly one <link rel="canonical">',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:url"\s+content="https:\/\/example\.com\/posts\/hello"/g),
      'og:url must echo canonicalUrl byte-for-byte regardless of whether sidebar is provided — trailingSlash adoption (step 6) drives the value upstream, not BaseLayout',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:type"\s+content="article"/g),
      'og:type contract is independent of sidebar wiring',
    ).toBe(1);
    expect(
      countMatches(html, /<meta\s+property="og:site_name"\s+content="shine notes"/g),
      'og:site_name contract is independent of sidebar wiring',
    ).toBe(1);
  });

  it('(19) themeInitScript inline block survives sidebar wiring — exactly one <script> inside <head> calls localStorage.getItem("theme")', async () => {
    const withSidebar = await render({
      title: 'T',
      sidebar: {
        folderTree: buildSidebarTree(),
        slotCount: CATEGORY_ACCENT_SLOT_COUNT,
      },
    });
    const headMatch = withSidebar.match(/<head[^>]*>([\s\S]*?)<\/head>/);
    expect(headMatch, '<head> region must be present').not.toBeNull();
    const headInner = headMatch![1]!;
    expect(
      countMatches(headInner, /localStorage\.getItem\("theme"\)/g),
      'theme-init inline script must appear in <head> exactly once — the sole inline JS in v0.2 (FOUC-prevention) must remain untouched after step 5',
    ).toBe(1);
    // Cross-check against the no-sidebar render: the head should be
    // byte-identical from the perspective of the FOUC script presence.
    const withoutSidebar = await render({ title: 'T' });
    const headMatch2 = withoutSidebar.match(/<head[^>]*>([\s\S]*?)<\/head>/);
    expect(headMatch2).not.toBeNull();
    expect(
      countMatches(headMatch2![1]!, /localStorage\.getItem\("theme"\)/g),
      'sidebar prop must not affect <head> — the theme-init script appears exactly once whether the sidebar is wired or not',
    ).toBe(1);
  });

  it('(toc-1) tableOfContents prop renders exactly one .site-shell__toc; absent prop renders zero', async () => {
    const without = await render({ title: 'T' });
    expect(
      countMatches(without, /\bsite-shell__toc\b/g),
      'absent tableOfContents must NOT emit the rail container — empty <aside> would still claim grid column at xl+',
    ).toBe(0);
    expect(
      countMatches(without, /\bsite-shell--with-toc\b/g),
      'absent tableOfContents must NOT mark the shell as --with-toc — modifier toggles the 3-col grid math',
    ).toBe(0);

    const withToc = await render({
      title: 'T',
      tableOfContents: {
        headings: [
          { id: 'intro', depth: 2, text: 'Introduction' },
          { id: 'next', depth: 2, text: 'Next Steps' },
        ],
      },
    });
    expect(
      countMatches(withToc, /\bsite-shell__toc\b/g),
      'present tableOfContents must emit exactly one rail container',
    ).toBe(1);
    expect(
      countMatches(withToc, /\bsite-shell--with-toc\b/g),
      'present tableOfContents must mark the shell with --with-toc so layout.css can engage the 3-col grid',
    ).toBe(1);
    expect(
      withToc,
      'a TOC link to the first heading must reach the DOM with its href intact',
    ).toMatch(/<a\s[^>]*\bhref="#intro"/);
  });

  it('(toc-2) headings text passes through, but a < in heading text must be HTML-escaped', async () => {
    // Heading text comes from core unchanged — the theme cannot trust that
    // every author writes safe markdown. Astro's interpolation escapes by
    // default; this assertion is the regression guard against a future
    // refactor that swaps `{h.text}` for `set:html`.
    const html = await render({
      title: 'T',
      tableOfContents: {
        headings: [
          { id: 'oops', depth: 2, text: '<script>alert(1)</script>' },
        ],
      },
    });
    expect(
      html,
      'raw <script> in heading text must be escaped — ANY appearance is a stored-XSS path',
    ).not.toMatch(/<script>alert\(1\)<\/script>/);
    expect(
      html,
      'escaped form is what we expect — Astro emits &lt;script&gt; via auto-escape',
    ).toContain('&lt;script&gt;');
  });

  it('(toc-3) tableOfContents text inside the layout is not surfaced when the prop is absent — guard against new leak channel', async () => {
    // Parallel to assertion (6) in Note.test.ts: a heading list cast onto
    // BaseLayoutProps without setting tableOfContents must not leak its text
    // into the rendered HTML. The contract is presence-based: only an
    // explicit `tableOfContents` prop renders the TOC.
    const sneaky = {
      title: 'T',
      // headings is NOT a BaseLayoutProps field; cast it onto the props bag
      // to simulate a future refactor that leaks raw heading data.
      headings: [
        { id: 'leak', depth: 2, text: 'TOC_LAYOUT_LEAK_PROBE' },
      ],
    } as unknown as Record<string, unknown>;
    const html = await render(sneaky);
    expect(html).not.toContain('TOC_LAYOUT_LEAK_PROBE');
    expect(html).not.toMatch(/\bsite-shell__toc\b/);
  });
});
