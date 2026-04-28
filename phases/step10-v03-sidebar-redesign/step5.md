# Step 5: base-layout-grid-integration

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `packages/theme-default/src/layouts/BaseLayout.astro` (현재 v0.2 — 헤더/네비/모바일 메뉴 `<details>` 패턴, theme-init 인라인 스크립트, canonical/og meta)
- `packages/theme-default/src/layouts/BaseLayout.types.ts` (현재 props 시그니처)
- `packages/theme-default/src/styles/layout.css` (그리드/사이드 마진 표기/컨테이너 폭)
- `packages/theme-default/src/components/Sidebar.astro` (step 4 산출)
- `phases/step10-v03-sidebar-redesign/design/COMPONENTS.md` (Sidebar 컴포지션 시안 + 데스크톱/모바일 변형)

## 작업

BaseLayout만 수정한다. 페이지 라우트 wiring은 step 8 책임.

### 1. `BaseLayoutProps` 확장

```ts
import type { FolderNode } from '@noteforge/theme-default/lib/folderAggregation'; // 또는 적절한 경로
export interface BaseLayoutProps {
  // 기존 필드 (canonicalUrl, ogType, title, description, siteName 등) 그대로 유지
  sidebar?: {
    folderTree: FolderNode;
    activeSlug?: string;
    activeFolderPath?: string;
    avatarSrc?: string;
    nickname?: string;
    slotCount: number;
  };
}
```

`sidebar` prop은 **옵셔널**이며, 미지정 시 v0.2 단일 컬럼 레이아웃을 그대로 렌더(레이아웃 회귀 0).

### 2. 그리드 변경

`layout.css`에 추가:

- `lg+` (`@media (min-width: 64rem)` 또는 기존 lg breakpoint 토큰): main wrapper를 grid `[16rem | 1fr]` (사이드바 고정 16rem, 본문 1fr).
- `< lg`: 단일 컬럼. 사이드바는 *기존 `<details class="mobile-menu">` 드로어 패턴*에 들어감(JS 신규 0).

`sidebar` prop이 있을 때만 grid가 활성. 없으면 v0.2처럼 본문 1컬럼.

### 3. BaseLayout.astro 변경

- 모바일 드로어 안에 `<Sidebar />`를 *동일 데이터*로 한 번 더 렌더(서버에서 두 번 렌더 — JS-less 동기화 비용 0). lg+ 미디어 쿼리로 한쪽씩만 visible.
- 헤더/푸터/스킵링크는 v0.2 그대로.
- canonical/og meta는 step 6에서 trailingSlash 갱신을 받아도 BaseLayout 자체 로직은 변경 *없음*(viewmodel 단계에서 URL이 trailing slash로 들어옴).

### 4. 회귀 보호

- 기존 모바일 햄버거 `<details>` 패턴을 그대로 두고, 그 안의 *내용*만 사이드바 슬롯으로 교체(또는 사이드바 + 기존 nav 둘 다 포함).
- `prefers-reduced-motion`: 새 grid에 transition 추가 금지(v0.2 정책 그대로).
- 다크모드 토글/theme-init 인라인 스크립트 14줄을 한 글자도 건드리지 않는다.

### 5. 테스트

`packages/theme-default/tests/BaseLayout.test.ts` (있으면 추가, 없으면 신규):

1. **`sidebar` prop 미지정** → 출력 HTML에 `<aside class="sidebar">` *없음*. v0.2 회귀 비교 스냅샷(데스크톱 grid가 단일 컬럼).
2. **`sidebar` prop 지정** → lg+ grid 내 `<aside>` 1개 + 모바일 드로어 안 `<aside>` 1개(총 2회 렌더 — 의도된 동작).
3. **active state 통과** → `sidebar.activeSlug`가 Sidebar에 그대로 전달되어 트리 안 `aria-current="page"`가 정확히 한 곳.
4. **canonical/og 회귀** → 기존 `canonicalUrl` prop 통과 동작 보존(step 6 회귀 시 알람).
5. **theme-init 보존** → 인라인 스크립트가 `<head>`에 *정확히 한 번* 존재.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test

# 기존 47 file / 442 test 회귀 0 확인 (수치는 step 추가 테스트로 늘어날 수 있음 — 줄어들면 안 됨)
# theme-init script 보존
grep -c 'data-theme' packages/theme-default/src/layouts/BaseLayout.astro   # ≥ 1 (변동 없어야 함)

# 새 grid 클래스가 sidebar 미지정 시에도 본문 미회귀
pnpm --filter blog build
pnpm obpub audit
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 단계 통과.
2. 레이아웃 체크리스트:
   - `sidebar` prop 옵셔널? 미지정 시 v0.2 단일 컬럼 그대로?
   - 모바일 드로어 패턴(`<details class="mobile-menu">`) 재사용 — 신규 client JS 0?
   - 사이드바 두 곳(데스크톱 + 모바일 드로어) 동시 렌더이지만 미디어 쿼리로 한쪽만 visible?
   - theme-init 인라인 스크립트 한 글자도 안 바뀜?
   - prefers-reduced-motion 위반 transition 추가 0?
3. canary 회귀: `pnpm --filter blog build` 후 canary 2종 dist 0회.
4. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 5를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "BaseLayoutProps에 sidebar? 추가 + lg+ [16rem|1fr] grid + < lg 기존 드로어 재사용, sidebar 미지정 시 v0.2 회귀 0, 5 layout 테스트(sidebar absent/present/active/canonical/theme-init)"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- 사이드바 펼침 상태를 `localStorage`/`sessionStorage`/`Cookie`로 영속화하지 마라. 이유: 정적 출력 계약 + 직관 충돌 없음(`<details open>` + `activeSlug` 자동 펼침으로 충분, TODO.md 결정 사항 표 참조).
- 모바일 드로어용으로 새 client JS 번들을 도입하지 마라. 이유: 기존 `<details class="mobile-menu">` 패턴이 동일한 일을 한다 — 새 JS 0.
- theme-init 인라인 스크립트(14줄)를 수정하거나 추가 인라인 스크립트를 넣지 마라. 이유: 이게 v0.2의 *유일한* 인라인 JS이고, 이미 FOUC 방지로 검증됨 — 추가는 정적 계약 위반.
- canonical/og meta 빌드 로직을 BaseLayout 안에서 변경하지 마라. 이유: trailing slash 변경은 *데이터 소스*(viewmodel)에서 일어남(step 6). BaseLayout은 받은 URL을 그대로 쓴다.
- `sidebar` prop을 *required*로 만들지 마라. 이유: fork 사용자가 사이드바 없이 v0.2 단일 컬럼 레이아웃을 그대로 쓸 수 있어야 한다(BC 보존).
- `packages/core/src/privacy/**`을 수정하지 마라.
