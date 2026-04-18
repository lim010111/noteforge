import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGraph,
  computeBacklinks,
  filterToPublicSubgraph,
  type GraphEdge,
  type GraphNode,
} from '../src/privacy/graph.ts';

function node(id: string, isPublic: boolean, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    relativePath: overrides.relativePath ?? `${id}.md`,
    isPublic,
    ...overrides,
  };
}

function edge(from: string, to: string, kind: GraphEdge['kind'] = 'link'): GraphEdge {
  return { from, to, kind };
}

describe('buildGraph', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns empty graph for empty input', () => {
    const g = buildGraph([], []);
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
  });

  it('keeps 2 nodes + 1 edge as-is when valid', () => {
    const a = node('a', true);
    const b = node('b', true);
    const e = edge('a', 'b', 'link');
    const g = buildGraph([a, b], [e]);
    expect(g.nodes).toEqual([a, b]);
    expect(g.edges).toEqual([e]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('dedupes duplicate node ids (keeps first) and warns once', () => {
    const first = node('a', true, { title: 'First' });
    const second = node('a', false, { title: 'Second' });
    const g = buildGraph([first, second], []);
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]).toEqual(first);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('drops dangling edge when "to" is outside node set and warns', () => {
    const a = node('a', true);
    const e = edge('a', 'ghost', 'link');
    const g = buildGraph([a], [e]);
    expect(g.edges).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('drops dangling edge when "from" is outside node set and warns', () => {
    const b = node('b', true);
    const e = edge('ghost', 'b', 'link');
    const g = buildGraph([b], [e]);
    expect(g.edges).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('dedupes duplicate edges (same from/to/kind) to one', () => {
    const a = node('a', true);
    const b = node('b', true);
    const g = buildGraph([a, b], [edge('a', 'b', 'link'), edge('a', 'b', 'link')]);
    expect(g.edges).toEqual([edge('a', 'b', 'link')]);
  });

  it('keeps parallel link + embed edges between same endpoints', () => {
    const a = node('a', true);
    const b = node('b', true);
    const g = buildGraph([a, b], [edge('a', 'b', 'link'), edge('a', 'b', 'embed')]);
    expect(g.edges).toHaveLength(2);
    const kinds = g.edges.map((x) => x.kind).sort();
    expect(kinds).toEqual(['embed', 'link']);
  });

  it('sorts nodes by id and edges by from→to→kind deterministically', () => {
    const a = node('a', true);
    const b = node('b', true);
    const c = node('c', true);
    const input = [c, a, b];
    const inputEdges = [
      edge('b', 'c', 'link'),
      edge('a', 'b', 'link'),
      edge('a', 'b', 'embed'),
      edge('a', 'c', 'link'),
    ];
    const g = buildGraph(input, inputEdges);
    expect(g.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(g.edges).toEqual([
      edge('a', 'b', 'embed'),
      edge('a', 'b', 'link'),
      edge('a', 'c', 'link'),
      edge('b', 'c', 'link'),
    ]);
  });
});

describe('filterToPublicSubgraph', () => {
  it('keeps only public nodes and public↔public edges', () => {
    const pubA = node('a', true);
    const pubB = node('b', true);
    const priv = node('p', false);
    const g = buildGraph(
      [pubA, pubB, priv],
      [edge('a', 'b', 'link'), edge('a', 'p', 'link')],
    );
    const filtered = filterToPublicSubgraph(g);
    expect(filtered.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(filtered.edges).toEqual([edge('a', 'b', 'link')]);
  });

  it('returns empty graph when no nodes are public', () => {
    const g = buildGraph(
      [node('a', false), node('b', false)],
      [edge('a', 'b', 'link')],
    );
    const filtered = filterToPublicSubgraph(g);
    expect(filtered.nodes).toEqual([]);
    expect(filtered.edges).toEqual([]);
  });

  it('drops private→public edges (prevents reverse leak)', () => {
    const pub = node('pub', true);
    const priv = node('priv', false);
    const g = buildGraph([pub, priv], [edge('priv', 'pub', 'link')]);
    const filtered = filterToPublicSubgraph(g);
    expect(filtered.nodes.map((n) => n.id)).toEqual(['pub']);
    expect(filtered.edges).toEqual([]);
  });
});

describe('computeBacklinks', () => {
  it('maps each target id to incoming edges sorted by from', () => {
    const a = node('a', true);
    const b = node('b', true);
    const c = node('c', true);
    const g = buildGraph(
      [a, b, c],
      [edge('a', 'b', 'link'), edge('c', 'b', 'link'), edge('a', 'c', 'link')],
    );
    const backlinks = computeBacklinks(g);

    const bIncoming = backlinks.get('b');
    expect(bIncoming).toBeDefined();
    expect(bIncoming).toEqual([edge('a', 'b', 'link'), edge('c', 'b', 'link')]);

    const cIncoming = backlinks.get('c');
    expect(cIncoming).toEqual([edge('a', 'c', 'link')]);

    expect(backlinks.has('a')).toBe(false);
  });

  it('has no private source when run on a public subgraph (no leak)', () => {
    const pub = node('pub', true);
    const priv = node('priv', false);
    const full = buildGraph([pub, priv], [edge('priv', 'pub', 'link')]);
    const filtered = filterToPublicSubgraph(full);
    const backlinks = computeBacklinks(filtered);
    expect(backlinks.has('pub')).toBe(false);
    expect(backlinks.size).toBe(0);
  });
});
