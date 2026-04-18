/**
 * Note graph and public-subgraph extraction.
 *
 * privacy-first: public/private classification happens in `classify.ts`; this module
 * consumes the already-classified `isPublic` flag on each node and never re-runs the
 * decision. `filterToPublicSubgraph` guarantees that a node or edge referencing an id
 * outside the public set never leaves this module — `/api/graph.json` must not leak
 * the existence of private notes.
 */

export interface GraphNode {
  readonly id: string;
  readonly relativePath: string;
  readonly title?: string;
  readonly isPublic: boolean;
}

export type GraphEdgeKind = 'link' | 'embed';

export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeKind;
}

export interface Graph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export function buildGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Graph {
  const byId = new Map<string, GraphNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) {
      console.warn(`[obpub/graph] duplicate node id "${n.id}" — ignoring later occurrence`);
      continue;
    }
    byId.set(n.id, n);
  }

  const seenEdge = new Set<string>();
  const keptEdges: GraphEdge[] = [];
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) {
      console.warn(
        `[obpub/graph] dropping dangling edge ${e.from} -> ${e.to} (${e.kind})`,
      );
      continue;
    }
    const key = `${e.from}\u0000${e.to}\u0000${e.kind}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    keptEdges.push(e);
  }

  const sortedNodes = [...byId.values()].sort((a, b) => compare(a.id, b.id));
  const sortedEdges = keptEdges.sort(compareEdge);

  return { nodes: sortedNodes, edges: sortedEdges };
}

export function filterToPublicSubgraph(graph: Graph): Graph {
  const publicIds = new Set<string>();
  const publicNodes: GraphNode[] = [];
  for (const n of graph.nodes) {
    if (n.isPublic) {
      publicIds.add(n.id);
      publicNodes.push(n);
    }
  }

  const publicEdges: GraphEdge[] = [];
  for (const e of graph.edges) {
    if (publicIds.has(e.from) && publicIds.has(e.to)) {
      publicEdges.push(e);
    }
  }

  return { nodes: publicNodes, edges: publicEdges };
}

export function computeBacklinks(
  graph: Graph,
): ReadonlyMap<string, readonly GraphEdge[]> {
  const buckets = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    const bucket = buckets.get(e.to);
    if (bucket) bucket.push(e);
    else buckets.set(e.to, [e]);
  }
  for (const bucket of buckets.values()) {
    bucket.sort(compareEdge);
  }
  return buckets;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareEdge(a: GraphEdge, b: GraphEdge): number {
  const byFrom = compare(a.from, b.from);
  if (byFrom !== 0) return byFrom;
  const byTo = compare(a.to, b.to);
  if (byTo !== 0) return byTo;
  return compare(a.kind, b.kind);
}
