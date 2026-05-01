# 아키텍처

## Monorepo 구조
```
obsidian_blog/
├── packages/
│   ├── core/                       # @noteforge/core — 프레임워크 독립 엔진
│   │   └── src/
│   │       ├── config.ts           # defineConfig() + Zod 스키마
│   │       ├── discover/
│   │       │   ├── walk.ts         # vault walker (ignore glob)
│   │       │   └── parseNote.ts    # gray-matter + %%comment%% strip
│   │       ├── resolve/wikilink.ts # Obsidian-style 타겟 해석 (aliases)
│   │       ├── slug.ts             # 한국어/공백/충돌 슬러그
│   │       ├── tags.ts             # 5가지 태그 포맷 정규화
│   │       ├── privacy/            # ★ 제품 핵심
│   │       │   ├── classify.ts          # isPublic() + tripwire
│   │       │   ├── graph.ts             # full/filtered 그래프
│   │       │   ├── linkRewriter.ts      # 위키링크 remark plugin
│   │       │   ├── commentStrip.ts      # %%...%% 제거
│   │       │   ├── frontmatterFilter.ts # allowlist 기반 필터
│   │       │   ├── transclude.ts        # ![[Note]] 재귀/제거
│   │       │   └── attachmentFilter.ts  # reference closure
│   │       ├── types.ts
│   │       └── index.ts
│   ├── astro-integration/          # @noteforge/astro — Astro Content Layer 어댑터
│   │   └── src/
│   │       ├── integration.ts      # astro:config:setup 훅
│   │       ├── loader.ts           # Content Layer loader
│   │       ├── remarkWikilink.ts   # MDX 파이프라인 브리지
│   │       ├── watcher.ts          # chokidar + invalidation
│   │       └── index.ts
│   ├── theme-default/              # @noteforge/theme-default
│   │   └── src/
│   │       ├── layouts/BaseLayout.astro
│   │       └── components/{Note,Backlinks,Graph,TagList}.astro
│   └── cli/                        # @noteforge/cli
│       └── src/
│           ├── bin.ts
│           └── commands/{dev,build,audit,status}.ts
└── apps/
    └── blog/                       # 도그푸드 사이트
        ├── astro.config.mjs
        ├── obsidian-blog.config.ts # vault 절대경로, 테마, 정책
        └── src/
            ├── content.config.ts
            └── pages/{index,[...slug],graph,api/graph.json}.astro
```

## 파이프라인 — Phase A → D

### Phase A. Discovery
`walker → parseNote(+commentStrip) → resolve/wikilink → tags`

vault 전체(public + private 모두)를 읽음. 누수 탐지를 위해 전체 그래프가 필요.

### Phase B. 분류
`privacy/classify`

```
isPublic = frontmatter.public === true
        || tags.includes('public')
        || tags.some(t => t.startsWith('public/'))
```

`private/**` 경로 파일은 **무조건** private (tripwire, `unsafeAllowPrivateFolder` 필요).

### Phase C. Graph Filtering (핵심)
`privacy/graph → linkRewriter → transclude → frontmatterFilter → attachmentFilter`

1. 공개 노드만 유지.
2. public→public 엣지만 유지.
3. `[[...]]` 위키링크: public 타겟 → 정상 `<a>`, private/미존재 → `strip-to-text`.
4. `![[...]]` transclusion: public 타겟 → 본문 재귀 확장(동일 파이프라인), private/미존재 → 노드 제거.
5. frontmatter는 allowlist 필드만 노출(`cover`/`thumbnail`은 `/attachments/<rel>`일 때 public attachment closure로 추가 검증).
6. 태그 blocklist 적용.
7. 백링크는 필터된 그래프만 사용.
8. 첨부파일은 public 노트 참조 closure만 `dist/`로.
9. `/api/graph.json`은 공개 노드 + 공개↔공개 엣지만.

### Phase D. Post-build Audit
`astro:build:done` 훅에서 `dist/` 스캔:
- private 노트 제목이 HTML에 0회
- private 첨부 파일명이 `dist/`에 0회
- `graph.json`의 모든 엣지 끝점이 public 슬러그 집합에 포함
- allowlist 밖 frontmatter 필드 0회
- `%%...%%` 문자열 0회
- tag blocklist 항목 0회

하나라도 위반하면 build fail.

## 데이터 흐름
```
vault 파일
  │
  ▼
walker ── parseNote ── commentStrip (%%...%%)
  │          │
  │          └── tags 정규화
  ▼
resolve/wikilink (aliases 포함 타겟 해석)
  │
  ▼
classify (isPublic + tripwire)
  │
  ▼
graph (full → filtered)
  │
  ▼
linkRewriter / transclude / frontmatterFilter / attachmentFilter
  │
  ▼
Astro Content Layer loader
  │
  ▼
remark/MDX (+ remarkWikilink)
  │
  ▼
HTML + graph.json + attachments
  │
  ▼
audit (gate)
  │
  ▼
dist/
```

## 상태 관리
- **빌드 시간**: 순수 함수. 모든 Phase는 입력 → 출력.
- **Dev 시간**: `watcher.ts`가 `reverseDependencies: Map<noteId, Set<noteId>>`를 in-memory로 유지. 파일 변경 시 의존 노트만 invalidate.
- **캐싱**: Astro Content Layer의 기본 캐시를 사용하되, watcher가 변경된 노트 + 의존 노트를 `invalidate()`로 드랍.

## 프레임워크 경계
- `@noteforge/core`: Astro, remark AST 타입 외 프레임워크 의존 **없음**. 추후 다른 SSG(11ty, Next.js)에도 재사용 가능.
- `@noteforge/astro`: Astro Integration API + remark 파이프라인 통합. Astro 버전 업 시 여기만 영향.
- `@noteforge/theme-default`: Astro 컴포넌트. 교체 가능한 하나의 테마.
- `@noteforge/cli`: 사용자 진입점. 내부적으로 Astro CLI를 래핑.

## 사이드바 · 폴더 라우팅

v0.3에서 도입된 사이드바와 폴더 인덱스는 *데이터 레이어 → 시각 레이어*의 분업을 v0.2의 그래프/백링크와 같은 방식으로 따른다 — privacy 필터링은 `packages/core`에서 끝내고, Astro 라우트와 테마 컴포넌트는 받은 데이터만 그린다.

### 데이터 흐름

```
Content Layer: getCollection('notes')
    │
    ▼
filterPublishable (apps/blog/src/lib/viewModels.ts)
    │  ── alias-redirect / draft / private 제외 (Phase B/C 결과 적용)
    ▼
buildFolderTree(entries) → FolderNode
    │  ── 슬러그 세그먼트로 트리 조립, 각 depth-0 폴더에 categorySlot 결정론적 해시
    ▼
Sidebar(props: { tree, currentPath, avatar, nickname, ... })
    │  ── 시각만 — 자체 필터링 없음
    ▼
FolderTree / FolderIndex / post-preview rows
```

private 노트는 `filterPublishable` 단계에서 이미 빠지므로 트리에는 자연히 부재한다 — 컴포넌트가 빈 폴더를 "비공개 가능성 있음" 같은 신호로 표시할 책임이 없다(`docs/UI_GUIDE.md` §14 참조). `FolderTree` 컴포넌트는 빈 children `<ul>` 자체를 렌더하지 않아 누설 표면이 0이다.

### 목록 미리보기 데이터

홈, 카테고리, 폴더 인덱스, 태그 페이지의 게시물 미리보기는 같은 view-model 규칙을 따른다.

- 썸네일: `entry.data.thumbnailImage ?? entry.data.heroImage`. `cover`/`thumbnail`의 `/attachments/<rel>` 값은 core `publicFrontmatter` 단계에서 public attachment closure로 먼저 검증되고, loader도 동일 규칙을 방어적으로 재확인한다.
- 서문: `frontmatter.description`이 non-empty string이면 우선 사용. 없으면 `entry.rendered.html`에서 HTML 태그를 제거한 앞부분을 excerpt로 사용한다.
- 본문 fallback은 raw vault body를 다시 읽지 않는다. `entry.rendered.html`은 Phase C의 link/transclude/comment/frontmatter privacy 처리를 지난 산출물이므로, listing 레이어가 별도 privacy 판정을 재구현하지 않아도 된다.
- leading body tag marker(`#public`, `#essay` 등)는 excerpt 앞에서 제거한다. 공개 opt-in 표식이 사용자-facing 서문을 밀어내지 않게 하기 위한 표시 규칙이며, 공개/비공개 판정에는 관여하지 않는다.
- 렌더 순서: 썸네일 왼쪽, 오른쪽에 `title → description/excerpt → tags | date`.

### 폴더 라우팅

`apps/blog/src/pages/[...slug].astro`의 단일 dynamic route가 세 가지 분기를 처리한다.

```
kind: 'note'             ── 공개 노트의 본문 페이지
kind: 'alias-redirect'   ── 별칭 → canonical 슬러그로 meta-refresh (v0.1)
kind: 'folder-index'     ── 폴더 인덱스 페이지 (v0.3 신규)
```

- 폴더 인덱스 URL은 `/path/with/slashes/` (`trailingSlash: 'always'`, ADR-012).
- `getStaticPaths`는 세 분기를 모두 합쳐 반환하며, props의 `kind` 필드로 페이지가 분기 렌더한다.
- `kind: 'folder-index'` props는 `breadcrumb`, `categorySlot`, `childFolders`, `childNotes`를 담는다(`docs/UI_GUIDE.md` 7-5).

### 충돌 가드 — 빌드 타임 throw

폴더 경로가 노트 슬러그 또는 alias id와 충돌하면 빌드 타임에 throw한다. 이 가드는 `apps/blog/src/pages/[...slug].astro:39`의 alias↔note 충돌 throw 패턴을 그대로 따른다.

```ts
// 의사 코드 — 정확한 구현은 step 6
const claimed = new Set<string>();
for (const route of [...noteRoutes, ...aliasRoutes, ...folderIndexRoutes]) {
  if (claimed.has(route.params.slug)) {
    throw new Error(
      `[...slug] route collision: '${route.params.slug}' (${route.props.kind}) ` +
        `would overwrite an existing route. Resolve in vault frontmatter or folder layout before building.`,
    );
  }
  claimed.add(route.params.slug);
}
```

silent override는 *어느 분기가 이긴 건지* 사용자가 알기 어려워 노트 누락 사고로 이어진다 — alias collision 가드와 동일하게 명시적으로 fail-fast한다.

### `buildFolderTree` 위치 결정 — `apps/blog/src/lib/folderAggregation.ts`

폴더 트리 빌드는 `packages/core` 재사용 가치가 낮다고 판단해 `apps/blog/src/lib/folderAggregation.ts`에 둔다. 입력이 Astro `CollectionEntry`(Content Layer 타입)이고 출력이 `Sidebar`/`FolderIndex` props 형태이므로, 코어 재사용 시점에서는 어차피 어댑터 레이어가 다시 필요하다. 트레이드오프 표는 `phases/step10-v03-sidebar-redesign/TODO.md`(트리키한 결정 사항)에 정리되어 있다. 슬롯 매핑 해시(`categorySlot.ts`)만 코어로 — 그건 vault-agnostic.

## 다이어그램 (MVP 이후)
- v0.2: 다중 vault 테마 해석 프로토콜 — 각 vault의 `theme` 경로를 Astro config에 동적으로 merge.
- v0.3: Obsidian 플러그인 래퍼 — Obsidian 내부에서 CLI를 호출하고 진행 상황을 사이드바에 표시.
