# Step 2: theme-mobile-responsive-pass

Step 4 잔여 항목 "모바일 반응형 점검"을 마무리한다. 기존 테마 컴포넌트를 UI_GUIDE의 모바일 규칙에 맞춰 점검·보강하고, viewport 의존 클래스의 존재를 Container API로 검증한다. 시각 회귀(Playwright)는 Step 7 CI로 위임.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `docs/UI_GUIDE.md` — "레이아웃" 섹션의 모바일 규칙: **모바일 `max-w-full px-4`, 데스크톱 `max-w-3xl mx-auto px-6`** (홈/태그 인덱스는 `max-w-4xl`). "타이포그래피"의 측정폭 ~65ch. "애니메이션" 200ms 모바일 슬라이드 한도.
- `docs/PRD.md` — Reader UX의 "모바일 반응형 필수 (MVP)" 명시
- 기존 컴포넌트 파일 전부:
  - `packages/theme-default/src/layouts/BaseLayout.astro`
  - `packages/theme-default/src/components/Note.astro`
  - `packages/theme-default/src/components/NotFound.astro`
  - `packages/theme-default/src/components/Backlinks.astro`
  - `packages/theme-default/src/components/TagList.astro`
  - `packages/theme-default/src/components/TagPage.astro`
  - `packages/theme-default/src/components/Graph.astro` (Step 1 산출물)
- 기존 테스트 파일 전부 (`packages/theme-default/tests/*.test.ts`) — 추가 단언을 같은 파일 안에 더한다.

## 작업

### 1. 점검 매트릭스 (먼저 결정)

각 컴포넌트별 root wrapper가 어떤 너비/패딩 클래스를 갖춰야 하는지를 다음 매트릭스로 확정하라. 위반 시 `class` 문자열만 수정(시맨틱/구조 변경 금지). UI_GUIDE에 명시된 토큰만 사용하고 새 색/그림자/장식을 도입하지 마라.

| 컴포넌트 | root 요소 | 모바일 | 데스크톱 (md:) | 비고 |
|---|---|---|---|---|
| `BaseLayout` `<main id="main">` | `<main>` | `w-full px-4` | `md:max-w-3xl md:mx-auto md:px-6` | 본문 기본. 페이지가 더 넓은 컨테이너를 원하면 children 쪽에서 wrapper로 override |
| `Note` root | 최상단 `<article>` | `w-full` | `md:max-w-3xl` | BaseLayout이 이미 mx-auto를 주므로 컴포넌트 자체는 폭만 |
| `NotFound` root | 최상단 컨테이너 | `w-full px-4` | `md:max-w-3xl md:mx-auto md:px-6` | 단독 페이지에서도 동작해야 함 |
| `Backlinks` root | `<section>`/`<aside>` | `w-full` | `md:max-w-3xl` | 부모가 mx-auto |
| `TagList` root | `<section>`/`<nav>` | `w-full` | `md:max-w-4xl` | 인덱스 너비 (UI_GUIDE: 홈/태그 인덱스 `max-w-4xl`) |
| `TagPage` root | `<section>` | `w-full` | `md:max-w-3xl` | 단일 태그 = 노트 본문과 같은 측정폭 |
| `Graph` root `<figure>`/wrapper | 컨테이너 | `w-full` | `md:max-w-3xl md:mx-auto` | SVG는 `width="100%" height="auto"`로 이미 반응형 |

**중요**: 위 매트릭스에 적힌 클래스가 이미 동등한 형태로 존재하면 수정하지 마라(예: 동일 의미의 다른 토큰 조합). 변경은 "부족한 경우"에만, 그리고 **클래스 문자열에만** 적용한다.

### 2. 점검 + 보강

매트릭스대로 각 컴포넌트를 한 번씩 열어 점검하라. 부족분을 클래스에만 추가한다. 시맨틱 태그(`<header>`/`<main>`/`<article>`/`<section>`/`<nav>`/`<aside>`/`<footer>`)와 id, prop 시그니처는 변경 금지.

### 3. 테스트 보강 — 각 `tests/*.test.ts`

해당 컴포넌트의 기존 Container 테스트 파일에 다음 한 단언을 추가하라(파일별 1개씩, 총 7개):

> 렌더된 HTML에서 root 요소(매트릭스 행의 root)의 `class` 속성이 매트릭스의 모바일/데스크톱 클래스를 **모두** 포함한다.

검증 방법은 단순 substring (`expect(html).toContain('w-full')` + `expect(html).toContain('md:max-w-3xl')` 등) 또는 정규식. 기존 테스트 톤/스타일과 일관되게.

### 4. UI 토큰 정합성 추가 점검 (정적)

각 컴포넌트에 다음이 **존재하지 않는지** grep 식으로 한 번 검증하라(테스트 추가 또는 lint 한 번 결과를 summary에 기록):
- `backdrop-filter`, `backdrop-blur`, `blur-3xl` — UI_GUIDE 안티패턴
- `from-` + `to-` 그라데이션 클래스 (텍스트/배경)
- `shadow-2xl`/`shadow-glow`/임의 box-shadow 글로우
- `rounded-2xl` 여러 컴포넌트 균일 적용 — 한 컴포넌트라도 사용 발견 시 step 본문에서 정당화하거나 제거
- `purple-`/`indigo-`/`violet-` 색

발견 시 즉시 제거. 발견 0건이면 summary에 `AI-slop scan 0 hits` 기록.

### 5. 검증 (mutation check)

UI_GUIDE 규칙 준수를 보장하기 위해 mutation 4개를 적용·확인·원복:
- **A**: BaseLayout의 `md:max-w-3xl`을 `md:max-w-7xl`로 바꾸기 → BaseLayout 테스트 실패.
- **B**: Note root의 `w-full`을 제거 → Note 테스트 실패.
- **C**: TagList의 `md:max-w-4xl`을 `md:max-w-3xl`로 바꾸기 → TagList 테스트 실패.
- **D**: 임의 컴포넌트에 `bg-purple-500` 추가 → AI-slop scan에 잡힘 (수동 확인 가능; 자동화하려면 grep 결과 단언 추가).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

전부 통과. 기존 테스트 244개 + 본 step의 신규 단언(파일당 1개 × 7) = 최소 251개 또는 그 이상.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md 디렉토리 구조 준수 (새 파일 추가 없음 — 기존 파일 클래스만 수정 + 테스트 보강).
   - ADR 기술 스택 준수 — Tailwind v4 토큰 외 새 의존성 추가 금지.
   - CLAUDE.md CRITICAL: 컴포넌트 파일에 privacy 판정 추가 금지(이번 step은 시각 토큰만).
   - UI_GUIDE 디자인 원칙 3가지 위반 없음.
3. `phases/step4c-theme-graph-and-polish/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "7 component root classes 점검·보강 + 7 viewport-class 단언 추가 + AI-slop scan 0 hits; mutation A/B/C/D 재현 OK"`
   - 실패 3회 → `"status": "error"` + `error_message`
   - 사용자 개입 필요 → `"status": "blocked"` + `blocked_reason` 후 중단

## 금지사항

- 새 컴포넌트 파일을 추가하지 마라. 이유: 본 step은 기존 컴포넌트의 viewport 정합성만 다룬다.
- 시맨틱 태그(`<header>`/`<main>`/`<article>` 등)나 id, prop 시그니처를 변경하지 마라. 이유: 이전 step들이 이를 계약으로 박아 놓았고 회귀가 발생한다.
- 새 색/그림자/그라데이션/애니메이션을 도입하지 마라. 이유: UI_GUIDE 디자인 원칙 1·2 + AI 슬롭 안티패턴.
- Tailwind 외부 CSS 파일을 새로 만들지 마라. 이유: 토큰은 `theme-default/src/styles/tokens.css` 한 곳.
- Playwright/E2E 테스트를 이 step에서 도입하지 마라. 이유: Step 7 CI 범위. 본 step은 Container API 단언만.
- 기존 테스트를 깨뜨리지 마라.
