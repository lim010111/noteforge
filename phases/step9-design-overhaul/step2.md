# Step 2: tokens-and-base

`packages/theme-default/src/styles/tokens.css`와 `base.css`를 v0.2 토큰 체계로 재구성한다. 라이트/다크 동시 지원 + `prefers-color-scheme` 자동 분기 + 수동 토글(`html[data-theme]`)을 도입한다. 컴포넌트(BaseLayout/Note/Backlinks/...) 자체는 이 step에서 손대지 않는다 — 변수만 정렬한다.

## 읽어야 할 파일

먼저 다음을 읽고 합의된 값을 그대로 옮길 준비를 하라:

- `phases/step9-design-overhaul/design/TOKENS.md` — 라이트/다크 토큰 표(SSOT).
- `docs/UI_GUIDE.md` (step 1 결과) — 토큰 카테고리, 모션 정책, 다크 모드 정책.
- `packages/theme-default/src/styles/tokens.css` — 현행 v0.1 토큰. 어떤 변수명이 있는지 확인.
- `packages/theme-default/src/styles/base.css` — 현행 글로벌 베이스(Tailwind v4 import, prose 등).
- `packages/theme-default/package.json` — Tailwind v4 / @tailwindcss/vite 버전 확인.
- `apps/blog/src/styles/global.css` (있다면) — blog 앱이 theme-default를 어떻게 import 하는지 확인. 없다면 BaseLayout이 직접 import.
- `packages/theme-default/src/index.ts` — re-export 표면 확인.

## 작업

### 2-1. tokens.css 재구성

기존 파일을 다음 구조로 갈아엎는다. **변수 이름은 v0.2 컴포넌트 구현(step 3~5)이 그대로 사용할 이름이므로 신중히 결정**한다. step 0 TOKENS.md에 합의된 이름이 있다면 그대로, 없다면 다음 네이밍 규칙으로 명명한다(kebab-case, 카테고리 prefix):

- 색상: `--color-bg-page`, `--color-bg-surface`, `--color-bg-code`, `--color-fg-default`, `--color-fg-heading`, `--color-fg-muted`, `--color-fg-faint`, `--color-fg-link`, `--color-fg-link-hover`, `--color-border-default`, `--color-border-strong`, `--color-accent`, `--color-accent-hover`, `--color-success`, `--color-warn`, `--color-error`, `--color-focus-ring`.
- 타입: `--font-sans`, `--font-mono`, `--font-display` (필요 시).
- 타입 스케일: `--text-h1`, `--text-h2`, `--text-h3`, `--text-h4`, `--text-body`, `--text-small`, `--text-code` (각 변수 값은 `clamp(...)` 또는 fixed rem; line-height와 letter-spacing은 별 변수로 — `--lh-h1` 등).
- spacing: `--space-1` ~ `--space-12` (4px 또는 8px 베이스).
- radius: `--radius-sm`, `--radius-md`, `--radius-lg`.
- elevation: `--shadow-sm`, `--shadow-md` (사용한다면).
- motion: `--motion-fast` (예: 150ms), `--motion-base` (200ms), `--motion-ease` (예: `cubic-bezier(.2,.7,.2,1)`).
- 측정폭: `--measure-prose` (예: `65ch`), `--container-page` (예: `min(72rem, 100% - 2rem)` 같은 식).

#### 라이트/다크 분기 구조

```css
:root,
:root[data-theme="light"] {
  /* 라이트 토큰 정의 */
}

:root[data-theme="dark"] {
  /* 다크 토큰 정의 (라이트와 동일 변수명, 다른 값) */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* 다크 토큰 재정의 — :root[data-theme="dark"]와 동일 값 */
  }
}
```

이 패턴의 의도:
- `data-theme` 미지정(기본): OS 선호도(`prefers-color-scheme`)를 따른다.
- `data-theme="light"` / `"dark"`: 사용자 명시 토글이 OS 선호도를 덮어쓴다.
- `prefers-color-scheme: dark` 미디어 쿼리는 `data-theme="light"` 명시가 있을 때 적용되지 않도록 `:not([data-theme="light"])` 한정.

다크 토큰 값을 두 곳(명시 `[data-theme="dark"]`와 미디어 쿼리 안)에 중복 작성하는 대신, **CSS 커스텀 프로퍼티 자체를 한 곳에서 정의하고 다른 곳에서 inherit**하기 위해 다음 두 안 중 하나를 선택하라:

- 안 A(권장 — 단순): 다크 토큰 값을 두 셀렉터에 동일하게 두 번 적은다. 유지보수는 design tokens 산출물(`TOKENS.md`)이 SSOT이므로 사람의 동기화 비용은 낮다.
- 안 B(고급): `light-dark()` CSS 함수 사용. 단 브라우저 지원 폭이 좁고 Vite/Tailwind v4 환경에서의 빌드 호환성을 사전 확인 필요. 호환성 검증 비용을 감수할 가치가 없다고 판단되면 안 A를 선택하라.

선택 결과는 파일 상단 주석 한 줄로 명시(SSOT는 TOKENS.md임을 환기).

#### Tailwind v4 통합

Tailwind v4(`@tailwindcss/vite`)는 `@theme` 디렉티브로 토큰을 등록한다. 다음 패턴으로 v0.2 토큰을 Tailwind 유틸리티에 노출:

```css
@theme {
  --color-bg-page: ...;
  --color-fg-default: ...;
  /* ... */
}
```

`@theme`는 `:root` 라이트 값만 등록한다. 다크 값은 `:root[data-theme="dark"]` 셀렉터에서 동일 변수명을 재정의해 컴포넌트가 `bg-[var(--color-bg-page)]` 또는 토큰 기반 유틸리티를 호출하면 자연스럽게 다크에서 다른 값으로 해석된다.

기존 `tokens.css`에 등록된 v0.1 변수명은 그대로 유지하지 마라 — v0.1 컴포넌트가 직접 참조하는 식별자는 step 3 이후에 같이 바뀐다. 단 step 2 시점에서 컴포넌트가 깨지지 않도록 다음 중 하나를 선택:

- 옵션 1(권장): step 2에서 v0.1 변수명을 v0.2 변수명으로 alias만 임시 추가(예: `--color-text-default: var(--color-fg-default);`). step 3~5에서 컴포넌트를 옮기면서 alias 제거.
- 옵션 2: step 2에서 변수명 일괄 교체와 컴포넌트 import 갱신을 한 번에 진행. 다만 컴포넌트 시각 변경 없이 변수 rename 커밋만 분리해 step 3 진행 전 commit/test green을 보장.

선택 결과를 step 산출물 summary에 명시(다음 step이 그 가정 위에서 작업한다).

### 2-2. base.css 정비

다음 글로벌 룰을 보장하라(없으면 추가, 있으면 v0.2 토큰으로 갱신):

- `html { color-scheme: light dark; }` — 폼/스크롤바/select 기본 색이 다크모드에 맞게 자동 반전.
- `body { background: var(--color-bg-page); color: var(--color-fg-default); font-family: var(--font-sans); }`
- `a { color: var(--color-fg-link); transition: color var(--motion-fast) var(--motion-ease); }`
- `a:hover { color: var(--color-fg-link-hover); }`
- focus outline: `:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }` — 절대 `outline: none`을 어떤 셀렉터에도 두지 마라.
- `::selection` 색상.
- prose 본문 line-height / 측정폭 기본.
- `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; } }` — 모든 motion을 사실상 즉시 종료.

Tailwind v4의 `@layer base`는 자동 생성된다. v0.1에서 `@layer base { ... }`로 감싼 룰은 그대로 유지하거나, 같은 의미의 직접 셀렉터로 옮긴다.

### 2-3. 다크모드 토글 헬퍼 (스크립트 1개만)

**컴포넌트는 step 3에서 추가**하지만, FOUC 방지를 위해 head에 들어갈 sync script만 본 step에서 정의한다. 파일 위치: `packages/theme-default/src/scripts/theme-init.ts` (신규).

내용:
```ts
// 가능한 한 짧게. localStorage('theme') ∈ {'light','dark'}이면 :root에 data-theme 설정.
// 그 외엔 미지정 — prefers-color-scheme로 자동 분기.
```

이 파일은 ES module 형태로 export 하지 않는다 — Astro가 `<script is:inline>` 안에 인라인 삽입할 수 있도록 raw 텍스트로 export 하거나, BaseLayout에서 `<script is:inline>`로 직접 인라인. step 3에서 BaseLayout이 이를 사용한다. 이 step에서는 파일 존재 + 단위 테스트만.

테스트(`packages/theme-default/tests/theme-init.test.ts` 또는 동등한 위치):
- `localStorage`에 `'dark'` 저장 후 함수 실행 → `document.documentElement.dataset.theme === 'dark'`.
- `localStorage`에 `'light'` 저장 → `dataset.theme === 'light'`.
- `localStorage` 비어 있음 → `dataset.theme`가 정의되지 않음(empty/undefined).

happy-dom 환경 가정. 없으면 jsdom으로 대체. theme-default 패키지의 vitest 환경 설정을 먼저 확인하고, 환경이 node-only라면 happy-dom을 devDependency로 추가하고 테스트만 별도 environment 지시(`// @vitest-environment happy-dom`)를 사용.

### 2-4. 기존 테스트 회귀 0

theme-default의 기존 vitest 스냅샷/유닛 테스트가 있으면 토큰 변수명 rename으로 깨질 수 있다. 두 옵션:

- 옵션 A(alias 유지): v0.1 변수명을 v0.2 변수명에 alias로 두면 기존 테스트 통과 유지.
- 옵션 B(테스트 갱신): 변수명 rename에 맞춰 스냅샷 갱신.

선택은 2-1에서의 결정과 일치시킨다.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

추가 검증:
- `apps/blog/dist/_astro/` 또는 동등한 빌드 산출 CSS에서 `--color-bg-page`(또는 v0.2 합의 변수명)이 라이트 값과 다크 값 두 가지로 정의되어 있는지 grep.
- 빌드 후 `apps/blog/dist/index.html`에 `data-theme` 관련 sync script가 head에 인라인되어 있지 **않은** 상태(step 2까지는 BaseLayout이 미연결)인지 확인. step 3에서 연결.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 토큰 정합성 체크:
   - `tokens.css`의 모든 변수명이 `phases/step9-design-overhaul/design/TOKENS.md`에 등재된 이름과 일치?
   - 라이트/다크 두 모드의 본문 텍스트 대비가 `TOKENS.md`에 기록된 4.5:1 이상 검증과 일치?
3. 결과에 따라 `phases/step9-design-overhaul/index.json`의 step 2를 갱신:
   - 성공 → `"status": "completed"`, `"summary": "tokens.css/base.css v0.2 재구성 + 다크모드 토글 init 스크립트 + alias 정책 X 채택"` (X에 옵션 1/2 명시).
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`.

## 금지사항

- **컴포넌트(`*.astro`)를 시각적으로 바꾸지 마라.** 이유: 시각 변경은 step 3~5의 책임. 여기서 같이 바꾸면 회귀 원인을 격리할 수 없다.
- **`outline: none`을 어떤 셀렉터에도 쓰지 마라.** 이유: 키보드 접근성 위반. 디자인이 outline을 변경하더라도 visible focus는 유지해야 한다(`:focus-visible`로 모양 교체).
- **외부 CDN에서 폰트/CSS를 import 하지 마라.** 이유: privacy-first 제품의 referrer/요청 누출. 웹폰트는 self-host(`apps/blog/public/fonts/`).
- **`@import "tailwindcss"`를 두 번 적지 마라.** 이유: Tailwind v4 빌드 중복 등록 방지.
- **Tailwind v4의 `@theme` 안에 다크 값을 같이 넣지 마라.** 이유: `@theme`는 라이트 기본값 등록용. 다크 분기는 `:root[data-theme="dark"]`/미디어 쿼리에서 변수 재정의로 처리.
- **다크모드 init script를 외부 fetch에 의존시키지 마라.** 이유: head 안 sync script가 외부 요청을 기다리면 FOUC가 발생한다. 인라인 + 동기 실행만.
- 기존 테스트를 깨뜨리지 마라(alias 정책으로 회귀 0 유지).
