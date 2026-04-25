# Step 0: graph-data-builder

`Graph.astro`에 들어가기 전에, 그래프 시각화에 쓰일 **순수 함수 layout 계산기**를 TDD로 구축한다. SVG 좌표 결정은 테마의 책임이고(코어는 노드/엣지 데이터까지만 emit), Astro 컴포넌트와 분리해 단위 테스트가 쉬운 형태로 만든다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `docs/ARCHITECTURE.md` — Phase C의 graph filtering 위치
- `docs/PRD.md` — Reader UX 중 "그래프 페이지" 섹션 (정적 SVG, 노드 클릭 가능)
- `docs/UI_GUIDE.md` — 색상/레이아웃 토큰 (이 step에서는 시각 렌더 안 하지만 다음 step과 정렬)
- `packages/core/src/privacy/graph.ts` — 코어가 emit하는 filtered graph의 형태(공개 노드 + 공개↔공개 엣지). 이 step은 거기서 파생되는 view-model을 정의한다.
- `packages/theme-default/src/components/Backlinks.types.ts` — **strict subset view-model** 패턴(주석 포함)을 그대로 따른다.

## 작업

### 1. 새 파일 — `packages/theme-default/src/components/Graph.layout.ts`

다음 시그니처를 정확히 export하라. 이름·필드명은 후속 step과의 계약이므로 변경 금지.

```ts
// view-model — 컴포넌트와 layout 계산기가 공유하는 입력 타입.
// INTENTIONALLY a STRICT SUBSET of the data the privacy pipeline emits.
// 호출자(apps/blog 또는 astro-integration)는 PipelineResult.publicGraph로부터
// 이 객체를 빌드하고, 모든 slug/title이 PUBLIC임을 상위에서 보장해야 한다.
// 컴포넌트/레이아웃 계산기는 절대 isPublic을 재판정하지 않는다.
export interface GraphNode {
  readonly slug: string;   // 공개 슬러그. Graph.astro가 `/<slug>`로 링크
  readonly title: string;  // 공개 표시 제목 (allowlist 통과)
}

export interface GraphEdge {
  readonly source: string; // 공개 슬러그
  readonly target: string; // 공개 슬러그
}

export interface GraphViewModel {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

// 출력 — 컴포넌트가 SVG에 그대로 박는 좌표.
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
  /** 원형 layout 반지름. 기본 100. */
  readonly radius?: number;
  /** viewBox 외곽 여백. 기본 24. */
  readonly padding?: number;
}

/**
 * Deterministic circular layout. v0.1 MVP — 외부 라이브러리 없이 구현.
 * 노드는 `slug` 사전순으로 정렬한 뒤 단위원 위에 등간격 배치한다.
 * (입력 순서에 무관하게 동일 결과를 보장하기 위해 정렬을 강제)
 *
 * 알 수 없는 slug를 가리키는 엣지는 **DROP** (호출자가 보증한 invariant이지만
 * 방어 깊이 차원에서 무시. 경고 로그/throw 하지 않음).
 *
 * 빈 그래프는 nodes=[], edges=[], viewBox는 padding만 반영한 정사각형.
 */
export function computeCircularLayout(
  graph: GraphViewModel,
  options?: LayoutOptions,
): PositionedGraph;
```

### 2. 새 테스트 파일 — `packages/theme-default/tests/Graph.layout.test.ts`

기존 `Backlinks.test.ts`/`TagList.test.ts`와 동일한 import 패턴/스타일을 따른다. **fast-check** 의존성을 추가한다(이미 워크스페이스 root 또는 core에 있다면 재사용; 없으면 theme-default `package.json`에 devDependency로 추가하고 lockfile을 업데이트 — pnpm 명령으로 처리).

다음 단언을 모두 작성하고, 각각 **실패 → 통과** 순서로 구현하라:

1. **결정성 (determinism)**: 동일 GraphViewModel을 두 번 넣으면 동일 PositionedGraph가 나온다. 입력 노드/엣지 순서를 셔플해도 출력은 동일.
2. **노드 보존**: `output.nodes.length === input.nodes.length`이고 각 노드의 `slug`/`title`은 변경되지 않는다 (추가 필드는 출력에 없음).
3. **유한 좌표**: 모든 (x, y), (x1, y1, x2, y2)가 `Number.isFinite(...)`. NaN 금지.
4. **viewBox 포함**: 모든 노드 (x, y)는 `[viewBox.minX, viewBox.minX + viewBox.width]`, `[viewBox.minY, viewBox.minY + viewBox.height]` 안.
5. **엣지 끝점 일관성**: 각 PositionedEdge의 (x1, y1)은 source 노드의 (x, y)와 정확히 일치, (x2, y2)는 target 노드의 (x, y)와 일치.
6. **알 수 없는 slug 엣지 drop**: 입력 `edges`에 nodes에 없는 slug가 끼어 있으면 출력 `edges`에서 제외(throw 아님).
7. **빈 그래프**: `{ nodes: [], edges: [] }` 입력 → `output.nodes.length === 0 && output.edges.length === 0`이고 `viewBox.width > 0 && viewBox.height > 0` (SVG가 0폭이면 안 됨).
8. **추가 필드 누설 방지**: 입력 노드에 `(node as any).privateNote = "DO_NOT_LEAK_BANANA_6f3c1"`를 부착해 호출해도 출력 PositionedNode에 해당 필드가 존재하지 않는다 (`Object.keys` 로 검증).
9. **Property-based fuzz (fast-check)**: 1~30 노드 / 0~50 엣지 (랜덤 source/target은 nodes 중에서) 입력에 대해 위 1·3·4·5·6 invariants 50회 통과.

### 3. 검증 (mutation check)

Mutation을 일시적으로 적용해 테스트가 잡아내는지 확인하고, 본 커밋에는 원본 코드만 남긴다 (이전 step output들의 mutation 패턴 재사용):
- **A**: `computeCircularLayout` 안에서 `Math.random()`으로 노드 순서 결정 → 테스트 1 실패해야 함.
- **B**: 노드 좌표를 viewBox 밖으로 밀기 (예: `x += viewBox.width * 2`) → 테스트 4 실패해야 함.
- **C**: `(node as any).privateNote`를 PositionedNode 빌드 시 spread 누설 → 테스트 8 실패해야 함.
- **D**: 알 수 없는 slug 엣지를 drop하지 않고 throw → 테스트 6 실패해야 함.

각 mutation 적용 → 테스트 실패 확인 → 원복. 본 commit에는 `A/B/C/D 실패 재현 OK`를 summary에 기록.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

전부 통과해야 한다. 신규 테스트는 최소 9개 이상.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md의 디렉토리 구조 준수: `Graph.layout.ts`는 `packages/theme-default/src/components/`에 둔다.
   - ADR 기술 스택 범위: 외부 layout 라이브러리(D3, dagre 등) **사용 금지** — v0.2로 지연된 항목.
   - CLAUDE.md CRITICAL 규칙 점검: privacy 결정/판정을 이 파일에서 하지 않는다 (호출자 책임).
3. 결과에 따라 `phases/step4c-theme-graph-and-polish/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Graph.layout.ts + N tests + fast-check fuzz; mutation check A/B/C/D 재현 OK"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- D3, dagre, elkjs, cytoscape 등 외부 그래프 layout 라이브러리를 추가하지 마라. 이유: ADR-001 + PRD에 따라 D3 force-directed는 v0.2로 지연. v0.1은 deterministic 정적 SVG.
- `Graph.layout.ts` 안에서 `isPublic`/tripwire/private 판정을 다시 하지 마라. 이유: CLAUDE.md CRITICAL — 결정은 한 곳(`packages/core/src/privacy/`).
- `Math.random()`/현재시각/시스템 의존 값을 layout 계산에 쓰지 마라. 이유: 빌드 결정성과 캐시가 깨진다.
- `Graph.astro` 파일을 이 step에서 작성하지 마라. 이유: step 1의 책임 분할.
- 기존 컴포넌트(BaseLayout/Note/Backlinks/TagList/TagPage/NotFound) 파일을 수정하지 마라. 이유: 이 step의 scope 밖.
- 기존 테스트를 깨뜨리지 마라.
