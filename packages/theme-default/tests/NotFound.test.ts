/**
 * Container-API tests for `<NotFound />`.
 *
 * Why these four assertions:
 *   - single <h1> + ambiguous wording (1): the page must announce a not-found
 *                                          state with phrasing that does NOT
 *                                          disclose whether the slug ever existed.
 *   - leak-vocabulary blocklist (2)      : "비공개"/"private"/"삭제" all imply
 *                                          a private note USED to live here —
 *                                          PRD/UI_GUIDE forbid this disclosure.
 *   - exactly one home link (3)          : guards the navigation contract so users
 *                                          never get stuck on a 404.
 *   - props are ignored (4)              : guards that no caller-supplied value
 *                                          (slug, request path, etc.) reaches DOM.
 *                                          The slug itself is information — a 404
 *                                          page that echoes the slug discloses
 *                                          which paths the user attempted, which
 *                                          can confirm the existence of private
 *                                          notes via timing/log correlation.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import NotFound from '../src/components/NotFound.astro';

async function render(props: Record<string, unknown> = {}): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(NotFound as never, { props });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('NotFound', () => {
  it('(1) renders one <h1> and uses ambiguous (non-disclosing) wording', async () => {
    const html = await render();
    expect(
      countMatches(html, /<h1\b/g),
      '404 page must contain exactly one <h1> — multiple top-level headings break document outline',
    ).toBe(1);
    const ambiguous =
      html.includes('존재하지 않거나') || html.includes('더 이상 공개되지 않습니다');
    expect(
      ambiguous,
      'wording must be ambiguous — neither "삭제됨" nor "비공개" nor specific paths (PRD: do not leak existence)',
    ).toBe(true);
  });

  it('(2) does not contain leak-vocabulary ("비공개", "private", "삭제")', async () => {
    const html = await render();
    expect(
      html,
      '"비공개" implies a private note used to live at this path — privacy CRITICAL',
    ).not.toMatch(/비공개/);
    expect(
      html,
      '"private" (case-insensitive) is the same disclosure in another locale',
    ).not.toMatch(/private/i);
    expect(html, '"삭제" implies a public note was unpublished — disclosure').not.toMatch(/삭제/);
  });

  it('(3) contains exactly one home link <a href="/">', async () => {
    const html = await render();
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/"[\s>]/g),
      'a single home link is the only navigation guarantee — zero strands the user, multiple introduces ambiguity',
    ).toBe(1);
  });

  it('(4) ignores any props (does not echo slug / request path / arbitrary input)', async () => {
    const html = await render({
      slug: '/diary/2024-04-15-secret',
      requestPath: '/projects/private-thing',
      title: 'CALLER_PROVIDED_TITLE_PROBE',
    });
    expect(
      html,
      'NotFound must not echo a caller-supplied slug — the path itself is information (could be a private note id)',
    ).not.toContain('/diary/2024-04-15-secret');
    expect(html).not.toContain('/projects/private-thing');
    expect(html).not.toContain('CALLER_PROVIDED_TITLE_PROBE');
  });

  it('(5) <section> root carries v0.2 token-based class (UI_GUIDE v0.2: standalone 404 owns its measure via components.css)', async () => {
    const html = await render();
    const sectionMatch = html.match(/<section\s[^>]*\bclass="([^"]*)"/);
    expect(sectionMatch, '<section> must carry a class attribute pointing to components.css').not.toBeNull();
    expect(
      sectionMatch![1]!,
      '<section> class must be "not-found" — UI_GUIDE v0.2: layout (max-w / grid / padding) lives in .not-found rule, not inline utilities',
    ).toContain('not-found');
  });

  it('(6) v0.2 visual: no hardcoded hex colours and no v0.1 zinc/blue Tailwind palette tokens reach the DOM', async () => {
    const html = await render();
    expect(
      html,
      'inline hex must not appear — dark-mode token transition relies on CSS variables in components.css',
    ).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    for (const token of ['text-zinc-', 'text-blue-', 'bg-zinc-']) {
      expect(
        html,
        `v0.1 Tailwind palette class "${token}*" must not appear — v0.2 uses semantic class names referencing CSS vars`,
      ).not.toContain(token);
    }
  });
});
