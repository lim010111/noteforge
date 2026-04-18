# Step 1: privacy-graph

## 작업

`packages/core/src/privacy/graph.ts` + 그 테스트를 **TDD**로 작성한다. 노트 노드와 엣지(링크+임베드)로 전체 그래프를 만들고, **공개 서브그래프**를 추출하는 순수 함수를 제공. 공개 판정은 이 모듈이 하지 않고 **사전 분류된 `isPublic` 플래그**를 입력받는다(결정은 `classify.ts`가 유일 출처).

## 읽어야 할 파일

- `packages/core/src/types.ts` — `ParsedNote`, `Classification` 등 기존 타입과 충돌 없이 export.
- `packages/core/src/privacy/classify.ts` — 공개 판정의 출력 형태. graph는 이 결과를 **신뢰**하고 재판정하지 않는다.
- `packages/core/src/resolve/wikilink.ts` — `IndexedNote`, `WikilinkResolution`의 `note.id`와 graph 노드 `id`가 동일 의미(relativePath 기반 stable id)여야 한다.
- 이전 step: `packages/core/src/privacy/frontmatterFilter.ts` — 이 step은 frontmatterFilter를 직접 import하지 않지만, 노드의 `title`은 filtered frontmatter에서 오거나 caller가 결정한다(이 모듈은 title을 옵션으로 받기만 함).

## 공개 인터페이스 (시그니처 고정)

```ts
export interface GraphNode {
  readonly id: string;            // stable note id (relativePath 기반 권장)
  readonly relativePath: string;
  readonly title?: string;        // 없으면 basename 등 caller가 결정
  readonly isPublic: boolean;
}

export type GraphEdgeKind = 'link' | 'embed';

export interface GraphEdge {
  readonly from: string;          // source note id
  readonly to: string;            // target note id (resolved); unresolved 엣지는 입력에 넣지 않는다
  readonly kind: GraphEdgeKind;
}

export interface Graph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export function buildGraph(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Graph;

export function filterToPublicSubgraph(graph: Graph): Graph;

export function computeBacklinks(
  graph: Graph,
): ReadonlyMap<string, readonly GraphEdge[]>;
```

### 규칙

- `buildGraph`: 입력 그대로 dedupe + 정렬 후 `Graph` 반환. **유효성 검사**:
  - 중복 노드 id → 두 번째 이후 무시 + `console.warn`.
  - `edge.from` 또는 `edge.to`가 노드 집합에 없는 엣지 → **제외** + `console.warn` (dangling 금지).
  - 중복 엣지(동일 from+to+kind) → 1개로 dedupe.
- `filterToPublicSubgraph`:
  - 노드: `isPublic === true`만 유지.
  - 엣지: `from`과 `to`가 **둘 다** 공개 노드 집합에 속한 것만 유지 (public↔public).
  - public→private, private→public, private→private 엣지는 전부 제거. 특히 **public→private은 여기서 제외** — 이후 linkRewriter가 strip-to-text로 처리하므로 그래프에는 존재조차 하면 안 된다(`/api/graph.json` 누수 방지).
- `computeBacklinks`:
  - 결과 map의 key는 **to** 노드 id, value는 해당 노드로 들어오는 엣지 배열. 입력 그래프 기준(필터 후 그래프를 넘기면 필터된 백링크).
  - 한 노드로 들어오는 엣지가 없으면 key 자체가 map에 없음(빈 배열이 아니라 undefined).
  - 정렬: 각 key의 value 배열은 `from` id 사전순.

## 테스트 (TDD)

`packages/core/tests/graph.test.ts`에 최소 12 케이스.

1. 빈 입력 → `{ nodes: [], edges: [] }`.
2. 노드 2개 + 엣지 1개 정상 → 그대로 반환.
3. 중복 노드 id → 1개로 dedupe + warn 한 번.
4. dangling 엣지(`to`가 노드 집합 밖) → 제거 + warn.
5. dangling 엣지(`from`이 노드 집합 밖) → 제거 + warn.
6. 중복 엣지(동일 from/to/kind) → 1개로 dedupe.
7. 동일 from/to지만 kind 다름(link + embed) → 둘 다 유지(별개 엣지).
8. `filterToPublicSubgraph`: public 2 + private 1 노드, 엣지 pub→pub + pub→priv → 공개 서브그래프: 노드 2, 엣지 1(pub→pub).
9. `filterToPublicSubgraph`: 전부 private → 노드/엣지 모두 빈 Graph.
10. `filterToPublicSubgraph`: private→public 엣지는 제거(역방향 누수 가능성 방지).
11. `computeBacklinks`: `A→B`, `C→B`, `A→C` → key `B` = `[A→B, C→B]`(from 정렬), key `C` = `[A→C]`, key `A` 없음.
12. `computeBacklinks` 입력이 공개 서브그래프: 백링크에 private 소스가 등장하지 않음(필터된 그래프 기준이므로 자동 보장).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

새 테스트 12개 전부 통과, 기존 회귀 0건.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - **CRITICAL**: `filterToPublicSubgraph`가 **어떤 경우에도** 공개 집합 바깥 id를 결과 노드/엣지에 포함하지 않는다.
   - graph 모듈 내부에서 `classify()`를 호출하지 않는다(공개 판정은 외부 책임, 재실행 금지).
   - 반환 `Graph`의 `nodes`/`edges` 배열은 **결정적**(동일 입력 → 동일 순서). 순서 규칙: nodes는 `id` 사전순, edges는 `from`→`to`→`kind` 사전순.
   - 반환 객체는 `readonly` 타입 준수 (`Object.freeze`까지는 필요 없음).
3. `phases/step2b-core-privacy-modules/index.json`의 step 1 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "privacy/graph.ts + 12 tests + buildGraph dedupe + public subgraph filter + backlinks map"`.
   - 실패/차단 → error/blocked 기록.

## 금지사항

- **graph 내부에서 `classify()`를 호출하지 마라.** 이유: 공개 판정의 단일 출처 원칙. graph는 사전 분류 결과를 소비만 한다. 재판정은 정의가 어긋날 경우 무음 누수의 원인.
- **`filterToPublicSubgraph`에서 "부분 공개" 엣지를 만들지 마라.** 이유: public→private 엣지의 `to` id가 남아 `/api/graph.json`에 노출되면 private 노트의 존재 자체가 드러난다. 반드시 양 끝 모두 공개여야 유지.
- **unresolved 엣지를 그래프에 넣지 마라.** 이유: 입력 스키마는 `to: string` (resolved id). 미해결 wikilink는 linkRewriter가 별도 처리하며 graph 입력에는 포함되면 안 된다.
- **grraph 노드에 `body`/`frontmatter` 원본을 넣지 마라.** 이유: 이 그래프는 `/api/graph.json`으로 직렬화 가능한 경량 구조. 큰 payload가 들어가면 실수 노출 위험 + 직렬화 부담 증가.
- 기존 테스트를 깨뜨리지 마라.
