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
5. frontmatter는 allowlist 필드만 노출.
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

## 다이어그램 (MVP 이후)
- v0.2: 다중 vault 테마 해석 프로토콜 — 각 vault의 `theme` 경로를 Astro config에 동적으로 merge.
- v0.3: Obsidian 플러그인 래퍼 — Obsidian 내부에서 CLI를 호출하고 진행 상황을 사이드바에 표시.
