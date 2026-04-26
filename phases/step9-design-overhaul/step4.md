# Step 4: note-and-prose

`Note.astro` 본문(prose)과 본문 내 요소들 — 제목/단락/링크/코드/인용/이미지/embed aside — 의 시각을 v0.2 토큰으로 재정비한다. heading anchor(h2~h4 호버 `#`) 도입. privacy 시각 계약(strip-to-text wikilink, private embed AST 제거, allowlist meta)은 변경 없이 유지.

## 읽어야 할 파일

먼저 다음을 읽어 합의/현행을 정확히 파악하라:

- `phases/step9-design-overhaul/design/COMPONENTS.md` — Note 본문/heading anchor/code block/embed aside 시안.
- `phases/step9-design-overhaul/design/TOKENS.md` — 타입 스케일/측정폭/spacing/모션 토큰.
- `docs/UI_GUIDE.md` (step 1 결과) — 본문 톤, 링크 스타일, 모션 정책.
- `packages/theme-default/src/components/Note.astro` — 현행 v0.1 컴포넌트.
- `packages/theme-default/src/components/Note.types.ts` — props 타입.
- `packages/core/src/privacy/linkRewriter.ts` — wikilink remark plugin(이미 private→strip-to-text). **본 step은 이 동작을 그대로 둔다.**
- `packages/core/src/privacy/transclude.ts` — embed 처리(private 제거, public 재귀). **본 step은 이 동작을 그대로 둔다.**
- `packages/astro-integration/src/remarkWikilink.ts` — MDX 파이프라인 브리지.
- `apps/blog/astro.config.mjs` — 현재 활성화된 remark/rehype plugin 목록 확인.
- `packages/core/tests/fixtures/vault-mixed/` — canary(`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`)가 들어 있는 fixture. 빌드 산출물에서 0회 등장해야 함.

## 작업

### 4-1. Note.astro 시각 재정비

`Note.astro`의 마크업/스타일을 v0.2 토큰으로 갱신한다. 핵심 영역:

- **노트 헤더** — h1 제목, 발행일/수정일 메타, 태그 칩 라인. 시안의 위계와 spacing을 따른다.
- **prose 컨테이너** — 측정폭 `var(--measure-prose)`, line-height 토큰화된 값.
- **prose 내부 요소 클래스** — Tailwind v4 + 토큰 기반. v0.1의 `prose` 유틸 사용 시, 토큰을 prose 변수로 매핑(`--tw-prose-body: var(--color-fg-default)` 등). `@tailwindcss/typography` 플러그인 사용 여부는 현행 패키지 `package.json` 확인 후 결정.
- **embed aside (transclusion)** — 임베드 wikilink로 들어온 public 노트 본문 표시 영역. 시안의 좌측 리본(예: `border-left: 2px solid var(--color-border-strong)`) + padding + 미세한 surface 색.
- **링크** — 인라인 본문 링크(`a`)는 step 2 base.css에서 글로벌 색이 잡힘. prose 내부에서 추가로 `text-decoration: underline; text-underline-offset: 2px;` 정도 보강.
- **인용** — `<blockquote>`는 좌측 리본 + 본문 톤보다 약간 muted한 색.
- **인라인 코드** — `<code>`(블록 아닌 인라인). 코드 chip 톤은 다크 모드에서도 가독성 유지(시안 합의값).

### 4-2. 코드 블록 (Shiki dual theme)

Astro 빌트인 Shiki는 `experimentalThemes`(또는 `themes`) 옵션으로 라이트/다크 두 테마를 동시에 출력할 수 있다. `apps/blog/astro.config.mjs`의 markdown 또는 mdx 옵션을 다음 패턴으로 갱신:

```js
markdown: {
  shikiConfig: {
    themes: { light: 'github-light', dark: 'github-dark' },
    // 또는 step 0에서 합의된 다른 테마 페어
  },
}
```

`@astrojs/mdx` 사용 중이라면 같은 옵션을 mdx 통합에도 전달. 결과 HTML에는 두 테마용 inline `style`이 함께 출력되며, `[data-theme="dark"]`에 따라 한쪽이 보이도록 CSS를 추가한다(Shiki dual theme의 표준 패턴). `base.css` 또는 `prose.css`에 다음 룰을 추가:

```css
:root[data-theme="dark"] .shiki,
:root[data-theme="dark"] .shiki span {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
}
```

(Astro Shiki dual theme의 표준 변수명을 따른다 — Astro 현행 버전 문서로 확인 후 적용. 변수명이 다르면 그 버전 표기에 맞춘다.)

### 4-3. heading anchor (rehype-slug + rehype-autolink-headings)

h2~h4에 안정적 ID를 부여하고 호버 시 `#` 앵커가 표시되게 한다. `apps/blog/astro.config.mjs`의 markdown 옵션에 rehype 플러그인 추가:

```js
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

markdown: {
  rehypePlugins: [
    rehypeSlug,
    [rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: { className: ['heading-anchor'], 'aria-label': 'permalink' },
      content: { type: 'text', value: '#' },
    }],
  ],
}
```

devDependencies로 두 패키지 추가(루트 또는 `apps/blog` — 기존 의존성 위치 패턴 따른다). theme-default의 prose CSS에 `.heading-anchor` 스타일 추가:

```css
.heading-anchor {
  margin-left: var(--space-2);
  color: var(--color-fg-faint);
  opacity: 0;
  transition: opacity var(--motion-fast) var(--motion-ease);
}
:where(h2, h3, h4):hover > .heading-anchor,
.heading-anchor:focus-visible {
  opacity: 1;
}
```

`prefers-reduced-motion: reduce` 시 transition은 글로벌 룰이 0ms로 만든다.

`rehype-slug`의 결과 ID 형식(한글/공백 처리)은 `core/src/slug.ts`의 `slugifySegment` 동작과 다를 수 있다. 본 step에서는 두 동작을 통일하지 않는다 — heading anchor는 페이지 내부 fragment용이고, 노트 슬러그는 라우팅용이다(서로 다른 도메인). 이 분리를 코드 주석으로 한 줄 명시.

### 4-4. 이미지

`<img>` 처리:
- `loading="lazy"`, `decoding="async"` 기본.
- 컨테이너 기반 반응형: `max-width: 100%; height: auto;`.
- alt 누락 시 빌드 경고(`@noteforge/core`의 audit 또는 본 step에서 도입한 prose 룰). audit이 이미 검증 중이면 추가하지 않는다.
- privacy: 첨부파일 closure는 이미 `core/src/privacy/attachmentFilter.ts`가 책임. 시각 단계에서 검증/필터 추가 금지.

### 4-5. 테스트

`packages/theme-default/tests/Note.test.ts`(또는 동등) 갱신/추가:

- 기존 prose 렌더 테스트 회귀 0.
- 신규: h2~h4 렌더 결과에 `id` 속성 + `.heading-anchor` 자식 `<a>`가 존재.
- 신규: 다크 모드 토큰(예: `--color-bg-page`의 다크 값)이 코드 블록 배경에 적용되는 CSS 룰이 빌드 산출 CSS에 등장(grep로 충분).

`packages/core/tests/integration/`(canary 검증 기존 테스트):
- canary 0회 — `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`가 빌드된 dist HTML에 등장하지 않음. 이미 통합 테스트가 검증 중이면 그대로.

`apps/blog/tests/` 또는 audit 단계:
- audit 위반 0.

### 4-6. canary 검증 의무

privacy CRITICAL 규칙 — 본 step에서 prose 컴포넌트를 바꿨더라도 canary가 빌드 결과에 0회 등장하는지 직접 grep으로 한 번 더 검증한다:

```bash
pnpm --filter blog build
grep -r "DO_NOT_LEAK_BANANA_6f3c1" apps/blog/dist/ && echo "LEAK!" || echo "OK"
grep -r "CLAUDE_COMMENT_LEAK_77b" apps/blog/dist/ && echo "LEAK!" || echo "OK"
```

이 검증 결과를 step 산출물 summary에 한 줄로 기록한다.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

추가 검증:
- 빌드된 `apps/blog/dist/`에서 임의 노트 페이지를 열었을 때 h2~h4에 `id` + `.heading-anchor` 존재.
- 코드 블록이 라이트/다크 두 테마용 inline style을 가진다(Shiki dual theme).
- canary 2종 0회.
- audit 위반 0.

## 검증 절차

1. 위 AC 커맨드 실행.
2. privacy 회귀 체크리스트:
   - private wikilink가 strip-to-text로 남아 있는가? (`core/src/privacy/linkRewriter.ts` 동작 변경 0)
   - private embed가 AST에서 제거되어 있는가? (자리 표시도 없어야 함)
   - frontmatter allowlist 외 필드가 prose 또는 meta에 노출되지 않는가?
3. heading anchor 정합성:
   - h1에는 anchor 미부여(시각 위계 — h2~h4만).
   - anchor `<a>`가 키보드 focus로 도달 가능 + visible focus 표시.
4. 결과에 따라 `phases/step9-design-overhaul/index.json`의 step 4를 갱신:
   - 성공 → `"status": "completed"`, `"summary": "Note prose v0.2 재정비 + heading anchor + Shiki dual theme; canary 0/0; audit 0 violations"`.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`.

## 금지사항

- **`linkRewriter.ts` / `transclude.ts` / `attachmentFilter.ts` 의 privacy 결정 로직을 시각 단계에서 우회/복제하지 마라.** 이유: privacy 결정은 `packages/core/src/privacy/` 한 곳에 집중(CLAUDE.md CRITICAL).
- **heading anchor를 h1에 부여하지 마라.** 이유: 페이지 자체 URL이 이미 h1을 식별한다. h1에 anchor를 또 두면 자기복제. h2~h4만.
- **Shiki를 외부 CDN에서 fetch 하지 마라.** 이유: privacy + 정적 출력. Astro 빌트인 Shiki만 사용.
- **rehype-autolink-headings의 `behavior: 'wrap'`을 쓰지 마라.** 이유: heading 전체가 링크가 되면 키보드/스크린리더 위계가 깨진다. `'append'`만.
- **prose 안에서 `target="_blank"`를 모든 외부 링크에 자동 부여하지 마라.** 이유: 사용자가 의도하지 않은 새 창은 UX·개인정보(referrer) 모두에 부담. `rel="noopener noreferrer"`만 자동 부여하고 target은 사용자 마크다운에 맡긴다.
- **canary 검증을 생략하지 마라.** 이유: 시각 변경은 가장 누출이 흔한 단계. step 산출물에 0/0 결과를 명시.
- 기존 테스트를 깨뜨리지 마라.
