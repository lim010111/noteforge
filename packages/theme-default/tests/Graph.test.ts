/**
 * Container-API tests for `<Graph />`.
 *
 * Why these nine assertions:
 *   - circle count = node count (1)     : the public-graph contract — every
 *                                         node the caller passed must render
 *                                         as exactly one <circle>.
 *   - <a href="/<slug>"> per node (2)   : PRD: "노드 클릭 가능". Every node
 *                                         must be a navigable link, no
 *                                         exceptions.
 *   - line count = layout edges (3)     : edges referencing unknown slugs are
 *                                         dropped by `computeCircularLayout`
 *                                         (defence-in-depth); the rendered
 *                                         <line> count must mirror that drop
 *                                         so we never get a dangling endpoint.
 *   - viewBox + role + aria-label (4)   : SVG accessibility contract — without
 *                                         role="img" + aria-label the graph
 *                                         is a black hole to AT.
 *   - empty graph silence (5)           : an empty <svg> is still a visible
 *                                         frame and would suggest "something
 *                                         was filtered". Mirrors Backlinks /
 *                                         TagList silence policy.
 *   - canary absence (6)                : project-wide privacy gate — a
 *                                         normal render must never carry the
 *                                         canary tokens.
 *   - extra-field non-leakage (7)       : the privacy CRITICAL — even if the
 *                                         caller casts a richer node onto
 *                                         GraphNode, only `slug`/`title`/
 *                                         coords may reach DOM.
 *   - hover tooltip = <title> (8)       : SVG <title> IS the hover tooltip
 *                                         and the AT name for the node link.
 *                                         Exactly one per node, with the
 *                                         declared title verbatim.
 *   - no client JS (9)                  : PRD v0.1 is static SVG, no client
 *                                         JS — any <script> is a regression
 *                                         AND a new leak surface.
 */

import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Graph from '../src/components/Graph.astro';
import type { GraphProps, GraphViewModel } from '../src/components/Graph.types';

async function render(props: GraphProps): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Graph as never, {
    props: props as unknown as Record<string, unknown>,
  });
}

function countMatches(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

describe('Graph', () => {
  it('(1) renders one <circle> per input node', async () => {
    const graph: GraphViewModel = {
      nodes: [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
        { slug: 'c', title: 'C' },
        { slug: 'd', title: 'D' },
      ],
      edges: [],
    };
    const html = await render({ graph });
    expect(
      countMatches(html, /<circle\b/g),
      'circle count must equal node count — one node missing breaks the public graph contract',
    ).toBe(graph.nodes.length);
  });

  it('(2) wraps every node in <a href="/<slug>"> exactly once (PRD: nodes are clickable)', async () => {
    const graph: GraphViewModel = {
      nodes: [
        { slug: 'foo', title: 'Foo' },
        { slug: 'bar-baz', title: '바' },
        { slug: 'one', title: 'One' },
      ],
      edges: [],
    };
    const html = await render({ graph });
    for (const n of graph.nodes) {
      const re = new RegExp(`<a\\s[^>]*\\bhref="/${n.slug}"`, 'g');
      expect(
        countMatches(html, re),
        `slug "${n.slug}" must produce exactly one <a href="/${n.slug}"> — node is required to be clickable`,
      ).toBe(1);
    }
  });

  it('(3) emits one <line> per edge (unknown-slug edges are dropped by layout)', async () => {
    const graph: GraphViewModel = {
      nodes: [
        { slug: 'k1', title: 'K1' },
        { slug: 'k2', title: 'K2' },
        { slug: 'k3', title: 'K3' },
      ],
      edges: [
        { source: 'k1', target: 'k2' },
        { source: 'k2', target: 'k3' },
        // unknown-slug edges → dropped by computeCircularLayout
        { source: 'k1', target: 'GHOST_TARGET_xyz' },
        { source: 'GHOST_SOURCE_abc', target: 'k2' },
      ],
    };
    const html = await render({ graph });
    expect(
      countMatches(html, /<line\b/g),
      'line count must equal layout-kept edges (2) — unknown slugs must NOT produce dangling lines',
    ).toBe(2);
  });

  it('(4) root <svg> carries viewBox, role="img", and aria-label', async () => {
    const graph: GraphViewModel = {
      nodes: [{ slug: 'a', title: 'A' }],
      edges: [],
    };
    const html = await render({ graph });
    expect(
      countMatches(html, /<svg\s[^>]*\bviewBox="[^"]+"/g),
      '<svg> must carry a viewBox — without it the static SVG cannot scale',
    ).toBe(1);
    expect(
      countMatches(html, /<svg\s[^>]*\brole="img"/g),
      '<svg role="img"> is required so AT treats it as a single graphic',
    ).toBe(1);
    expect(
      countMatches(html, /<svg\s[^>]*\baria-label="[^"]+"/g),
      '<svg> must announce its purpose with aria-label',
    ).toBe(1);
  });

  it('(5) empty graph: no <svg>, no <circle>, no <line>; emptyMessage appears', async () => {
    const html = await render({
      graph: { nodes: [], edges: [] },
      emptyMessage: '커스텀 빈 메시지',
    });
    expect(
      countMatches(html, /<svg\b/g),
      'empty graph must NOT emit <svg> — empty frame leaks "something was filtered here"',
    ).toBe(0);
    expect(countMatches(html, /<circle\b/g)).toBe(0);
    expect(countMatches(html, /<line\b/g)).toBe(0);
    expect(
      html,
      'caller-provided emptyMessage must appear in the empty-state output',
    ).toContain('커스텀 빈 메시지');

    const defaulted = await render({ graph: { nodes: [], edges: [] } });
    expect(
      defaulted,
      'default emptyMessage must appear when caller omits it',
    ).toContain('아직 공개된 글이 없습니다.');
    expect(countMatches(defaulted, /<svg\b/g)).toBe(0);
  });

  it('(6) canaries absent in normal render (regression insurance)', async () => {
    const graph: GraphViewModel = {
      nodes: [
        { slug: 'a', title: '평범한 제목' },
        { slug: 'b', title: 'Plain Title' },
      ],
      edges: [{ source: 'a', target: 'b' }],
    };
    const html = await render({ graph });
    expect(html).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('CLAUDE_COMMENT_LEAK_77b');
  });

  it('(7) extra fields cast onto GraphNode never reach the DOM (allowlist enforcement)', async () => {
    const sneaky = {
      nodes: [
        {
          slug: 'visible',
          title: 'Visible',
          privateNote: 'DO_NOT_LEAK_BANANA_6f3c1',
          body: 'CLAUDE_COMMENT_LEAK_77b',
          frontmatter: { secret: 'PRIVATE_FIELD_PROBE_xyz' },
        },
        {
          slug: 'second',
          title: 'Second',
          tags: ['ANOTHER_PROBE_qrs'],
        },
      ],
      edges: [],
    } as unknown as GraphViewModel;

    const html = await render({ graph: sneaky });
    expect(
      html,
      'privateNote field must not leak — privacy CRITICAL (allowlist)',
    ).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(html).not.toContain('CLAUDE_COMMENT_LEAK_77b');
    expect(html).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(html).not.toContain('ANOTHER_PROBE_qrs');
    expect(html, 'extra key names must not appear in HTML either').not.toContain(
      'privateNote',
    );
    expect(html).not.toContain('frontmatter');
    expect(html, 'declared title still renders').toContain('Visible');
    expect(html, 'declared slug still produces correct href').toMatch(
      /<a\s[^>]*\bhref="\/visible"/,
    );
  });

  it('(8) hover tooltip: <title>{title}</title> appears exactly once per node', async () => {
    const graph: GraphViewModel = {
      nodes: [
        { slug: 'a', title: '하나' },
        { slug: 'b', title: 'Two' },
        { slug: 'c', title: '셋' },
      ],
      edges: [],
    };
    const html = await render({ graph });
    for (const n of graph.nodes) {
      const re = new RegExp(`<title>${n.title}</title>`, 'g');
      expect(
        countMatches(html, re),
        `<title>${n.title}</title> must appear exactly once for hover-tooltip + AT name`,
      ).toBe(1);
    }
    expect(
      countMatches(html, /<title\b/g),
      'total <title> count must equal node count (one per <a> wrapper)',
    ).toBe(graph.nodes.length);
  });

  it('(9) no <script> tags — v0.1 is static SVG, client JS is forbidden', async () => {
    const graph: GraphViewModel = {
      nodes: [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
      ],
      edges: [{ source: 'a', target: 'b' }],
    };
    const html = await render({ graph });
    expect(
      countMatches(html, /<script\b/g),
      'no <script> tag may appear — v0.1 contract is static SVG, JS is a new leak surface',
    ).toBe(0);
  });

  it('(10) <figure> root carries v0.2 token-based class (UI_GUIDE v0.2: BaseLayout owns container; component owns visual class only)', async () => {
    const graph: GraphViewModel = {
      nodes: [{ slug: 'a', title: 'A' }],
      edges: [],
    };
    const html = await render({ graph });
    const figureMatch = html.match(/<figure\s[^>]*\bclass="([^"]*)"/);
    expect(figureMatch, '<figure> must carry a class attribute pointing to components.css').not.toBeNull();
    expect(
      figureMatch![1]!,
      '<figure> class must be "graph" — UI_GUIDE v0.2: width comes from BaseLayout `.site-main`, not the component',
    ).toContain('graph');
  });

  it('(11) SVG node/edge colours come from CSS classes — no inline hex, no v0.1 Tailwind palette utilities', async () => {
    const graph: GraphViewModel = {
      nodes: [
        { slug: 'a', title: 'A' },
        { slug: 'b', title: 'B' },
      ],
      edges: [{ source: 'a', target: 'b' }],
    };
    const html = await render({ graph });
    expect(
      countMatches(html, /<line\s[^>]*\bclass="[^"]*\bgraph__edge\b/g),
      'every <line> must carry .graph__edge — UI_GUIDE v0.2: graph colours live in components.css, never inline',
    ).toBe(1);
    expect(
      countMatches(html, /<circle\s[^>]*\bclass="[^"]*\bgraph__node\b/g),
      'every <circle> must carry .graph__node — same reason as above',
    ).toBe(graph.nodes.length);
    expect(
      html,
      'no inline hex (#xxxxxx / #xxx) — would break dark-mode token propagation',
    ).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    for (const token of [
      'fill-zinc-',
      'fill-blue-',
      'hover:fill-blue-',
      'stroke="#',
    ]) {
      expect(
        html,
        `v0.1 inline colour token "${token}" must not appear — v0.2 graph colours come from .graph__* classes`,
      ).not.toContain(token);
    }
  });
});
