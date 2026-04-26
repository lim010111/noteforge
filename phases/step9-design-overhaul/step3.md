# Step 3: layout-and-nav

`BaseLayout.astro`를 v0.2 톤으로 재설계한다. 헤더(브랜드/네비게이션/테마 토글), 메인 컨테이너, 푸터, 모바일 메뉴까지 한 번에 다룬다. canonical/og 메타 동작과 privacy 시각 계약은 그대로 유지한다.

## 읽어야 할 파일

먼저 다음을 읽어 현행 구조와 합의를 정확히 파악하라:

- `phases/step9-design-overhaul/design/COMPONENTS.md` — BaseLayout 시안.
- `phases/step9-design-overhaul/design/TOKENS.md` — 사용할 토큰명/값.
- `docs/UI_GUIDE.md` (step 1 결과) — 레이아웃/모바일/다크모드/모션/접근성 정책.
- `packages/theme-default/src/layouts/BaseLayout.astro` — 현행 v0.1 레이아웃.
- `packages/theme-default/src/layouts/BaseLayout.types.ts` — props 타입(canonical, og 메타 등 — step 8에서 이미 확장됨).
- `packages/theme-default/src/scripts/theme-init.ts` (step 2 산출) — head에 인라인할 sync 스크립트.
- `apps/blog/src/pages/index.astro`, `apps/blog/src/pages/[...slug].astro`, `apps/blog/src/pages/graph.astro`, `apps/blog/src/pages/tags/` — BaseLayout을 어떻게 호출하는지.
- `packages/theme-default/tests/` — BaseLayout 테스트(canonical/og:url 4건 포함, step8d에서 추가).
- `packages/core/src/audit/` 또는 `apps/blog`의 audit 호출부 — audit가 메타 누출을 검사하는 위치(BaseLayout 변경 시 audit 규칙과 어긋나지 않도록 주의).

## 작업

### 3-1. BaseLayout 재구조

새 마크업 골격(주석 없이 핵심만):

```astro
---
import '../styles/tokens.css';
import '../styles/base.css';
import themeInitSrc from '../scripts/theme-init.ts?raw'; // step 2에서 raw export 가능 시
import type { BaseLayoutProps } from './BaseLayout.types';
const { title, description, canonicalUrl, ogType, ogTitle, ogDescription, siteName } =
  Astro.props as BaseLayoutProps;
---
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    {canonicalUrl && (
      <>
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content={ogType ?? 'website'} />
        {ogTitle && <meta property="og:title" content={ogTitle} />}
        {ogDescription && <meta property="og:description" content={ogDescription} />}
        {siteName && <meta property="og:site_name" content={siteName} />}
      </>
    )}
    <script is:inline set:html={themeInitSrc}></script>
  </head>
  <body>
    <a class="skip-link" href="#main">본문으로 건너뛰기</a>
    <header class="site-header">…</header>
    <main id="main" class="site-main">
      <slot />
    </main>
    <footer class="site-footer">…</footer>
  </body>
</html>
```

위 골격에서 다음을 v0.2 시안 대로 채워라:

- **브랜드 마크** — 헤더 좌측. 텍스트(워드마크) 또는 작은 SVG. v0.1 원칙(좌측 정렬·중앙 정렬 금지)을 따른다.
- **네비게이션** — 1차 항목 4개 이내 권장: 홈, 태그, 그래프, (선택) About. 데스크톱은 가로 nav, 모바일은 토글된 메뉴. 모바일 메뉴는 **JS 0줄로 가능**한 `<details><summary>` 또는 `<input type="checkbox" hidden> + label + ::checked`-CSS 토글 중 선택. 결정과 근거를 코드 주석 한 줄로 남긴다.
- **테마 토글** — 헤더 우측. 라이트/다크/system 3-state 또는 라이트↔다크 2-state 중 선택. 토글 클릭 시 `localStorage.setItem('theme', value)` + `document.documentElement.dataset.theme` 갱신. 토글용 inline script는 단 한 곳, 16~30줄 이내로 유지.
- **푸터** — 저작권/저장소 링크/라이선스(MIT) 링크. 외부 링크는 `rel="noopener noreferrer" target="_blank"`.
- **skip link** — `.skip-link`는 기본 `sr-only`, focus 시에만 표시. 키보드 접근성 의무.

### 3-2. CSS 클래스 / 스타일

`packages/theme-default/src/styles/`에 `layout.css` 또는 컴포넌트 스코프 `<style>`를 사용. v0.2 토큰을 직접 참조(`var(--color-bg-page)` 등). Tailwind 유틸은 토큰 등록(`@theme`)이 되어 있다면 사용 가능.

레이아웃 핵심 수치:
- 헤더 높이: `clamp(56px, 8vw, 72px)` 권장.
- 본문 컨테이너 폭: `var(--container-page)` 또는 `min(72rem, 100% - 2rem)`. 본문 prose 폭은 `var(--measure-prose)` (대개 65~72ch).
- 데스크톱/모바일 분기: `min-width: 768px` 또는 `640px` 기준 — `TOKENS.md` 합의를 따른다.
- 푸터 상단 여백: `var(--space-12)` 이상.

### 3-3. 모바일 메뉴 (JS-less)

다음 마크업 패턴(예시 — `<details>` 안 — JS 0줄):

```astro
<details class="mobile-menu">
  <summary aria-label="메뉴 열기" aria-controls="mobile-nav">
    <!-- inline svg menu icon -->
  </summary>
  <nav id="mobile-nav" aria-label="모바일 네비게이션">
    <a href="/">홈</a>
    <a href="/tags/">태그</a>
    <a href="/graph">그래프</a>
  </nav>
</details>
```

- 데스크톱 breakpoint 이상에서는 `display: none`으로 숨기고 데스크톱 nav 표시.
- 모바일에서는 데스크톱 nav를 숨기고 `<details>` 표시.
- `prefers-reduced-motion: reduce`에서는 어떤 transition도 적용 안 됨(step 2의 글로벌 룰이 처리).
- 메뉴 항목 간 분리는 `<nav>` 안에서 처리(리스트 마크업 권장: `<ul role="list">`).

### 3-4. 테마 토글 인라인 스크립트

`<header>`에 토글 버튼 + 핸들러:

```html
<button id="theme-toggle" aria-label="테마 전환" type="button">…</button>
<script is:inline>
  (() => {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const root = document.documentElement;
    btn.addEventListener('click', () => {
      const current = root.dataset.theme === 'dark' ? 'dark' : root.dataset.theme === 'light' ? 'light' : null;
      const next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch {}
    });
  })();
</script>
```

위 코드 그대로 옮기지 말고, step 0/1에서 합의된 토글 동작(2-state vs 3-state)에 맞춰 작성. 30줄 이내 + 외부 의존 0.

### 3-5. 테스트

`packages/theme-default/tests/BaseLayout.test.ts`를 갱신/추가. 다음 케이스 보강:

- 기존 4건(canonical/og:url/og:type/og:title/og:description/og:site_name) 동작 회귀 0.
- 신규: 헤더에 `nav[aria-label]`이 존재.
- 신규: head 첫 단계에 theme-init `<script is:inline>`가 인라인되어 있다(`document.head.querySelector('script')` 또는 정적 SSR 결과 문자열에 합치).
- 신규: `<a class="skip-link">`가 body 첫 자식으로 존재(또는 첫 focus 가능 요소).
- 신규: data-theme 미지정 + theme-init 실행 전 SSR 결과 자체에는 `data-theme` attr가 없다(렌더 깜빡임 방지 책임은 sync script만이 담당).

테스트 실행은 SSR 렌더 결과를 문자열로 받는 방식(예: `experimental_AstroContainer.renderToString`) 또는 컴포넌트를 단위로 import. 기존 BaseLayout 테스트 방식을 그대로 따른다.

### 3-6. blog 페이지의 BaseLayout 호출 갱신

`apps/blog/src/pages/index.astro`, `[...slug].astro`, `graph.astro`, `tags/*.astro` 가 BaseLayout에 새 props(있다면)를 요구하지 않는지 확인. 새 props 도입은 가급적 피하고, 도입했다면 모든 호출처를 갱신한다.

### 3-7. audit 회귀 0

`pnpm --filter blog build` 후 audit 결과:
- 기존 audit 위반 0(특히 alias-redirect 관련 2 규칙 + canary 검사).
- BaseLayout이 출력하는 meta가 frontmatter allowlist를 벗어나는 필드를 노출하지 않는다(도입할 일이 없어야 정상 — 이 step은 메타 동작을 변경하지 않는다).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

추가 검증:
- 빌드된 `apps/blog/dist/index.html` head에 sync theme-init script + canonical(있을 시)이 인라인되어 있다.
- `apps/blog/dist/`의 임의 페이지를 브라우저로 열었을 때(또는 SSR 결과 문자열로 검증) 다음이 보인다:
  - 헤더, 메인, 푸터 semantic HTML
  - 모바일 폭에서 `<details>`(또는 css-toggle) 메뉴
  - 테마 토글 버튼
  - skip link
- audit 결과 위반 0.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 시각 회귀 체크리스트:
   - 기존 BaseLayout 테스트 4건 + 신규 케이스 모두 통과.
   - private 노트에 대한 시각 처리(strip-to-text wikilink, 제거된 embed)가 그대로 유지(이 step은 본문 컴포넌트를 안 바꾸므로 회귀가 없어야 정상).
   - 모바일 메뉴 JS 의존 0 또는 토글 스크립트 30줄 이하.
3. 결과에 따라 `phases/step9-design-overhaul/index.json`의 step 3을 갱신:
   - 성공 → `"status": "completed"`, `"summary": "BaseLayout v0.2 재설계: 헤더/네비/모바일 메뉴(JS-less or N줄)/테마 토글/skip-link, 기존 canonical·og 회귀 0"`.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`.

## 금지사항

- **canonical/og 메타 출력 동작을 바꾸지 마라.** 이유: step8d에서 합의된 SEO/SNS 노출 계약을 step 9에서 흔들면 회귀가 audit 위반으로 직결된다. 가드(`canonicalUrl`이 있을 때만 og:* 출력)는 그대로 유지.
- **frontmatter allowlist 외 필드를 BaseLayout에 props로 받지 마라.** 이유: privacy CRITICAL 규칙. allowlist는 `core/src/privacy/`에 정의되어 있다.
- **테마 토글에 외부 라이브러리(예: theme-change npm 패키지)를 도입하지 마라.** 이유: 정적 출력 + privacy 계약을 위해 외부 코드의 리퍼러/이벤트 누출 가능성을 차단한다. 30줄 이내 인라인.
- **`<script>` 안에서 fetch/외부 CDN 호출을 하지 마라.** 이유: privacy-first + FOUC 방지.
- **`outline: none`을 추가하지 마라.** 이유: step 2의 접근성 글로벌 룰을 어기게 된다.
- **모바일 메뉴 토글에 `aria-hidden`만 두지 마라.** 이유: 키보드/스크린리더 일관성 — `<details>`는 이미 시맨틱하므로 추가 aria 남용 금지.
- 기존 테스트를 깨뜨리지 마라.
