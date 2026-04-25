# Step 0: theme-tokens-tailwind

`@obpub/theme-default` 패키지에 Tailwind v4 + 디자인 토큰 부트스트랩을 깐다. 이후 step의 토대.

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — 색상/레이아웃/타이포그래피 토큰의 단일 진실 공급원. **이 step의 모든 토큰 값은 여기서 가져온다.**
- `/docs/ARCHITECTURE.md` — `packages/theme-default/`의 책임 범위 (테마는 core/astro-integration에 의존하지 않는 view layer).
- `/packages/theme-default/package.json` — 현재 스켈레톤 (Astro peer dep, @obpub/core dep).
- `/packages/theme-default/src/index.ts` — 현재 빈 export.
- `/packages/theme-default/tsconfig.json` — strict + jsx preserve.
- `/package.json` — 루트 스크립트 (`typecheck`, `lint`, `test`).

## 작업

### 1. Tailwind v4 의존성 추가

`packages/theme-default/package.json`의 `devDependencies`에 다음을 추가하고 `pnpm install` 실행:

- `tailwindcss@^4.0.0`
- `@tailwindcss/vite@^4.0.0`
- `astro@^5.0.0` (devDependency로도 추가 — type 사용 위해)

`peerDependencies`에 `tailwindcss: ^4.0.0`도 추가. (테마를 사용하는 앱이 같은 Tailwind 메이저를 보장하도록.)

### 2. 토큰 CSS — `packages/theme-default/src/styles/tokens.css`

Tailwind v4의 **CSS-first 설정** 사용 (`tailwind.config.js` 만들지 마라 — v4는 `@theme` 디렉티브로 충분).

UI_GUIDE.md의 색상 표를 그대로 토큰화:

```css
@theme {
  /* Background */
  --color-bg-page: #fafafa;
  --color-bg-card: #ffffff;
  --color-bg-code: #f4f4f5;

  /* Text */
  --color-text-body: #18181b;
  --color-text-heading: #09090b;
  --color-text-muted: #52525b;
  --color-text-faded: #a1a1aa;
  --color-text-link: #2563eb;
  --color-text-link-hover: #1d4ed8;

  /* Semantic */
  --color-success: #16a34a;
  --color-warn: #d97706;
  --color-error: #dc2626;
  --color-border: #e4e4e7;

  /* Layout */
  --container-prose: 48rem;   /* max-w-3xl */
  --container-index: 56rem;   /* max-w-4xl */
}
```

타이포그래피/spacing 토큰도 UI_GUIDE에 명시된 부분(line-height 1.7, ~65ch 측정 폭, system font stack + Korean fallback 등)을 동일 파일에 추가. **UI_GUIDE에 없는 값은 만들어내지 마라**.

### 3. 베이스 스타일 — `packages/theme-default/src/styles/base.css`

```css
@import "tailwindcss";
@import "./tokens.css";

/* 본문 prose 전역 기본값 (UI_GUIDE: line-height 1.7, max-w-3xl, ~65ch) */
/* 키보드 포커스 outline 유지 */
/* 링크 underline decoration-1 underline-offset-2 */
```

UI_GUIDE에 명시된 항목만. AI slop 안티패턴(blur, gradient, neon glow, 보라색 등)은 **절대** 도입하지 마라.

### 4. Export surface — `packages/theme-default/src/index.ts`

스타일 진입 경로를 명시적으로 export. 테마 사용자(apps/blog)가 다음처럼 임포트할 수 있어야 함:

```ts
import "@obpub/theme-default/styles/base.css";
```

이는 `package.json#exports`의 `"./styles/*"` 매핑으로 이미 가능. `index.ts`는 향후 layout/component 재export 자리를 비워둔다 (현 step에서는 빈 placeholder OK):

```ts
export {};
```

### 5. tsconfig 확인

`packages/theme-default/tsconfig.json`이 `.astro` 포함하므로 그대로 둔다. CSS 파일 import에 대한 모듈 선언이 필요하면 `src/styles.d.ts`에 `declare module "*.css";`를 추가.

## 이 step에서는 테스트를 작성하지 않는다

이유: `.astro` 컴포넌트도 layout도 아직 없어서 의미 있는 단위 테스트가 불가. step 1부터 Astro container API로 테스트를 작성한다. 부트스트랩 step의 AC는 빌드/타입체크/린트로 한정.

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
```

- `pnpm install`이 새 의존성을 깔끔히 받아옴.
- `pnpm -r typecheck`가 모든 패키지에서 통과 (theme-default 포함).
- `pnpm lint` 통과.
- `pnpm test` 통과 (기존 core 테스트들이 깨지지 않아야 함 — 현재 step은 core를 건드리지 않음).

## 검증 절차

1. 위 AC 커맨드 전부 실행.
2. 아키텍처 체크리스트:
   - `tokens.css`의 색상 값이 UI_GUIDE.md 표와 1:1 일치하는가?
   - AI slop 안티패턴(blur/gradient/neon/보라색)이 도입되지 않았는가?
   - `tailwind.config.js`/`postcss.config.js` 파일이 만들어지지 않았는가? (v4는 CSS-first)
   - `packages/theme-default/`만 수정했는가? (core/astro-integration/cli 미변경)
3. 결과에 따라 `phases/step4a-theme-foundation/index.json`의 step 0을 업데이트.
   - 성공 → `"status": "completed"`, `"summary": "tokens.css + base.css + tailwindcss v4 deps OK; UI_GUIDE 토큰 1:1"`.
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요 (예: 의존성 충돌) → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단.

## 금지사항

- `tailwind.config.js`/`postcss.config.js`/`postcss.config.mjs`를 만들지 마라. 이유: Tailwind v4는 CSS-first 설계이며 ADR.md 결정사항.
- UI_GUIDE.md에 없는 색상/spacing/font 값을 추가하지 마라. 이유: 디자인 일관성과 단일 진실 공급원 원칙.
- AI slop 안티패턴 (backdrop-filter blur, gradient text, 보라색 브랜드, neon glow, 모든 카드 동일한 rounded-2xl 등)을 도입하지 마라. 이유: UI_GUIDE 명시적 금지 + 제품 디자인 정체성.
- `packages/core/`나 `packages/astro-integration/`을 수정하지 마라. 이 step은 theme 패키지 한정.
- 기존 테스트를 깨뜨리지 마라.
- 다크모드 토큰을 만들지 마라. 이유: v0.2 일정 (PRD 명시).
