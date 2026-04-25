# Step 1: graph-component

Step 0에서 만든 `computeCircularLayout`을 입력으로 받아 정적 SVG를 렌더하는 `Graph.astro`를 작성한다. 노드는 반드시 클릭 가능(`<a href>`), 호버 시 제목 툴팁(`<title>`)을 노출한다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `docs/PRD.md` — Reader UX의 "그래프 페이지" 섹션 (정적 SVG, 노드 클릭 가능, 호버 툴팁, 장식 금지)
- `docs/UI_GUIDE.md` — 색상/타이포 토큰. 그래프 시각 토큰: 노드 fill `#18181b`, hover `#2563eb`, 엣지 stroke `#a1a1aa`, 노드 r=4 권장 (UI_GUIDE 본문에서 부합하는 토큰을 직접 골라 적용)
- `docs/ARCHITECTURE.md` — Phase C 그래프 필터링이 컴포넌트에 도달하기 전 단계임을 확인
- `packages/theme-default/src/components/Graph.layout.ts` — Step 0 산출물. 시그니처와 export
- `packages/theme-default/src/components/Backlinks.types.ts` + `Backlinks.astro` — view-model strict subset 패턴, allowlist 강제, empty-state silence 패턴을 그대로 따른다
- `packages/theme-default/src/components/TagPage.astro` — 빈 상태(안내 문구) 처리 패턴 참고
- `packages/theme-default/src/index.ts` — re-export 위치
- `packages/theme-default/tests/Backlinks.test.ts`, `tests/TagList.test.ts` — Container API 테스트 패턴(getViteConfig project) 그대로 따름

## 작업

### 1. 새 파일 — `packages/theme-default/src/components/Graph.types.ts`

`Backlinks.types.ts`의 주석 톤(allowlist/호출자 책임 명시)을 그대로 복제해 다음 시그니처를 export하라.

```ts
import type { GraphViewModel } from './Graph.layout.ts';

// 컴포넌트가 받는 props.
//
// `graph.nodes[i].slug`/`graph.nodes[i].title`이 모두 PUBLIC이라는 사실은
// 호출자(astro-integration loader 또는 apps/blog 페이지)가 보증한다.
// 이 컴포넌트는 isPublic을 재판정하지 않는다.
export interface GraphProps {
  graph: GraphViewModel;
  /** 빈 그래프(노드 0개)일 때 표시할 안내 문구. 기본 "아직 공개된 글이 없습니다." */
  emptyMessage?: string;
  /** 시각적 폭/높이를 제한하는 root 클래스. 기본 `max-w-3xl mx-auto`. */
  className?: string;
}

export type { GraphViewModel, GraphNode, GraphEdge } from './Graph.layout.ts';
```

### 2. 새 파일 — `packages/theme-default/src/components/Graph.astro`

요구사항:

- props는 위 `GraphProps`를 사용한다 (`Note.astro`처럼 field-level props; 단일 frontmatter blob 금지).
- `import { computeCircularLayout } from './Graph.layout.ts'`로 좌표 계산.
- `graph.nodes.length === 0`인 경우 `<svg>` 자체를 렌더하지 않는다. 대신 `<p class="text-zinc-500 text-sm">{emptyMessage}</p>` 한 줄. (UI_GUIDE의 메타 톤)
- `graph.nodes.length > 0`인 경우:
  - 루트 `<figure>` 안에 `<svg viewBox="...minX minY width height" width="100%" height="auto" role="img" aria-label="공개 노트 그래프">`.
  - 엣지를 먼저, 노드를 나중에 그린다 (z-order — 노드가 엣지를 가려야 함).
  - 엣지: `<line x1 y1 x2 y2 stroke="#a1a1aa" stroke-width="1" />`.
  - 각 노드: `<a href={`/${slug}`} class="..."><circle cx={x} cy={y} r="4" class="fill-zinc-900 hover:fill-blue-600" /><title>{title}</title></a>`.
  - **`<title>`은 SVG accessibility name** — 마우스 호버 시 브라우저 기본 툴팁이 뜬다.
- 키보드 포커스 outline 유지(제거 금지). UI_GUIDE 접근성 규칙.
- 외부 스크립트 또는 클라이언트 JS **금지** — 정적 SVG.
- 애니메이션 금지 (link hover의 색 transition은 OK, 150ms).
- AI slop 금지: gradient, blur, shadow glow, rounded-2xl 균일 처리, 보라/인디고 사용 금지 (UI_GUIDE).

### 3. `packages/theme-default/src/index.ts`에 re-export 추가

```ts
export { default as Graph } from './components/Graph.astro';
export type { GraphProps } from './components/Graph.types.ts';
export type {
  GraphViewModel,
  GraphNode,
  GraphEdge,
  PositionedGraph,
  PositionedNode,
  PositionedEdge,
  ViewBox,
  LayoutOptions,
} from './components/Graph.layout.ts';
export { computeCircularLayout } from './components/Graph.layout.ts';
```

### 4. 새 테스트 파일 — `packages/theme-default/tests/Graph.test.ts`

기존 `Backlinks.test.ts`와 동일한 Container API 패턴(`AstroContainer.create()` + `container.renderToString(Graph, { props })`)을 따른다. 다음 단언을 작성하라:

1. **노드 수 = `<circle>` 수**: 입력 N개 노드 → 렌더된 HTML에서 `circle` 등장 횟수 = N.
2. **모든 노드는 `<a href="/<slug>">`로 감싸짐**: 각 노드 slug마다 정확히 하나의 `<a href="/<slug>">` 등장.
3. **엣지 수 = `<line>` 수**: 입력 M개 엣지 → `line` 등장 횟수 = M (알 수 없는 slug 엣지는 layout에서 drop된 결과 반영).
4. **viewBox 출력**: 루트 SVG에 `viewBox="..."` 속성 등장 + `role="img"` + `aria-label` 속성 존재.
5. **빈 그래프 silence**: `{ nodes: [], edges: [] }` → 렌더 HTML에 `<svg`/`<circle`/`<line`이 등장하지 않고, `emptyMessage`(또는 기본값)는 등장한다.
6. **canary 부재**: 입력 노드 title에 canary가 없을 때, 렌더 HTML에 `DO_NOT_LEAK_BANANA_6f3c1`/`CLAUDE_COMMENT_LEAK_77b`이 0회 등장 (회귀 보험).
7. **추가 필드 누설 방지**: 입력 노드에 `(node as any).privateNote = "DO_NOT_LEAK_BANANA_6f3c1"`를 부착해도 렌더 HTML에 canary 0회 등장.
8. **호버 툴팁 = title**: 각 노드의 `<title>{title}</title>`이 정확히 한 번 등장.
9. **클라이언트 JS 부재**: 렌더 HTML에 `<script` 태그 0회 등장.

### 5. 검증 (mutation check)

이전 step output들의 4-mutation 패턴을 따른다. 각 mutation을 적용 → 해당 테스트 실패 확인 → 원복. 본 commit에는 원본만.

- **A**: 노드 `<a>` 래핑 제거 → 테스트 2 실패.
- **B**: 빈 그래프에서도 `<svg>`를 렌더(silence 깨짐) → 테스트 5 실패.
- **C**: 노드 props에 `{...node}` spread로 모든 필드를 SVG attribute에 누설 → 테스트 7 실패.
- **D**: `<script>...</script>` 한 줄 삽입 → 테스트 9 실패.

각 결과를 summary에 `A/B/C/D 실패 재현 OK`로 기록.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

전부 통과. 신규 Container 테스트 최소 9개.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md 디렉토리 구조 준수 (`packages/theme-default/src/components/Graph.{astro,types.ts}`).
   - ADR-007(자체 위키링크 plugin) 정신 — 컴포넌트 안에서 링크 텍스트를 다시 가공하지 않는다(이미 호출자가 정제).
   - UI_GUIDE 색상 토큰만 사용. 새 색 도입 금지.
   - CLAUDE.md CRITICAL — `Graph.astro` 안에서 isPublic / private 판정 다시 하지 않는다.
   - PRD: 노드 클릭 가능 ✓, 호버 툴팁 ✓.
3. 결과에 따라 `phases/step4c-theme-graph-and-polish/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Graph.astro + Graph.types + N Container tests + index re-export; canary/script 부재 검증; mutation A/B/C/D 재현 OK"`
   - 실패 3회 → `"status": "error"` + `error_message`
   - 사용자 개입 필요 → `"status": "blocked"` + `blocked_reason` 후 중단

## 금지사항

- 클라이언트 JavaScript를 추가하지 마라. 이유: PRD가 v0.1을 정적 SVG로 못박았고, 클라이언트 코드는 새로운 누출 표면이 된다.
- D3/cytoscape/canvas/WebGL을 추가하지 마라. 이유: ADR — v0.2 항목.
- 입력 노드에서 추가 필드(예: `tags`, `date`)를 SVG `data-*` 속성으로 직렬화하지 마라. 이유: 일반화된 직렬화 = 일반화된 누출. 출력은 `slug`/`title`/좌표만.
- `Graph.astro`에 `import { isPublic }` 또는 `private` 판정 로직을 두지 마라. 이유: CLAUDE.md CRITICAL — 결정은 한 곳.
- 기존 테스트를 깨뜨리지 마라.
- Step 0의 `Graph.layout.ts` 시그니처/이름을 변경하지 마라. 이유: 본 step의 계약.
