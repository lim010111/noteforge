# Step 3: canonical-url-and-og

`BaseLayout`에 OG meta를 추가하고, `apps/blog`의 모든 페이지에서 canonicalUrl을 prop으로 전달한다. **canonical link 출력은 BaseLayout 라인 14에 이미 있다 — 본 step은 OG meta + apps/blog prop plumbing.**

## 읽어야 할 파일

- `packages/theme-default/src/layouts/BaseLayout.astro` — 라인 5에 `canonicalUrl` prop 수신, 라인 14에 `<link rel="canonical">` 렌더링 (이미 존재). OG meta는 없음.
- `packages/theme-default/src/layouts/BaseLayout.types.ts` (또는 동등 타입 파일).
- `apps/blog/astro.config.mjs:8` — `site: obpubConfig.site.url` (Astro.site의 출처).
- `apps/blog/obsidian-blog.config.ts` — `site.title`, `site.url`.
- `apps/blog/src/pages/index.astro`, `[...slug].astro`, `graph.astro`, `tags/index.astro`, `tags/[tag].astro`, `404.astro` — 현재 BaseLayout 호출부에 canonicalUrl을 전달하지 않음.

## 작업

### A. BaseLayout 확장

`packages/theme-default/src/layouts/BaseLayout.astro`:

props 추가(타입 파일 동시 갱신):
- `ogType?: 'website' | 'article'` (기본 `'website'`).
- `siteName?: string` (선택).

`<head>` 내 추가(canonicalUrl 존재 시 한정 — 가드 패턴은 라인 14의 `{canonicalUrl && ...}` 따라 일관 유지):

```astro
{canonicalUrl && (
  <>
    <meta property="og:url" content={canonicalUrl.toString()} />
    <meta property="og:type" content={ogType ?? 'website'} />
    <meta property="og:title" content={title} />
    {description && <meta property="og:description" content={description} />}
    {siteName && <meta property="og:site_name" content={siteName} />}
  </>
)}
```

기존 `<link rel="canonical">`(라인 14)은 그대로. 중복 출력하지 마라.

### B. apps/blog 페이지에서 prop 전달

각 페이지 frontmatter에서 canonical URL 계산:

```ts
const canonicalUrl = new URL(Astro.url.pathname, Astro.site).toString();
```

`Astro.site`는 `astro.config.mjs:8`의 값. 페이지별 변경:

| 파일 | ogType | 비고 |
|---|---|---|
| `index.astro` | `'website'` | 홈 |
| `[...slug].astro` (kind: 'note') | `'article'` | 노트 |
| `[...slug].astro` (kind: 'alias-redirect') | `'website'` | canonicalUrl=**redirect target의 절대 URL** (`new URL(to, Astro.site).toString()`), 본인 path 아님 |
| `graph.astro` | `'website'` |  |
| `tags/index.astro` | `'website'` |  |
| `tags/[tag].astro` | `'website'` |  |
| `404.astro` | `'website'` | canonicalUrl 생략 가능 (404는 검색 인덱싱 대상 아님) |

`siteName`은 모든 페이지에서 `obpubConfig.site.title` 전달(import는 page 단위로).

### C. 테스트

- `packages/theme-default/tests/`에 BaseLayout 컴포넌트 테스트 추가(또는 기존 파일 확장):
  - `canonicalUrl + ogType="article"` 주입 시 렌더 HTML에 `og:url`, `og:type=article`, `og:title` 모두 등장.
  - `canonicalUrl` 미전달 시 og:* meta 0개(가드 패턴 검증).
  - `<link rel="canonical">`은 기존 케이스와 동일하게 작동(회귀 방지).
- 통합 테스트(있다면): vault-mixed 빌드 결과 dist 모든 HTML에 `og:url` 등장. (이 통합 테스트가 무거우면 step 4 phase 종료 AC로 이전.)

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

## 검증 절차

1. AC 커맨드 실행.
2. 체크리스트:
   - canonical link가 중복 출력되지 않는가? (BaseLayout 라인 14의 기존 출력만 유지.)
   - alias redirect 페이지의 canonicalUrl이 redirect target을 가리키는가?
   - 404 페이지가 canonicalUrl 없이도 빌드 통과?
3. `phases/step8-deploy-prep/index.json`의 step 3 갱신.

## 금지사항

- **OG image(`og:image`) 자동 생성을 추가하지 마라.** 이유: Satori/sharp 의존 도입은 build time/번들 영향이 커서 별도 v0.2 phase로 분리해야 한다. 본 step에서 placeholder URL을 박지도 마라.
- **Twitter Card 메타를 추가하지 마라.** 이유: og:image와 짝이라 같이 v0.2.
- **`<link rel="canonical">`을 다시 출력하지 마라.** 이유: BaseLayout 라인 14에 이미 있다. 중복 출력은 SEO에서 무시되거나 첫 번째만 사용되며, 코드 중복.
- **`Astro.site`가 undefined일 때의 fallback을 추가하지 마라.** 이유: `astro.config.mjs`가 이미 `site`를 강제 설정하며, undefined는 설정 오류이지 런타임 케이스가 아니다. 만약 발생하면 에러로 빌드를 중단시키는 게 맞다.
- 기존 테스트를 깨뜨리지 마라.
