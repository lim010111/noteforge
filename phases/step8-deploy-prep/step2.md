# Step 2: alias-fixture-routes-audit

vault-mixed fixture에 alias 케이스를 심고, `apps/blog`의 catch-all 라우트가 alias entry에 대해 redirect HTML을 렌더하며, audit가 redirect 무결성과 누출을 검증하도록 만든다.

## 읽어야 할 파일

- `phases/step8-deploy-prep/step0.md`, `step1.md` — 직전 step 산출물 정의.
- `packages/core/tests/fixtures/vault-mixed/` 디렉토리 전체 — 기존 fixture 작성 패턴(frontmatter, canary 사용).
- `packages/core/tests/integration/` — vault-mixed 기반 통합 테스트 패턴(특히 canary 0회 검증).
- `apps/blog/src/pages/[...slug].astro` — 현재 catch-all 라우트.
- `packages/cli/src/commands/audit.ts` — 기존 누출 스캔 로직.

## 작업

### A. fixture 추가 (`packages/core/tests/fixtures/vault-mixed/`)

신규 파일 1: `note-with-alias.md`

```markdown
---
public: true
title: Note With Alias
aliases:
  - old-name
  - previous-title
---

This note has aliases.
```

신규 파일 2: `private-with-alias.md`

```markdown
---
public: false
title: Should Not Leak
aliases:
  - secret-old
---

DO_NOT_LEAK_BANANA_6f3c1
```

(canary는 기존 fixture 다른 파일에서 쓰던 것과 동일 문자열. 만약 다른 canary 토큰이 사용 중이면 통일.)

### B. core/integration 테스트 확장

`packages/core/tests/integration/`의 기존 vault-mixed 테스트에 다음 단언 추가(또는 새 파일 `aliasFixture.test.ts`):

- pipeline 결과 `aliasRedirects`에 `{ from: 'old-name', to: '<note-with-alias의 slug>' }` 포함.
- pipeline 결과 `aliasRedirects`에 `from: 'secret-old'` 0회.
- pipeline 산출물의 모든 직렬화된 형태(렌더 HTML, JSON view model 직렬화)에서 `'DO_NOT_LEAK_BANANA_6f3c1'` 0회.

### C. apps/blog 라우트: `apps/blog/src/pages/[...slug].astro`

`getStaticPaths`:

1. 기존 `publishable` 노트 entry 처리 유지 (props에 `kind: 'note'` 명시).
2. alias entry 순회 추가: 각 alias entry에 대해 `params: { slug: '<alias.from>' }`, `props: { kind: 'alias-redirect', to: '/<alias.to>', titleBySlug }` 반환.
3. 동일 slug 충돌이 발생하면 빌드가 실패한다(Astro 기본 동작) — step 0/1의 충돌 검증으로 이미 걸러져 있어야 한다. 발생 시 명확한 에러 메시지가 빌드 로그에 남도록 try/catch 또는 조기 검증 추가.

컴포넌트 본문 분기:

```astro
---
const { kind } = Astro.props as Props;
if (kind === 'alias-redirect') {
  // redirect 분기
}
---
{kind === 'alias-redirect' ? (
  <BaseLayout title="이 페이지는 이동되었습니다" canonicalUrl={absoluteTo}>
    <Fragment slot="head">
      <meta http-equiv="refresh" content={`0; url=${to}`} />
    </Fragment>
    <p>이 페이지는 <a href={to}>여기</a>로 이동되었습니다.</p>
  </BaseLayout>
) : (
  <BaseLayout title={note.title} description={note.description} canonicalUrl={absoluteSelf}>
    {/* 기존 nav/Note/Backlinks */}
  </BaseLayout>
)}
```

규칙:
- alias redirect 페이지는 `<title>`, redirect target 링크, 짧은 안내 외 어떤 텍스트도 출력하지 마라.
- `<link rel="canonical">`은 BaseLayout이 `canonicalUrl` prop으로 처리(이미 라인 14에 존재). alias 분기에서 canonicalUrl은 **redirect target의 절대 URL**(`new URL(to, Astro.site).toString()`).
- `Note`, `Backlinks` import 자체는 유지하되 alias 분기에서 호출하지 않는다(트리쉐이킹은 Astro 빌드가 처리).

### D. listing 페이지 보호

`apps/blog/src/pages/index.astro`, `graph.astro`, `tags/index.astro`, `tags/[tag].astro`가 alias entry를 listing에 포함하지 않도록 step 1의 `filterPublishable`(`kind: 'note'`만 통과)이 적용되어 있는지 확인. 누락된 페이지가 있으면 동일 필터 적용.

### E. audit 확장 (`packages/cli/src/commands/audit.ts`)

기존 dist HTML 스캔에 두 가지 alias 검증 추가:

1. **redirect 무결성**: dist 내 모든 HTML 파일을 순회하며 `<meta http-equiv="refresh" content="0; url=...">`가 있으면 그 URL이 dist 안에 실제로 존재하는 페이지인지 확인(`<url>/index.html` 또는 `<url>.html` 둘 다 시도). 없으면 audit fail (exit code 1).
2. **alias 페이지 본문 누출 방지**: redirect 페이지의 `<title>` 외 텍스트에 다른 노트의 title이 포함되지 않았는지 검사. 단순 구현: redirect 페이지 본문(`<main>` 내 텍스트)에 `titleBySlug.values()`의 다른 title이 substring으로 등장 0회.

audit 단위 테스트 (`packages/cli/tests/`):
- 의도적으로 깨진 redirect HTML(존재 안 하는 target)을 가진 mock dist → audit 함수가 fail 반환.
- 정상 redirect HTML → audit pass.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

(이 step에서는 `pnpm --filter blog build`을 AC에 넣지 않는다 — 이유: apps/blog config가 사용자 vault를 가리키므로 빌드에 그 vault가 필요. fixture 기반 검증은 vitest 통합 테스트로 대체. 실제 빌드 검증은 step 4에서 사용자 vault로 1회.)

## 검증 절차

1. AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - fixture canary가 alias redirect HTML에 0회 등장(통합 테스트로 검증).
   - listing 페이지(index/graph/tags)가 alias entry를 출력하지 않음.
   - audit가 깨진 redirect를 감지.
   - alias redirect 분기가 `Note`/`Backlinks` 컴포넌트를 호출하지 않음.
3. `phases/step8-deploy-prep/index.json`의 step 2 갱신.

## 금지사항

- **alias redirect 페이지에서 원본 노트의 본문/제목/태그를 출력하지 마라.** 이유: alias의 의미는 URL 보존뿐이며, 페이지 자체는 검색 인덱싱 대상이 아니라 즉시 리다이렉트 대상이다.
- **별도 `[...alias].astro` 파일을 만들지 마라.** 이유: catch-all 라우트 두 개가 동시에 존재하면 Astro 빌드가 모호해지고 디버깅이 어렵다.
- **canary 문자열을 fixture 외 코드에 하드코딩하지 마라.** 이유: 테스트 fixture/통합 검증 외 사용은 의미 없는 leak 위험.
- **audit fail 시 exit code 0을 반환하지 마라.** 이유: CI에서 통과해버리면 검증이 무의미해진다. 기존 audit의 fail 처리 흐름을 그대로 따른다.
- 기존 테스트를 깨뜨리지 마라.
