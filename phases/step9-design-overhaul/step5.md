# Step 5: backlinks-tags-graph

`Backlinks.astro`, `TagList.astro` / `TagPage.astro`, `Graph.astro` 세 컴포넌트의 시각을 v0.2 토큰으로 일괄 정렬한다. 데이터 단계는 이미 privacy filtered(public-only)이므로 시각 단계에서 추가 검증/필터를 도입하지 않는다.

## 읽어야 할 파일

먼저 다음을 읽어 합의/현행을 정확히 파악하라:

- `phases/step9-design-overhaul/design/COMPONENTS.md` — Backlinks/TagList/Graph/TagPage 시안.
- `phases/step9-design-overhaul/design/TOKENS.md` — 라이트/다크 토큰.
- `docs/UI_GUIDE.md` (step 1 결과) — 컴포넌트 가이드.
- `packages/theme-default/src/components/Backlinks.astro` + `Backlinks.types.ts`
- `packages/theme-default/src/components/TagList.astro` + `TagList.types.ts`
- `packages/theme-default/src/components/TagPage.astro` + `TagPage.types.ts`
- `packages/theme-default/src/components/Graph.astro` + `Graph.layout.ts` + `Graph.types.ts`
- `packages/core/src/privacy/graph.ts` — full/filtered graph. **본 step은 이 동작을 변경하지 않는다.**
- `apps/blog/src/pages/api/graph.json.ts` — graph endpoint(필터된 데이터만 노출).
- `apps/blog/src/pages/graph.astro` + `apps/blog/src/pages/tags/` — 페이지 진입점.

## 작업

### 5-1. Backlinks.astro

- 노트 하단 영역으로 둘지 사이드 영역으로 둘지는 시안의 결정을 따른다.
- 각 backlink 항목은 노트 제목 + 짧은 컨텍스트 스니펫(있다면). 제목은 본문 링크 톤(`var(--color-fg-link)`).
- 제목·스니펫 사이 spacing은 `var(--space-3)` 정도, 항목 간 분리는 `border-bottom: 1px solid var(--color-border-default)` 또는 시안 결정.
- backlink가 0건이면 해당 섹션을 렌더하지 않는다(빈 헤더 표시 금지). 또는 시안에서 "관련 노트 없음" 안내 카피가 있으면 그 카피 그대로.
- privacy: filtered graph가 이미 backlink 후보를 줄였다. 시각 단계에서 추가 필터 금지.

### 5-2. TagList.astro / TagPage.astro

- **TagList** — 태그 칩 컴포넌트. 시안 토큰을 따른 chip 스타일(예: `background: var(--color-bg-surface); border: 1px solid var(--color-border-default); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-small);`). hover 시 surface 톤 강조.
- **TagPage** — 태그별 인덱스 페이지. 노트 카드 그리드. 시안 결정에 따라 카드 디자인 — 모든 카드에 동일 radius 강요 금지(v0.2 안티패턴 정책 준수). 카드 hover/focus 톤 도입.
- 모바일에서는 grid → 단일 컬럼.

### 5-3. Graph.astro (정적 SVG)

`Graph.astro`는 SVG를 정적 출력한다. 라이트/다크 모두에서 가독성이 유지되도록 노드/엣지 색을 토큰 변수로 전환:

- 노드 채움: `var(--color-fg-default)` (현재 노트는 `var(--color-accent)`, 일반 노드는 `var(--color-fg-muted)`).
- 노드 stroke: `var(--color-border-strong)`.
- 엣지: `var(--color-border-default)`.
- 라벨 텍스트: `var(--color-fg-default)`, 작은 노드는 라벨 생략.
- 클릭 가능 — `<a href>`로 감싸 키보드 접근성 유지.
- focus visible: `outline: 2px solid var(--color-focus-ring); outline-offset: 2px;` (SVG 내부 a에도 적용).

SVG 안에서 `<style>` 인라인을 사용하면 외부 CSS 변수가 잘 잡힌다 — 또는 SVG presentation attribute 대신 CSS class를 사용. 결정은 시안 + 현행 `Graph.layout.ts` 패턴을 따른다.

`Graph.layout.ts`(레이아웃 계산)와 `Graph.types.ts`(타입)는 데이터 가공 로직 — 본 step에서 시각 외 변경 금지.

### 5-4. NotFound.astro (404)

- 시각만 v0.2 토큰으로 갱신.
- 카피는 그대로: "해당 노트가 없거나 비공개입니다." (private 존재 누설 금지).
- 홈 링크 + 태그 인덱스 링크 유지.

### 5-5. 테스트

각 컴포넌트의 기존 테스트를 회귀 0으로 통과시키되 다음 신규 케이스 보강:

- `Backlinks.test.ts`: 0건일 때 섹션 미렌더, 1건 이상일 때 항목 렌더.
- `TagList.test.ts`: 태그 칩에 `<a href>`와 토큰 기반 클래스가 적용. 빈 태그 목록일 때 동작.
- `TagPage.test.ts`: 노트 카드 0건일 때 "이 태그에는 공개된 노트가 없습니다." 또는 시안 카피.
- `Graph.test.ts`: SVG 출력에 `<a href>` 노드가 모든 노드를 감싼다(키보드 접근성), 색상이 CSS 변수 또는 클래스로 추상화됨.
- `NotFound.test.ts` 또는 page-level: "삭제됨" 같은 단어가 결과 HTML에 0회 등장.

테스트는 SSR 렌더 결과 문자열 검사(기존 패턴) 또는 happy-dom 환경.

### 5-6. privacy 회귀 0

빌드 후 다음을 확인:

- `apps/blog/dist/api/graph.json` (또는 `graph.json.ts`의 출력)에 private 노트가 0건. 기존 audit이 이미 검증.
- `apps/blog/dist/` 어떤 페이지에서도 backlinks/tags/graph가 private 노트 제목·슬러그를 노출하지 않는다. canary 검증 0/0.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

추가 검증:
- canary 2종 0회 (`grep -r ... apps/blog/dist/`).
- audit 위반 0.
- 다크 모드 전환 시 graph 노드/엣지가 시각적으로 가독성 유지(시각 회귀 — 시안 명세된 색 대비 검증).

## 검증 절차

1. 위 AC 커맨드 실행.
2. privacy 회귀 체크리스트:
   - graph endpoint가 filtered 데이터만 출력?
   - backlinks/tags가 private 슬러그/제목 0회?
   - 404가 "삭제됨" 같은 누설 카피 0회?
3. 결과에 따라 `phases/step9-design-overhaul/index.json`의 step 5를 갱신:
   - 성공 → `"status": "completed"`, `"summary": "Backlinks/TagList/TagPage/Graph/NotFound v0.2 시각 정렬; privacy 회귀 0; canary 0/0; audit 0"`.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`.

## 금지사항

- **`packages/core/src/privacy/graph.ts`의 full/filtered 분기를 변경하지 마라.** 이유: privacy 결정 단일 소재지(CLAUDE.md CRITICAL). 시각이 데이터를 다시 거르는 패턴 금지.
- **`apps/blog/src/pages/api/graph.json.ts`에서 출력 데이터를 추가/확장하지 마라.** 이유: 누출 표면 확대. 시각이 필요한 정보는 이미 출력 중.
- **graph SVG에 `<title>` 외 hover tooltip을 위한 추가 데이터(예: 작성일, 본문 미리보기)를 노출하지 마라.** 이유: 누출 표면 확대 가능성. v0.2에서 도입하려면 PRD 변경 후 별도 phase.
- **`<a>` 외부 링크에 referrer를 강제로 노출하지 마라.** 이유: privacy. `rel="noopener noreferrer"` 유지.
- **그래프 노드 색을 16진수 하드코딩하지 마라.** 이유: 다크 모드 전환 시 가독성 깨짐 + UI_GUIDE의 토큰 SSOT 위반. CSS 변수 또는 class로만 표현.
- 기존 테스트를 깨뜨리지 마라.
