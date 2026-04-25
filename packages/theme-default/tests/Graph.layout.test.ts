/**
 * Unit tests for `computeCircularLayout` — the deterministic, framework-free
 * layout calculator that backs `<Graph />` in the next step.
 *
 * Why these nine assertions:
 *   - determinism (1)               : build determinism is what makes Astro's
 *                                     content cache and post-build audit safe;
 *                                     a layout that depends on input order or
 *                                     RNG would re-shuffle on every build.
 *   - node preservation (2)         : the public contract — same number of
 *                                     nodes out as in, with slug/title intact,
 *                                     so the component can render labels.
 *   - finite coordinates (3)        : NaN/Infinity in SVG `cx`/`cy` is silently
 *                                     dropped by browsers — guard now.
 *   - viewBox containment (4)       : SVG `viewBox` must enclose every node or
 *                                     they get clipped at the edges.
 *   - edge endpoint consistency (5) : each PositionedEdge's endpoints must be
 *                                     literally the source/target node coords;
 *                                     mismatch shows as "lines pointing at
 *                                     nothing" in the rendered SVG.
 *   - unknown-slug edge drop (6)    : defence-in-depth — even if a private
 *                                     slug somehow leaked into edges, dropping
 *                                     (not throwing) keeps the build alive
 *                                     while preventing a dangling endpoint.
 *   - empty graph (7)               : the "no public notes" case — output must
 *                                     still produce a non-zero viewBox so the
 *                                     <svg> renders an (empty) frame.
 *   - extra-field non-leakage (8)   : the privacy CRITICAL — even if a caller
 *                                     casts a richer node onto GraphNode, the
 *                                     PositionedNode handed to the component
 *                                     must contain ONLY {slug,title,x,y}.
 *   - property-based fuzz (9)       : random graphs (1..30 nodes, 0..50 edges)
 *                                     must satisfy invariants 1·3·4·5·6 over
 *                                     50 trials — catches regressions that
 *                                     hand-picked fixtures miss.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  computeCircularLayout,
  type GraphEdge,
  type GraphNode,
  type GraphViewModel,
  type PositionedGraph,
  type PositionedNode,
} from '../src/components/Graph.layout';

const ALLOWED_NODE_KEYS = ['slug', 'title', 'x', 'y'] as const;

function nodeBySlug(out: PositionedGraph): Map<string, PositionedNode> {
  const m = new Map<string, PositionedNode>();
  for (const n of out.nodes) m.set(n.slug, n);
  return m;
}

function shuffled<T>(arr: readonly T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const ai = out[i] as T;
    const aj = out[j] as T;
    out[i] = aj;
    out[j] = ai;
  }
  return out;
}

describe('computeCircularLayout', () => {
  it('(1) determinism: same input (and shuffled input) produces equal output', () => {
    const nodes: GraphNode[] = [
      { slug: 'a', title: 'A' },
      { slug: 'b', title: 'B' },
      { slug: 'c', title: 'C' },
      { slug: 'd', title: 'D' },
    ];
    const edges: GraphEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
    ];

    const first = computeCircularLayout({ nodes, edges });
    const second = computeCircularLayout({ nodes, edges });
    expect(second).toEqual(first);

    const shuffledInput: GraphViewModel = {
      nodes: shuffled(nodes, 42),
      edges: shuffled(edges, 1337),
    };
    const third = computeCircularLayout(shuffledInput);
    expect(third).toEqual(first);
  });

  it('(2) node preservation: count, slug, and title are unchanged', () => {
    const nodes: GraphNode[] = [
      { slug: 'one', title: '하나' },
      { slug: 'two', title: 'Two' },
      { slug: 'three', title: '셋' },
    ];
    const out = computeCircularLayout({ nodes, edges: [] });
    expect(out.nodes.length).toBe(nodes.length);
    const byslug = nodeBySlug(out);
    for (const n of nodes) {
      const got = byslug.get(n.slug);
      expect(got, `slug "${n.slug}" must survive layout`).toBeDefined();
      expect(got?.title).toBe(n.title);
    }
  });

  it('(3) finite coordinates: every (x,y) and (x1,y1,x2,y2) is finite', () => {
    const nodes: GraphNode[] = Array.from({ length: 7 }, (_, i) => ({
      slug: `n${i}`,
      title: `N${i}`,
    }));
    const edges: GraphEdge[] = [
      { source: 'n0', target: 'n1' },
      { source: 'n2', target: 'n5' },
      { source: 'n6', target: 'n3' },
    ];
    const out = computeCircularLayout({ nodes, edges });
    for (const n of out.nodes) {
      expect(Number.isFinite(n.x), `node ${n.slug} x must be finite`).toBe(true);
      expect(Number.isFinite(n.y), `node ${n.slug} y must be finite`).toBe(true);
    }
    for (const e of out.edges) {
      expect(Number.isFinite(e.x1)).toBe(true);
      expect(Number.isFinite(e.y1)).toBe(true);
      expect(Number.isFinite(e.x2)).toBe(true);
      expect(Number.isFinite(e.y2)).toBe(true);
    }
  });

  it('(4) viewBox contains every node', () => {
    const nodes: GraphNode[] = Array.from({ length: 12 }, (_, i) => ({
      slug: `s${i}`,
      title: `S${i}`,
    }));
    const out = computeCircularLayout({ nodes, edges: [] });
    const { minX, minY, width, height } = out.viewBox;
    const maxX = minX + width;
    const maxY = minY + height;
    for (const n of out.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(minX);
      expect(n.x).toBeLessThanOrEqual(maxX);
      expect(n.y).toBeGreaterThanOrEqual(minY);
      expect(n.y).toBeLessThanOrEqual(maxY);
    }
  });

  it('(5) edge endpoint consistency: (x1,y1)==source, (x2,y2)==target', () => {
    const nodes: GraphNode[] = [
      { slug: 'alpha', title: 'A' },
      { slug: 'beta', title: 'B' },
      { slug: 'gamma', title: 'G' },
    ];
    const edges: GraphEdge[] = [
      { source: 'alpha', target: 'beta' },
      { source: 'beta', target: 'gamma' },
      { source: 'gamma', target: 'alpha' },
    ];
    const out = computeCircularLayout({ nodes, edges });
    const byslug = nodeBySlug(out);
    for (const e of out.edges) {
      const src = byslug.get(e.source);
      const dst = byslug.get(e.target);
      expect(src).toBeDefined();
      expect(dst).toBeDefined();
      expect(e.x1).toBe(src?.x);
      expect(e.y1).toBe(src?.y);
      expect(e.x2).toBe(dst?.x);
      expect(e.y2).toBe(dst?.y);
    }
  });

  it('(6) unknown-slug edges are dropped (no throw, no dangling endpoint)', () => {
    const nodes: GraphNode[] = [
      { slug: 'k1', title: 'K1' },
      { slug: 'k2', title: 'K2' },
    ];
    const edges: GraphEdge[] = [
      { source: 'k1', target: 'k2' },
      { source: 'k1', target: 'GHOST_TARGET_xyz' },
      { source: 'GHOST_SOURCE_abc', target: 'k2' },
      { source: 'GHOST_a', target: 'GHOST_b' },
    ];
    expect(() => computeCircularLayout({ nodes, edges })).not.toThrow();
    const out = computeCircularLayout({ nodes, edges });
    expect(out.edges.length).toBe(1);
    const kept = out.edges[0];
    expect(kept?.source).toBe('k1');
    expect(kept?.target).toBe('k2');
  });

  it('(7) empty graph: zero nodes, zero edges, non-zero viewBox', () => {
    const out = computeCircularLayout({ nodes: [], edges: [] });
    expect(out.nodes.length).toBe(0);
    expect(out.edges.length).toBe(0);
    expect(out.viewBox.width).toBeGreaterThan(0);
    expect(out.viewBox.height).toBeGreaterThan(0);
  });

  it('(8) extra fields on input nodes never appear on PositionedNode (allowlist)', () => {
    const sneaky = [
      {
        slug: 'visible',
        title: 'Visible',
        privateNote: 'DO_NOT_LEAK_BANANA_6f3c1',
        body: 'CLAUDE_COMMENT_LEAK_77b',
      },
      {
        slug: 'second',
        title: 'Second',
        secret: 'PRIVATE_FIELD_PROBE_xyz',
      },
    ] as unknown as GraphNode[];

    const out = computeCircularLayout({ nodes: sneaky, edges: [] });
    for (const n of out.nodes) {
      const keys = Object.keys(n).sort();
      expect(
        keys,
        `PositionedNode keys must be exactly ${ALLOWED_NODE_KEYS.join(',')} — got ${keys.join(',')}`,
      ).toEqual([...ALLOWED_NODE_KEYS].sort());
    }
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('DO_NOT_LEAK_BANANA_6f3c1');
    expect(serialized).not.toContain('CLAUDE_COMMENT_LEAK_77b');
    expect(serialized).not.toContain('PRIVATE_FIELD_PROBE_xyz');
    expect(serialized).not.toContain('privateNote');
    expect(serialized).not.toContain('secret');
  });

  it('(9) property-based fuzz: invariants 1,3,4,5,6 hold over 50 random graphs', () => {
    const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,11}$/);

    const graphArb = fc
      .uniqueArray(slugArb, { minLength: 1, maxLength: 30 })
      .chain((uniqueSlugs) => {
        const nodes: GraphNode[] = uniqueSlugs.map((slug) => ({
          slug,
          title: `T-${slug}`,
        }));
        const edgeArb = fc.record({
          source: fc.constantFrom(...uniqueSlugs),
          target: fc.constantFrom(...uniqueSlugs),
        });
        return fc
          .array(edgeArb, { minLength: 0, maxLength: 50 })
          .map((edges) => ({ nodes, edges }) satisfies GraphViewModel);
      });

    fc.assert(
      fc.property(graphArb, fc.integer({ min: 0, max: 1_000_000 }), (graph, seed) => {
        const out = computeCircularLayout(graph);

        // (1) determinism under input shuffling
        const shuffledOut = computeCircularLayout({
          nodes: shuffled(graph.nodes, seed),
          edges: shuffled(graph.edges, seed ^ 0xdeadbeef),
        });
        expect(shuffledOut).toEqual(out);

        // (3) finite coordinates
        for (const n of out.nodes) {
          expect(Number.isFinite(n.x)).toBe(true);
          expect(Number.isFinite(n.y)).toBe(true);
        }
        for (const e of out.edges) {
          expect(Number.isFinite(e.x1)).toBe(true);
          expect(Number.isFinite(e.y1)).toBe(true);
          expect(Number.isFinite(e.x2)).toBe(true);
          expect(Number.isFinite(e.y2)).toBe(true);
        }

        // (4) viewBox contains every node
        const { minX, minY, width, height } = out.viewBox;
        for (const n of out.nodes) {
          expect(n.x).toBeGreaterThanOrEqual(minX);
          expect(n.x).toBeLessThanOrEqual(minX + width);
          expect(n.y).toBeGreaterThanOrEqual(minY);
          expect(n.y).toBeLessThanOrEqual(minY + height);
        }

        // (5) edge endpoints match node coords
        const byslug = nodeBySlug(out);
        for (const e of out.edges) {
          const src = byslug.get(e.source);
          const dst = byslug.get(e.target);
          expect(src).toBeDefined();
          expect(dst).toBeDefined();
          expect(e.x1).toBe(src?.x);
          expect(e.y1).toBe(src?.y);
          expect(e.x2).toBe(dst?.x);
          expect(e.y2).toBe(dst?.y);
        }

        // (6) every kept edge references a known node
        const knownSlugs = new Set(out.nodes.map((n) => n.slug));
        for (const e of out.edges) {
          expect(knownSlugs.has(e.source)).toBe(true);
          expect(knownSlugs.has(e.target)).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });
});
