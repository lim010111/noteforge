/**
 * View-model and props for `<Graph />`.
 *
 * INTENTIONALLY a STRICT SUBSET of the data the privacy pipeline emits.
 * The component receives a `GraphViewModel` (declared in `Graph.layout.ts`)
 * whose `nodes[i].slug` and `nodes[i].title` are guaranteed PUBLIC by the
 * caller — typically `apps/blog` or `@noteforge/astro` building from
 * `PipelineResult.publicGraph`. Neither the component nor the layout
 * calculator re-runs `isPublic`; privacy decisions live in
 * `@noteforge/core/privacy` (CLAUDE.md CRITICAL: 결정은 한 곳).
 *
 * Caller responsibilities (the component does NOT re-derive any of these):
 *   - every `slug`/`title` is a PUBLIC slug/title (verified upstream).
 *   - `edges[i].source`/`edges[i].target` reference public slugs only;
 *     unknown slugs are silently dropped by `computeCircularLayout`.
 */
import type { GraphViewModel } from './Graph.layout.ts';

export interface GraphProps {
  graph: GraphViewModel;
  /** 빈 그래프(노드 0개)일 때 표시할 안내 문구. 기본 "아직 공개된 글이 없습니다." */
  emptyMessage?: string;
}

export type {
  GraphViewModel,
  GraphNode,
  GraphEdge,
} from './Graph.layout.ts';
