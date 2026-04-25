/**
 * View-model and deterministic layout for `<Graph />`.
 *
 * INTENTIONALLY a STRICT SUBSET of the data the privacy pipeline emits.
 * Callers (apps/blog or astro-integration) build `GraphViewModel` from
 * `PipelineResult.publicGraph` and MUST guarantee that every `slug` and
 * `title` is PUBLIC. Neither the component nor this layout calculator
 * re-runs `isPublic` — privacy decisions live in `@obpub/core/privacy`.
 *
 * The layout itself is a pure function of its inputs: same `GraphViewModel`
 * (regardless of input order) always yields the same `PositionedGraph`.
 * No `Math.random()`, no clock, no system state — build determinism is
 * what makes Astro's content cache and post-build audit trustworthy.
 */

export interface GraphNode {
  readonly slug: string;
  readonly title: string;
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
}

export interface GraphViewModel {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export interface PositionedNode extends GraphNode {
  readonly x: number;
  readonly y: number;
}

export interface PositionedEdge {
  readonly source: string;
  readonly target: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface ViewBox {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export interface PositionedGraph {
  readonly nodes: readonly PositionedNode[];
  readonly edges: readonly PositionedEdge[];
  readonly viewBox: ViewBox;
}

export interface LayoutOptions {
  /** Circular layout radius. Default 100. */
  readonly radius?: number;
  /** ViewBox outer padding. Default 24. */
  readonly padding?: number;
}

const DEFAULT_RADIUS = 100;
const DEFAULT_PADDING = 24;

/**
 * Deterministic circular layout. v0.1 MVP — no external libraries.
 * Nodes are sorted by `slug` lexicographically and placed evenly on a
 * unit circle (input order does not affect output).
 *
 * Edges referencing a slug not present in `nodes` are DROPPED
 * (defence-in-depth — caller invariant should already prevent this;
 * we never throw and never log).
 *
 * Empty graph yields nodes=[], edges=[] and a square viewBox sized to
 * `2*padding` so the SVG never has zero width/height.
 */
export function computeCircularLayout(
  graph: GraphViewModel,
  options?: LayoutOptions,
): PositionedGraph {
  const radius = options?.radius ?? DEFAULT_RADIUS;
  const padding = options?.padding ?? DEFAULT_PADDING;

  const sortedNodes = [...graph.nodes].sort((a, b) =>
    a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0,
  );

  if (sortedNodes.length === 0) {
    const side = padding * 2;
    return {
      nodes: [],
      edges: [],
      viewBox: { minX: 0, minY: 0, width: side, height: side },
    };
  }

  const positioned: PositionedNode[] = sortedNodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / sortedNodes.length - Math.PI / 2;
    return {
      slug: node.slug,
      title: node.title,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  });

  const byslug = new Map<string, PositionedNode>();
  for (const n of positioned) byslug.set(n.slug, n);

  const sortedEdges = [...graph.edges].sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    if (a.target !== b.target) return a.target < b.target ? -1 : 1;
    return 0;
  });

  const positionedEdges: PositionedEdge[] = [];
  for (const e of sortedEdges) {
    const src = byslug.get(e.source);
    const dst = byslug.get(e.target);
    if (!src || !dst) continue;
    positionedEdges.push({
      source: e.source,
      target: e.target,
      x1: src.x,
      y1: src.y,
      x2: dst.x,
      y2: dst.y,
    });
  }

  const side = (radius + padding) * 2;
  const viewBox: ViewBox = {
    minX: -(radius + padding),
    minY: -(radius + padding),
    width: side,
    height: side,
  };

  return { nodes: positioned, edges: positionedEdges, viewBox };
}
