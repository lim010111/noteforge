# Step 1: base-layout-component (TDD)

`@obpub/theme-default`에 `BaseLayout.astro`를 추가한다. 모든 페이지의 공통 외피(<html>/<head>/<body>/<header>/<main>/<footer>). UI_GUIDE의 시맨틱 HTML 원칙과 접근성 요구를 만족.

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — 레이아웃 (`max-w-3xl`/`max-w-4xl`), 키보드 포커스 outline 유지, 시맨틱 HTML 사용 (`<nav>`, `<main>`, `<article>`, `<aside>`).
- `/docs/PRD.md` — 디자인 방향 (독서 우선, 미니멀, ~65ch 측정 폭).
- `/docs/ARCHITECTURE.md` — 테마는 view-only. `BaseLayout`은 frontmatter에서 직접 값을 읽지 않고, **타입화된 props**만 받는다.
- `/packages/theme-default/src/styles/tokens.css` — step 0에서 만든 토큰.
- `/packages/theme-default/src/styles/base.css` — step 0에서 만든 베이스 스타일.
- `/packages/theme-default/src/index.ts` — re-export 자리.
- `/packages/core/src/types.ts` — `ParsedNote` 등 타입 정의.

## 작업

### 1. Props 타입 — `packages/theme-default/src/layouts/BaseLayout.types.ts`

```ts
export interface BaseLayoutProps {
  title: string;
  description?: string;
  lang?: string;        // default 'ko'
  canonicalUrl?: string;
}
```

**중요**: 이 props는 모두 **명시적**으로 정의. frontmatter 객체를 통째로 받지 마라. 이유: frontmatter allowlist가 무력화됨 (CLAUDE.md CRITICAL 규칙).

### 2. 컴포넌트 — `packages/theme-default/src/layouts/BaseLayout.astro`

다음 구조를 갖춘 시맨틱 HTML:

```astro
---
import type { BaseLayoutProps } from "./BaseLayout.types";
import "../styles/base.css";

const { title, description, lang = "ko", canonicalUrl } = Astro.props as BaseLayoutProps;
---
<!doctype html>
<html lang={lang}>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
    <slot name="head" />
  </head>
  <body>
    <a href="#main" class="...">본문으로 건너뛰기</a>
    <header>
      <nav aria-label="주 메뉴">
        <slot name="nav" />
      </nav>
    </header>
    <main id="main">
      <slot />
    </main>
    <footer>
      <slot name="footer" />
    </footer>
  </body>
</html>
```

요구사항:
- `<a href="#main">` skip link는 키보드 포커스 시 보이고, 그 외엔 시각적으로 숨김 (`sr-only` 패턴 + `focus:not-sr-only`). UI_GUIDE의 "키보드 포커스 outline 유지" 준수.
- `<main>` 요소는 정확히 **1개**, `id="main"`.
- `<nav aria-label="...">` 라벨링 필수.
- 모바일 `px-4`, 데스크톱 `max-w-3xl mx-auto px-6` (UI_GUIDE).
- 어떤 분석/추적 스크립트도 삽입하지 마라. (PRD: "이 tool은 콘텐츠 저장/전송/분석하지 않음".)

### 3. Re-export — `packages/theme-default/src/index.ts`

```ts
export { default as BaseLayout } from "./layouts/BaseLayout.astro";
export type { BaseLayoutProps } from "./layouts/BaseLayout.types";
```

### 4. 실패 테스트 먼저 — `packages/theme-default/tests/BaseLayout.test.ts`

Astro container API (`experimental_AstroContainer`)로 BaseLayout을 렌더하고 단언. 다음 5개 assert (최소):

1. `<html lang="ko">` 기본값 적용. `lang="en"` 명시 시 반영.
2. `<title>` 태그가 props.title과 일치.
3. `description` props 제공 시 `<meta name="description" content="...">`이 정확히 1개 존재. 미제공 시 0개.
4. `<main id="main">`이 정확히 1개 존재.
5. Skip link `<a href="#main">`이 `<body>`의 첫 번째 자식으로 존재.

각 assert를 작성한 직후 `pnpm test`를 돌려 **실패**(컴포넌트가 없거나 미완)를 먼저 확인하라. 그 후 컴포넌트를 만들어 통과시킨다. 5개 모두 통과해야 step 종료.

vitest config가 Astro 컴포넌트 import를 처리하지 못하면, 루트 `vitest.config.ts`에 `getViteConfig` from `astro/config` 통합 또는 `@astrojs/test-utils` 적용 필요. 이는 한 번만 설정하면 4b 이후 테마 테스트 전부에서 재사용됨.

### 5. Mutation check (자가 검증)

다음 변형 중 적어도 3개를 임시 적용했을 때 위 assert가 **반드시 실패**해야 한다 (확인 후 원복):
- `<main>`을 2개로 늘림 → assert 4 실패.
- skip link 제거 → assert 5 실패.
- `lang` 기본값을 `"en"`으로 바꿈 → assert 1 실패.
- `<title>` 출력 생략 → assert 2 실패.
- description 빈 props에서도 meta 렌더 → assert 3 실패.

phase 요약에 "mutation check: A/B/C 실패 재현 OK"를 기록.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

- `pnpm test`에서 BaseLayout 테스트 5개 전원 통과.
- 기존 core/astro-integration 테스트 회귀 없음.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - BaseLayout이 frontmatter 객체를 props로 받지 않는가? (필드 단위 props만 사용해야 함 — frontmatter allowlist 우회 방지)
   - 분석/추적/외부 폰트/외부 스크립트가 삽입되지 않았는가?
   - skip link가 sr-only + focus:not-sr-only 패턴인가?
   - `<main>`이 정확히 1개인가?
   - tokens/base.css 토큰 외 임의 색상이 등장하지 않는가?
3. 결과에 따라 `phases/step4a-theme-foundation/index.json`의 step 1을 업데이트.
   - 성공 → `"status": "completed"`, `"summary": "BaseLayout + 5 tests + skip link + semantic html OK; mutation check: ..."`
   - 실패 → `"status": "error"`, `"error_message": "..."`.

## 금지사항

- BaseLayout이 `frontmatter: any` 형태의 props를 받지 마라. 이유: allowlist를 무력화하여 누출 위험 (CLAUDE.md CRITICAL).
- 외부 폰트/외부 CSS/분석 스크립트를 head에 삽입하지 마라. 이유: PRD의 "콘텐츠 저장/전송/분석 안 함" 약속.
- skip link를 영구적으로 시각 표시하지 마라. 이유: UI_GUIDE의 미니멀 원칙 (포커스 시에만 노출).
- `<main>`을 여러 개 두지 마라. 이유: 시맨틱 HTML/접근성 (스크린리더 혼란).
- `packages/core/`/`packages/astro-integration/`을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
