# Step 2: blog-routes-graph-and-tags

그래프 페이지와 태그 인덱스/개별 라우트, 그리고 그래프 데이터 endpoint를 추가한다. graph endpoint와 graph 페이지가 동일한 `runCorePipeline` 결과를 두 번 돌리지 않도록 module-level memoize를 도입한다(`apps/blog/src/lib/pipelineCache.ts`). step 1에서 깐 라우트 패턴을 그대로 따른다.

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — Phase C(공개 그래프), Phase D(audit가 graph.json 검증).
- `/docs/PRD.md` — 그래프/태그 페이지 UX (그래프 노드는 클릭 가능 `<a href>` 필수).
- `/docs/UI_GUIDE.md` — 컴포넌트 스타일.
- step 0/1 산출물 (`apps/blog/src/{lib/viewModels.ts,pages/index.astro,pages/[...slug].astro}`).
- `/packages/core/src/pipeline.ts` — `runCorePipeline` 시그니처, `PipelineResult.publicGraph` 형태.
- `/packages/core/src/privacy/graph.ts` — `GraphNode`, `GraphEdge`, `PublicGraph` 타입.
- `/packages/theme-default/src/components/Graph.astro` + `Graph.types.ts` + `Graph.layout.ts` — `GraphProps`, `GraphViewModel`, `computeCircularLayout`.
- `/packages/theme-default/src/components/TagList.astro` + `TagList.types.ts` — 인덱스 페이지 props.
- `/packages/theme-default/src/components/TagPage.astro` + `TagPage.types.ts` — 개별 태그 페이지 props.

## 작업

### 1. 디렉토리 구조 (이 step 종료 시점)

```
apps/blog/
└── src/
    ├── lib/
    │   ├── viewModels.ts            # (step 1 산출물)
    │   ├── pipelineCache.ts         # NEW — module-level memoize
    │   └── tagAggregation.ts        # NEW — tags 집계 헬퍼 (테스트 가능)
    └── pages/
        ├── graph.astro              # NEW
        ├── api/
        │   └── graph.json.ts        # NEW — endpoint
        └── tags/
            ├── index.astro          # NEW — TagList
            └── [tag].astro          # NEW — TagPage
```

### 2. `apps/blog/src/lib/pipelineCache.ts`

```ts
import { runCorePipeline, type PipelineResult } from '@obpub/core/pipeline';
import obpubConfig from '../../obsidian-blog.config.ts';

/**
 * 빌드 1회 동안 runCorePipeline 결과를 한 번만 계산.
 *
 * Astro static 빌드는 페이지/엔드포인트별로 모듈을 새로 평가하지 않는다.
 * 동일 워커 프로세스 안에서 import가 캐시되므로 module-level Promise를 한 번 만들면
 * 재호출 시 동일 인스턴스 반환 — 같은 vault를 두 번 walk하지 않는다.
 *
 * dev 모드에서는 watcher invalidation이 모듈을 재평가시킬 때 새 인스턴스가 생긴다 (의도된 동작).
 */
let cached: Promise<PipelineResult> | undefined;

export function getPipelineResult(): Promise<PipelineResult> {
  if (cached === undefined) {
    cached = runCorePipeline(obpubConfig);
  }
  return cached;
}
```

이 모듈은 `getCollection('notes')`와 별개의 데이터 경로다. loader도 내부적으로 `runCorePipeline`을 부르지만 그건 Content Layer 캐시 경로이고, 여기는 graph/tags의 메타 정보용. **두 번 walk 되더라도 정합성 위배는 아니다** — 둘 다 동일 source-of-truth(core)에서 도출되기 때문. 성능만 신경 쓰면 됨.

### 3. `apps/blog/src/pages/api/graph.json.ts`

```ts
import type { APIRoute } from 'astro';
import { getPipelineResult } from '../../lib/pipelineCache.ts';

export const prerender = true;

export const GET: APIRoute = async () => {
  const result = await getPipelineResult();
  // PipelineResult.publicGraph는 이미 공개 노드 + 공개↔공개 엣지만 포함.
  // 그대로 직렬화 — 추가 필터 금지(이중 결정 방지).
  const payload = {
    nodes: result.publicGraph.nodes,
    edges: result.publicGraph.edges,
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
```

audit가 검증하는 위치: `apps/blog/dist/api/graph.json`. 모든 엣지 끝점이 공개 슬러그 집합에 속해야 함 — pipeline이 보장.

### 4. `apps/blog/src/pages/graph.astro`

```astro
---
import { BaseLayout, Graph, computeCircularLayout, type GraphViewModel } from '@obpub/theme-default';
import { getPipelineResult } from '../lib/pipelineCache.ts';
import '../styles/global.css';

const result = await getPipelineResult();

const view: GraphViewModel = {
  nodes: result.publicGraph.nodes.map((n) => ({
    id: n.id,
    label: n.title ?? n.id,
    href: `/${n.id}`,
  })),
  edges: result.publicGraph.edges.map((e) => ({ from: e.from, to: e.to })),
};

const positioned = computeCircularLayout(view, { /* 컴포넌트 기본값 사용 */ });
---
<BaseLayout title="그래프">
  {view.nodes.length === 0 ? (
    <p>아직 공개된 글이 없습니다.</p>
  ) : (
    <Graph graph={positioned} />
  )}
</BaseLayout>
```

`GraphViewModel`/`PositionedGraph`/`LayoutOptions`의 정확한 시그니처를 보고 위 매핑을 맞춰라. `Graph.layout.ts`의 `computeCircularLayout` 결과를 그대로 prop으로 넘기면 충분하다 (theme에서 이미 SVG 렌더링 처리).

### 5. tags 라우트

`apps/blog/src/lib/tagAggregation.ts`:

```ts
import type { CollectionEntry } from 'astro:content';
import type { TagSummary, TagPageEntry } from '@obpub/theme-default';

type NotesEntry = CollectionEntry<'notes'>;

/**
 * 태그 → 사용 횟수 + 노트 슬러그 목록.
 *
 * - tags는 entry.data.tags(이미 tagBlocklist 적용 완료).
 * - 정렬: count 역순, 동률은 tag ASC.
 * - 빈 태그 / 빈 슬러그는 제외.
 */
export function summarizeTags(entries: readonly NotesEntry[]): TagSummary[];

/**
 * 단일 태그 페이지에 들어갈 entries.
 *
 * - 해당 태그를 포함한 노트만 필터.
 * - draft 필터는 호출자가 이미 적용한 상태로 전달 — 여기서 다시 필터하지 않음.
 * - 정렬은 frontmatter.date 역순(없는 항목은 가장 뒤).
 */
export function entriesForTag(
  tag: string,
  entries: readonly NotesEntry[],
): TagPageEntry[];
```

vitest 케이스 5 이상 (`apps/blog/tests/tagAggregation.test.ts`):

1. `summarizeTags`: 0 entries → `[]`.
2. `summarizeTags`: 같은 태그 2번 사용 → count=2.
3. `summarizeTags`: count 역순, 동률 ASC.
4. `entriesForTag`: 매칭되는 노트만 반환.
5. `entriesForTag`: date 역순 + date 부재는 뒤.

`apps/blog/src/pages/tags/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import { BaseLayout, TagList } from '@obpub/theme-default';
import { filterPublishable } from '../../lib/viewModels.ts';
import { summarizeTags } from '../../lib/tagAggregation.ts';
import '../../styles/global.css';

const publishable = filterPublishable(await getCollection('notes'));
const summaries = summarizeTags(publishable);
---
<BaseLayout title="태그">
  <TagList tags={summaries} />
</BaseLayout>
```

`apps/blog/src/pages/tags/[tag].astro`:

```astro
---
import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { BaseLayout, TagPage } from '@obpub/theme-default';
import { filterPublishable } from '../../lib/viewModels.ts';
import { summarizeTags, entriesForTag } from '../../lib/tagAggregation.ts';
import '../../styles/global.css';

export const getStaticPaths: GetStaticPaths = async () => {
  const publishable = filterPublishable(await getCollection('notes'));
  const summaries = summarizeTags(publishable);
  return summaries.map((s) => ({
    params: { tag: s.tag },
    props: { tag: s.tag, entries: entriesForTag(s.tag, publishable) },
  }));
};

const { tag, entries } = Astro.props;
---
<BaseLayout title={`#${tag}`}>
  <TagPage tag={tag} entries={entries} />
</BaseLayout>
```

`TagSummary`/`TagPageEntry`의 정확한 필드명을 보고 매핑을 정확히 맞춰라(theme이 요구하는 prop 모양에 따라 헬퍼 반환 타입을 조정).

태그 URL의 한국어/특수문자 처리: Astro의 `[tag]` 파라미터는 자동 `encodeURIComponent`. core의 `slug.ts`처럼 lowercase + 공백 → `-` 정책을 적용할지 결정. **권장: tag 자체는 vault의 원형 그대로 URL에 사용**(별도 정규화는 v0.2). audit가 tag blocklist 위반을 검사할 때 원형 비교 — pipeline이 이미 정규화된 형태를 보장.

### 6. nav 활성화

step 1에서 nav에 그래프/태그 링크를 비워뒀다면 이 step에서 활성화한다. theme의 BaseLayout이 nav 항목을 props로 받는지, 또는 hard-coded인지 확인 후 적절한 위치에 추가. **theme를 fork하지 마라** — nav가 hard-coded라면 BaseLayout을 그대로 두고 추가 nav 항목은 theme PR로 분리.

### 7. graph endpoint vs collection 정합성 검사

audit의 한 검사가 "graph.json의 모든 엣지 끝점이 public 슬러그 집합 안" 인데, 이는 pipeline 출력만으로 보장된다. apps/blog 라우트가 추가 가공을 하지 않으므로 자동 통과 — **추가 가공 금지**가 곧 정합성.

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

전부 0 exit. 0-public 시나리오에서도 build 통과 — graph.astro/tags 모두 빈 상태 렌더.

build 산출물 검증 (build 후 grep으로 즉시 확인):

- `apps/blog/dist/api/graph.json` 존재 (0-public 시 `{"nodes":[],"edges":[]}`).
- `apps/blog/dist/graph/index.html` 또는 `apps/blog/dist/graph.html` 존재.
- `apps/blog/dist/tags/index.html` 존재 (0-public 시 빈 목록).

신규 vitest 케이스 5 이상.

## 검증 절차

1. AC 커맨드 실행.
2. `apps/blog/dist/api/graph.json` 내용 검사: nodes 길이 == publicSlugs 크기, 모든 edge.from/to 가 nodes의 id 집합에 속함.
3. 아키텍처 체크리스트:
   - graph/tags가 공개 판정을 재구현하지 않는가? (pipeline 출력 그대로 사용)
   - `getPipelineResult` 외에서 `runCorePipeline`을 부르지 않는가?
   - tag URL 정규화 정책이 일관된가? (vault 원형 사용)
4. 결과에 따라 `phases/step6-apps-blog/index.json`의 step 2를 업데이트.

## 금지사항

- **graph 데이터를 라우트에서 직접 필터링하지 마라.** 이유: pipeline이 이미 공개 subgraph만 노출. 라우트의 추가 필터는 결정 분산이며 audit invariant를 흔든다.
- **graph.json에 메타 데이터(timestamp, vault id 등)를 추가하지 마라.** 이유: audit 스캐너가 단순 키-값 모양을 가정한다. 노드/엣지 외 키는 v0.2 이후.
- **태그 정규화 함수를 apps/blog에 새로 만들지 마라.** 이유: `core/src/tags.ts`가 single source of truth. 새 정규화는 거기에 추가하고 import.
- **theme의 BaseLayout/Graph/TagList/TagPage를 fork 또는 wrap하지 마라.** 필요한 변경은 theme-default PR로 분리.
- **`getPipelineResult` cache를 외부에 export 또는 다른 페이지가 reset하게 만들지 마라.** 이유: 단일 빌드의 결정성을 깬다.
- **graph 페이지에 D3 또는 SVG 인터랙션 JS를 추가하지 마라.** 이유: MVP는 정적 SVG (Plan ADR + UI_GUIDE).
- **기존 테스트를 깨뜨리지 마라.** 특히 vault-mixed canary, watcher 통합 테스트, audit 단위 테스트.
