/**
 * Container-API tests for `<Note />`.
 *
 * Why these seven assertions:
 *   - <article> count (1)               : guards the single-region semantic root —
 *                                         duplicate <article>s confuse screen readers.
 *   - <h1> echoes title (2)             : guards the title-render contract; missing
 *                                         h1 is the most user-visible regression.
 *   - <time> presence (3)               : guards both branches; an empty <time>
 *                                         when date is absent is a frontmatter-leak
 *                                         risk (datetime="" reveals the field exists).
 *   - tag link href (4)                 : guards the tag URL contract (`/tags/<t>`).
 *                                         Adjacent typo (e.g. `/tag/`) silently
 *                                         breaks SEO and the tag index page.
 *   - body via set:html only (5)        : guards that body HTML reaches the page
 *                                         intact; switching to text-interpolation
 *                                         would escape `<p>` and break the contract.
 *   - allowlist enforcement (6)         : the privacy CRITICAL — extra fields cast
 *                                         onto NoteViewModel must NEVER reach DOM.
 *                                         The component reads only declared fields,
 *                                         so `personalNote` etc. cannot leak even
 *                                         when the type is bypassed at runtime.
 *   - canary-strip pipeline contract (7): %%comment%% strip is core's responsibility
 *                                         (Phase A), but Note must not REINTRODUCE
 *                                         the canary into HTML. We feed Note a body
 *                                         derived from the fixture file with the same
 *                                         strip applied and assert zero canary hits.
 */

import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Note from '../src/components/Note.astro';
import type { NoteViewModel } from '../src/components/Note.types';

async function render(note: NoteViewModel): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Note as never, { props: { note } });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

const FIXTURE_DIR = fileURLToPath(
  new URL('../../core/tests/fixtures/vault-mixed/', import.meta.url),
);

describe('Note', () => {
  it('(1) emits exactly one <article>', async () => {
    const html = await render({ title: 'T', tags: [], body: '<p>hi</p>' });
    expect(
      countMatches(html, /<article\b/g),
      'Note must wrap content in exactly one <article> — duplicates break the document outline',
    ).toBe(1);
    expect(countMatches(html, /<\/article>/g)).toBe(1);
  });

  it('(2) <h1> echoes note.title byte-for-byte (incl. non-ASCII)', async () => {
    const html = await render({ title: '안녕 — Hello', tags: [], body: '' });
    expect(
      html,
      '<h1> must contain note.title verbatim — anything else means the component is mangling content',
    ).toMatch(/<h1\b[^>]*>[^<]*안녕 — Hello[^<]*<\/h1>/);
  });

  it('(3) <time datetime="..."> appears once when date provided, zero otherwise', async () => {
    const without = await render({ title: 'T', tags: [], body: '' });
    expect(
      countMatches(without, /<time\b/g),
      'absent date must NOT emit <time> — an empty <time datetime=""> would leak the field shape',
    ).toBe(0);

    const withDate = await render({ title: 'T', tags: [], body: '', date: '2026-01-10' });
    expect(
      countMatches(withDate, /<time\b[^>]*\bdatetime="2026-01-10"/g),
      'date prop must emit exactly one <time datetime="..."> with the verbatim ISO value',
    ).toBe(1);
  });

  it('(4) tags render as <a href="/tags/<t>"> exactly once per tag', async () => {
    const html = await render({ title: 'T', tags: ['foo', 'bar'], body: '' });
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/tags\/foo"/g),
      'tag "foo" must produce exactly one <a href="/tags/foo"> — wrong path breaks tag index routing',
    ).toBe(1);
    expect(
      countMatches(html, /<a\s[^>]*\bhref="\/tags\/bar"/g),
      'tag "bar" must produce exactly one <a href="/tags/bar">',
    ).toBe(1);
  });

  it('(5) body is injected via set:html (HTML structure preserved)', async () => {
    const html = await render({
      title: 'DO_NOT_LEAK_BANANA_6f3c1',
      tags: [],
      body: 'before <p>안녕</p> after',
    });
    expect(
      html,
      'body must be injected as raw HTML (set:html) — text interpolation would escape <p> and break the contract',
    ).toContain('<p>안녕</p>');
    expect(
      html,
      'title field is part of the allowlist; the canary appearing here is by design (it is the title)',
    ).toContain('DO_NOT_LEAK_BANANA_6f3c1');
  });

  it('(6) fields outside NoteViewModel never reach the DOM (allowlist enforcement)', async () => {
    const sneaky = {
      title: 'Visible Title',
      tags: [],
      body: '<p>visible body</p>',
      personalNote: 'DO_NOT_LEAK_BANANA_6f3c1',
      reviewDate: 'PRIVATE_FIELD_PROBE_xyz',
      'arbitrary-key': 'ANOTHER_PROBE_qrs',
    } as unknown as NoteViewModel;

    const html = await render(sneaky);
    expect(
      html,
      'extra fields cast onto NoteViewModel must not appear in HTML — privacy CRITICAL (CLAUDE.md frontmatter allowlist)',
    ).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(html).not.toContain('ANOTHER_PROBE_qrs');
    expect(html).not.toContain('personalNote');
    expect(html).not.toContain('reviewDate');
    expect(html, 'declared fields still render correctly').toContain('<p>visible body</p>');
    expect(html).toContain('Visible Title');
  });

  it('(8) <article> root carries v0.2 prose + measure classes (UI_GUIDE v0.2: prose / mx-auto / max-w-[var(--measure-prose)])', async () => {
    const html = await render({ title: 'T', tags: [], body: '' });
    const articleMatch = html.match(/<article\s[^>]*\bclass="([^"]*)"/);
    expect(articleMatch, '<article> must carry a class attribute for the viewport-responsive container').not.toBeNull();
    const cls = articleMatch![1]!;
    for (const token of ['prose', 'mx-auto', 'max-w-[var(--measure-prose)]']) {
      expect(
        cls,
        `<article> class must include "${token}" — UI_GUIDE v0.2: prose binds article body to prose.css rules, mx-auto + measure-prose constrains reading column to 68ch`,
      ).toContain(token);
    }
  });

  it('(9) rehype-rendered heading anchor in body reaches the DOM intact (set:html passthrough)', async () => {
    // Mirrors the markup core/render/htmlFromMdast emits for `## Hello` after
    // rehype-slug + rehype-autolink-headings (behavior: 'append'). Note must
    // pass it through without escaping or reordering.
    const body =
      '<h2 id="hello"><a class="heading-anchor" href="#hello" aria-label="permalink">#</a>Hello</h2>';
    const html = await render({ title: 'T', tags: [], body });
    expect(
      html,
      'h2 id must reach DOM — headings without ids cannot be permalinked or jumped to',
    ).toMatch(/<h2\b[^>]*\bid="hello"/);
    expect(
      html,
      '.heading-anchor child <a> must reach DOM — required for v0.2 hover-to-permalink affordance',
    ).toMatch(/<a\s[^>]*\bclass="heading-anchor"/);
  });

  it('(7) canary CLAUDE_COMMENT_LEAK_77b absent in HTML when body is the sanitized fixture', async () => {
    const raw = await fs.readFile(`${FIXTURE_DIR}public-with-comment.md`, 'utf8');
    const bodyOnly = raw.replace(/^---[\s\S]*?---\s*/, '');
    // Phase A invariant: %%...%% comments are stripped at discovery time. We replicate
    // that contract here so the test asserts the COMPONENT does not reintroduce the
    // canary, regardless of how Phase A is wired upstream.
    const sanitized = bodyOnly.replace(/%%[\s\S]*?%%/g, '');
    expect(
      sanitized,
      'sanity: upstream strip must already have removed the canary before the component sees it',
    ).not.toContain('CLAUDE_COMMENT_LEAK_77b');

    const html = await render({
      title: 'Public With Comment',
      tags: [],
      body: sanitized,
    });
    expect(
      countMatches(html, /CLAUDE_COMMENT_LEAK_77b/g),
      'private-comment canary must never appear in rendered HTML — privacy CRITICAL (CLAUDE.md %%-strip)',
    ).toBe(0);
  });
});
