# UI 디자인 가이드 — @noteforge/theme-default (v0.2)

## 1. 설계 배경

v0.1은 "노트북·논문·위키" 톤의 미니멀 라이트 테마였다. 읽기 우선·장식 없음·SaaS 클리셰 금지라는 계약은 충실히 지켜졌지만, 시스템 폰트 단일 스택과 단일 테마(라이트)만으로는 *production-grade*의 결을 내기에 부족했다.

v0.2는 같은 계약을 유지하면서 **editorial-technical** 방향으로 결을 다잡는다. 학술지 같은 사이드 마진 표기와 엔지니어링 로그 같은 모노스페이스 메타가 공존하고, 라이트(`#f9f6f1` warm cream)와 다크(`#0f1115` cool ink) 모드가 모두 *디자인된* 결로 존재한다. 헤딩은 letterpress serif, 본문은 humanist sans, 메타·코드·UI 크롬은 monospace — 이 세 종의 self-host 웹폰트가 v0.2의 결을 이룬다. 단일 액센트는 iron-oxide(`#a83612` / `#f0a373`) 한 가지로 고정되며, 보라/인디고는 여전히 금지된다.

다음 계약은 v0.1과 동일하게 v0.2에서도 절대 변경되지 않는다.

- **Privacy-first 시각 계약** — private wikilink/embed/frontmatter는 시각 레이어에서 *우회 불가*. 시각만 다듬는 변경이 누출 경로를 만들지 않도록 컴포넌트 가이드와 별도로 14절에 명시한다.
- **접근성 계약** — WCAG AA 4.5:1 대비, 키보드 포커스 outline 보존, semantic HTML, alt 의무.
- **정적 출력 계약** — 모든 UI는 빌드 타임에 결정. 다크모드 토글의 FOUC 방지 sync script 1개를 제외하고 `<head>`/페이지 안에 인터랙티브 JS를 새로 들이지 않는다.

이 문서는 fork 사용자를 위한 외부 SSOT다. 내부 디자인 토큰의 출처는 `phases/step9-design-overhaul/design/TOKENS.md`이며, 본 가이드의 모든 수치는 그 파일과 1:1로 일치한다.

## 2. 디자인 원칙 (v0.2)

1. **읽기 우선** — 본문이 주인공. 크롬(헤더, 측면 마진, 푸터)은 본문 흐름을 끊지 않는 두께로만 존재.
2. **Editorial-technical** — 학술지의 사이드 마진 표기 × 엔지니어링 로그의 모노스페이스 메타. 둘이 한 페이지에서 자연스럽게 공존.
3. **Hairline elevation, no glow** — 입체감은 1px 헤어라인 보더와 페이지 색의 미세 단차로만. 글로우/리프트/멀티스텝 그림자는 도구로도 토큰으로도 제공하지 않음.
4. **Single accent, dual atmosphere** — iron-oxide 단일 액센트가 라이트·다크 양쪽에서 동일한 의미(링크·포커스·헤딩 앵커)를 표현. 페이지 색 자체가 분위기이며, 그 위에 또 다른 분위기를 쌓지 않음.
5. **Restraint over decoration** — 모션·아이콘·둥근 모서리 모두 *의도적 변주*가 있는 곳에만. 균일한 둥글기·일괄 fade-in·장식용 SVG는 금지.

## 3. 유지·완화·추가 (안티패턴 표)

### v0.1의 7개 안티패턴 — v0.2 정책

| Anti-pattern | v0.1 정책 | v0.2 정책 | Rationale (왜 유지/완화/금지) |
|---|---|---|---|
| `backdrop-filter: blur()` (glass morphism) | banned | **keep banned** | 가장 알아채기 쉬운 AI 템플릿 신호. 에디토리얼 방향에 기능적 쓰임이 0이고, 유일한 분위기는 페이지 색(`--color-bg-page`)이다. |
| Gradient text (`background-clip: text` on `h1` 등) | banned | **keep banned** | SaaS 랜딩 클리셰. letterpress serif 헤딩과 충돌 — serif `h1`을 그라디언트로 칠하면 즉시 "AI hero" 신호가 된다. |
| "Powered by AI" / 생성 배지 | banned | **keep banned** | 장식이지 기능이 아님. v0.2에서도 배지 없음. 어트리뷰션이 필요하면 푸터 mono 한 줄로 충분. |
| Box-shadow 네온 글로우 / 펄스 애니메이션 | banned | **keep banned** | v0.2의 차별 표면은 헤어라인 보더 + 액센트로 만든다. 토큰 tier가 `--shadow-1`(1px 헤어라인) 1개만 노출 — 글로우 스케일 자체가 존재하지 않으므로 호출부가 합성할 수 없다. |
| 보라/인디고 브랜드 색상 | banned | **keep banned** | iron-oxide(`#a83612` light / `#f0a373` dark)를 단일 액센트로 채택 — 따뜻하고 변별 가능하며 AI 기본값이 아님. 보라/인디고 단색 브랜딩, 그리고 v0.2에선 **다색 브랜드 시스템** 자체가 금지(액센트는 한 종류). |
| 모든 카드에 동일한 `rounded-2xl` | banned | **partial allow** (radius 스케일 = `2 / 4 / 8 px` only) | 핵심은 *의도적 변주*이지 "다 부드러운 알약"이 아니다. inline code는 `--radius-sm`(2px), 칩/버튼은 `--radius-md`(4px), embed aside / 이미지 / 코드 블록은 `--radius-lg`(8px). `rounded-xl` / `rounded-2xl` / `rounded-full` 토큰은 존재하지 않는다(그래프 노드 원은 SVG `<circle>`이라 box-radius와 무관). |
| 배경 gradient orb (`blur-3xl` 블롭) | banned | **keep banned** | 분위기는 warm-cream / cool-ink 페이지 색 *하나만*으로. 메시 그라디언트, 노이즈 오버레이, 텍스처 필터 모두 `--color-bg-page` 위에 금지. |

### v0.2에서 새로 도입되는 모티프와 한계선

| 모티프 | 허용되는 곳 | 한계 / 금지 |
|---|---|---|
| **사이드 마진 표기 그리드** (12rem 컬럼, `lg+`에서 헤딩 앵커·날짜·태그 배치) | `BaseLayout` 메인 그리드, `Note` 헤딩 앵커와 메타 미러 | 텍스트와 숫자만. 장식 도형/일러스트/이미지 금지. `< lg`에서는 인라인으로 collapse. |
| **Monospace accent** (JetBrains Mono / D2Coding — 메타·kbd·언어 라벨·브랜드 마크·내비게이션) | h1 아래 메타 행, 코드 블록, 언어 칩, 브랜드 마크, 푸터, 내비 | 본문은 절대 mono 금지. `h1`–`h4`는 mono 금지(serif/sans만). 본문 안의 링크 자체를 mono로 스타일링하지 않음(링크는 본문 컨텍스트라 `--font-sans` 상속). |
| **Letterpress serif headings** (Source Serif 4 / Noto Serif KR — `h1`–`h3`) | `Note` 안의 `h1`/`h2`/`h3`, 페이지 타이틀 슬롯 | 본문에 serif 금지. `h4+` serif 금지(h4는 sans로 hierarchy 대비 유지). UI 크롬(내비/버튼/칩/푸터)에 serif 금지. |
| **Hairline rules instead of shadows** (1px `--color-border` 어디서나 + 옵션 `--shadow-1` 1개만) | 섹션 디바이더, 카드, embed aside, 테이블 행, 스크롤된 sticky 헤더 | 카드/aside/칩의 elevation 힌트로 그림자 사용 금지 — 보더로 표현. 토큰 tier에 멀티 스텝 그림자 스케일이 존재하지 않음. |
| **Paper-cream / cool-ink 페이지 색이 유일 분위기** (`--color-bg-page`) | 모든 페이지, 라이트/다크 양쪽 | 페이지 배경 위에 그라디언트/메시/orb/노이즈/텍스처 필터 금지. 페이지 색이 곧 분위기이며 그 위에 어떤 레이어도 쌓지 않는다. |

## 4. 색상 토큰

토큰은 `packages/theme-default/src/styles/tokens.css`의 CSS 변수로 정의된다(전사 step 2 책임). 본문 텍스트와 페이지 배경 대비는 라이트·다크 양쪽 WCAG 상대휘도 계산으로 ≥ 4.5:1 검증됨. 본 절의 모든 토큰명·hex 값은 `phases/step9-design-overhaul/design/TOKENS.md`와 1:1.

### 4-1. 배경

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--color-bg-page` | `#f9f6f1` | `#0f1115` | 페이지 표면. warm cream / cool ink. 의도적으로 순백/순흑 아님. |
| `--color-bg-surface` | `#ffffff` | `#161922` | 카드, embed aside, 코드 블록 단차. |
| `--color-bg-surface-strong` | `#f1ede5` | `#1c2030` | 칩/내비 호버, 테이블 헤더 행. |
| `--color-bg-code` | `#f1ede4` | `#1a1d27` | 코드 블록 배경(서피스와 구분되어 코드로 인지). |

### 4-2. 텍스트

| 토큰 | Light | Dark | 페이지 배경 대비 | 용도 |
|---|---|---|---|---|
| `--color-text-body` | `#1b1d22` | `#dcdee2` | Light ≈ **14.8:1** · Dark ≈ **13.4:1** (AAA) | 본문 prose. |
| `--color-text-heading` | `#0a0c10` | `#f1f2f5` | Light ≈ **18.6:1** · Dark ≈ **16.9:1** (AAA) | 헤딩. |
| `--color-text-muted` | `#5a5e68` | `#9aa0ad` | Light ≈ **5.9:1** · Dark ≈ **5.3:1** (AA) | 보조 prose, 캡션, 백링크 헤딩. |
| `--color-text-faded` | `#8a8e98` | `#6b7180` | Light ≈ **3.4:1** · Dark ≈ **3.6:1** — **non-body only** | 메타 날짜, 카운트 배지, 엣지 라벨. |
| `--color-text-link` | `#a83612` | `#f0a373` | Light ≈ **5.7:1** · Dark ≈ **9.3:1** (AA) | iron-oxide / warm-amber 액센트 링크. |
| `--color-text-link-hover` | `#7c2810` | `#f5be94` | Light ≈ **7.6:1** · Dark ≈ **11.2:1** | 링크 호버. |
| `--color-text-code` | `#1b1d22` | `#dcdee2` | body와 동일 | 인라인 코드 텍스트. |

> `--color-text-faded`는 의도적으로 4.5:1 미만이며 **body가 아닌** large UI/메타 영역(uppercase mono ≥ 12px @ 500, 또는 더 큰 numeral)에만 허용된다. 본문 prose에 사용 금지. 이 제한은 컴포넌트 가이드에서 재차 강제된다.

### 4-3. 시맨틱

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--color-success` | `#0f7a3a` | `#5fd599` | audit pass, OK 배지 |
| `--color-warn` | `#9a5a06` | `#f0b860` | audit warn |
| `--color-error` | `#a51b1b` | `#f08080` | audit fail |
| `--color-border` | `#e4dfd3` | `#262a36` | 헤어라인 보더, 기본 1px solid |
| `--color-border-strong` | `#c9c1ad` | `#3a4054` | embed-aside 리본, blockquote rule |
| `--color-focus-ring` | `#a83612` | `#f0a373` | 링크 액센트와 동일 — 절대 제거 금지 |

### 4-4. 액센트 (단일 브랜드 액센트: iron oxide)

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--color-accent` | `#a83612` | `#f0a373` | 단일 브랜드 액센트. 링크, 포커스 링, 헤딩 앵커 `#`, blockquote rule. |
| `--color-accent-soft` | `#f3e1d6` | `#3a261b` | 미세 액센트 표면 — selection bg, 태그 칩 active. 절제해서 사용. |

> **Why iron oxide**: warm·distinctive·non-AI-default. paper-cream / ink-warm 배경과 화학적으로 어울림. **단일 액센트 — v0.2에서 보라/인디고 금지, 두 번째 브랜드 컬러 금지.**

## 5. 타이포그래피

### 5-1. 폰트 스택과 self-host 정책

| 토큰 | 스택 | Self-host 출처 | 용도 |
|---|---|---|---|
| `--font-sans` | `Inter, "Pretendard Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif` | Inter Variable woff2 (rsms/inter, OFL) · Pretendard Variable woff2 (orioncactus/pretendard, OFL) | 본문, `h4`, UI 크롬. |
| `--font-serif` | `"Source Serif 4", "Noto Serif KR", ui-serif, Georgia, "Apple SD Gothic Neo", serif` | Source Serif 4 Variable woff2 (Adobe, OFL) · Noto Serif KR woff2 (Google, OFL) | `h1`–`h3` only. |
| `--font-mono` | `"JetBrains Mono", "D2Coding", ui-monospace, SFMono-Regular, Menlo, monospace` | JetBrains Mono Variable woff2 (JetBrains, OFL) · D2Coding woff2 (Naver, OFL) | 코드, 메타, kbd, 언어 라벨, 브랜드 마크, 내비. |

> 세 종 모두 `apps/blog/public/fonts/` 아래 self-host. **Google Fonts / Bunny / 그 어떤 외부 CDN에서도 로드하지 않는다.** privacy-first 제품의 referrer/IP 누출 경로가 되기 때문. `font-display: swap`으로 시스템 폴백이 먼저 칠해지도록 한다(FOUT 허용, FOIT 금지).

### 5-2. 타입 스케일 (modular, ratio ≈ 1.25 anchored at 17px body)

| 토큰 | 크기 | weight | line-height | letter-spacing | family |
|---|---|---|---|---|---|
| `--text-h1` | `2rem` (32px) | 600 | 1.2 | -0.01em | serif |
| `--text-h2` | `1.5rem` (24px) | 600 | 1.3 | -0.005em | serif |
| `--text-h3` | `1.25rem` (20px) | 600 | 1.35 | 0 | serif |
| `--text-h4` | `1.0625rem` (17px) | 600 | 1.4 | 0.005em | sans |
| `--text-body` | `1.0625rem` (17px) | 400 | 1.7 | 0 | sans |
| `--text-small` | `0.875rem` (14px) | 400 | 1.5 | 0 | sans |
| `--text-meta` | `0.75rem` (12px) | 500 | 1.4 | 0.04em (uppercase) | mono |
| `--text-code` | `0.9375rem` (15px) | 400 | 1.6 | 0 | mono |

### 5-3. 측정폭 / line-height

- 본문 측정폭(measure): `--measure-prose = 68ch` (v0.1의 65ch 대비 살짝 넓혀 사이드 마진 그리드와 균형).
- 모바일에서는 `min(100%, 65ch)`로 좁힌다.
- line-height: 본문 1.7, 헤딩 1.2–1.35(스케일 표 참조).

## 6. 레이아웃

### 6-1. 컨테이너 & 마진 컬럼

| 토큰 | 값 | 용도 |
|---|---|---|
| `--measure-prose` | 68ch | 본문 reading column |
| `--container-main` | 72ch | 메인 콘텐츠 max-width(마진 컬럼 포함) |
| `--container-index` | 56rem | 홈/태그 인덱스(리스트용 그리드) |
| `--margin-col-w` | 12rem | 사이드 마진 표기 컬럼 (`lg+`에서만 표시) |

- `BaseLayout`의 `<main>`과 `<header>`/`<footer>`는 모두 `mx-auto max-w-[var(--container-main)]`.
- `lg+` 뷰포트에서는 `<main>`이 `grid-cols-[var(--margin-col-w)_minmax(0,var(--measure-prose))]` 패턴으로 쪼개져 왼쪽 12rem이 마진 컬럼, 오른쪽 68ch가 본문이 된다. `< lg`에서는 단일 컬럼.

### 6-2. 정렬과 모바일 분기

- 정렬: **좌측 정렬**. 페이지 제목 외 중앙 정렬 금지(404의 큰 mono "404"는 마진 컬럼에 좌측 정렬되며, 모바일에선 위로 스택).
- Breakpoint: `md = 768px`(내비 표시), `lg = 1024px`(사이드 마진 컬럼 활성).
- 모바일(`< 640px`): `px-4`, 메인 패딩 `py-8`, 측정폭 `min(100%, 65ch)`.
- 데스크톱(`md+`): `px-6`, 메인 패딩 `py-12`.

### 6-3. Spacing scale (8-base)

| 토큰 | px | 용도 |
|---|---|---|
| `--space-1` | 4 | 인라인 코드 padding, 칩 x-padding |
| `--space-2` | 8 | 타이트 스택, 리스트 아이템 y |
| `--space-3` | 12 | 메타→타이틀, 칩 y |
| `--space-4` | 16 | 단락 간격, 내비 y |
| `--space-5` | 24 | 섹션 내부 |
| `--space-6` | 32 | 섹션 사이 |
| `--space-7` | 48 | h2 top margin, 주요 블록 사이 |
| `--space-8` | 64 | 내비→콘텐츠, 푸터 top |
| `--space-9` | 96 | landing 전용 top breath |
| `--space-10` | 128 | reserved (드물게 사용) |

### 6-4. Radius scale (sharp by default — 의도적 변주)

| 토큰 | px | 용도 |
|---|---|---|
| `--radius-sm` | 2 | 인라인 코드 칩, kbd |
| `--radius-md` | 4 | 태그 칩, 버튼, 내비 아이템, 이미지 캡션 스트립 |
| `--radius-lg` | 8 | 이미지 컨테이너, embed aside, 코드 블록 |

> `radius-xl` / `radius-2xl` / `radius-full` 토큰은 의도적으로 만들지 않는다. "모든 카드에 같은 둥글기"라는 AI 템플릿 신호를 호출부에서 합성할 수 없도록 토큰 tier 자체가 차단. 그래프 노드는 SVG `<circle>`이라 이 스케일에 묶이지 않는다.

### 6-5. Elevation (max 1)

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--shadow-1` | `0 1px 0 rgba(0,0,0,0.06)` | `0 1px 0 rgba(0,0,0,0.5)` | **스크롤 시 sticky 헤더에만** 헤어라인 그림자로. 글로우/카드 lift 금지. |

> 카드/aside/칩은 모두 `--color-border` 1px solid로 elevation을 표현 — 이게 v0.2의 elevation 모티프다. 멀티 스텝 그림자 스케일 자체가 토큰에 존재하지 않으므로 호출부가 SaaS 스타일 elevation을 합성할 수 없다.

## 7. 컴포넌트 가이드

각 컴포넌트의 시각·모바일 동작은 `phases/step9-design-overhaul/design/COMPONENTS.md`와 1:1. 토큰명을 그대로 인용하므로 step 3–5 구현자는 본 절을 그대로 옮길 수 있다.

### 7-1. `BaseLayout`

```html
<body class="bg-page text-body font-sans antialiased">
  <a class="skip-link">본문으로 건너뛰기</a>

  <header class="sticky top-0 z-30 bg-page/95 border-b border-default">
    <div class="mx-auto max-w-[var(--container-main)] px-4 md:px-6 flex items-center justify-between h-12">
      <a href="/" class="font-mono text-meta uppercase tracking-wider text-heading">noteforge</a>
      <nav class="hidden md:flex items-center gap-6 font-mono text-meta uppercase tracking-wider">
        <a href="/">notes</a>
        <a href="/tags">tags</a>
        <a href="/graph">graph</a>
      </nav>
      <div class="flex items-center gap-2">
        <button id="theme-toggle" aria-label="테마 전환"
                class="p-1.5 rounded-md hover:bg-surface-strong">[icon]</button>
        <button id="menu-toggle" aria-label="메뉴"
                class="md:hidden p-1.5 rounded-md hover:bg-surface-strong">[hamburger]</button>
      </div>
    </div>
  </header>

  <main id="main" class="mx-auto max-w-[var(--container-main)] px-4 md:px-6 py-8 md:py-12">…</main>

  <footer class="mt-16 border-t border-default">
    <div class="mx-auto max-w-[var(--container-main)] px-4 md:px-6 py-6
                font-mono text-meta uppercase tracking-wider text-muted
                flex flex-wrap gap-x-6 gap-y-2">
      <span>© 2026 — noteforge</span>
      <span>built {date}</span>
      <a href="/feed.xml">rss</a>
    </div>
  </footer>
</body>
```

- 브랜드 마크: monospace, lowercase, `text-meta` uppercase tracking, `text-heading` 색.
- 내비: monospace, uppercase, `text-meta` 크기, `gap-6`. 활성 항목은 `text-link`.
- 테마 토글: 28×28 hit area, `localStorage` 영속 + 첫 방문은 `prefers-color-scheme` 존중.
- 라이트/다크 시각: 라이트는 warm-cream에 헤어라인 보더가 거의 보이지 않을 정도로 미세, 다크는 cool-ink 위에 보더가 한 단계 명확. 양쪽 모두 sticky 시 `--shadow-1` 1px 헤어라인.
- 모바일(`< 640px`): 내비가 슬라이드 시트로 collapse(`--duration-menu` 200ms). 헤더 높이 48px 유지, 브랜드 + 테마 + 햄버거만 노출.

### 7-2. `Note` — 본문 article

```html
<article class="prose mx-auto max-w-[var(--measure-prose)]">
  <header class="mb-7 not-prose">
    <h1 class="font-serif text-h1 text-heading">{title}</h1>
    <div class="mt-3 font-mono text-meta uppercase tracking-wider text-muted
                flex flex-wrap gap-x-4 gap-y-1">
      <time datetime="{date}">{date}</time>
      {updated && <span>updated {updated}</span>}
      {tags.map(t => <a href="/tags/{t}">#{t}</a>)}
    </div>
  </header>
  <!-- body — set:html note.body -->
</article>
```

- `h1` / `h2` / `h3`: `font-serif text-h{n} text-heading`, `mt-{7|6|5}` / `mb-{4|3|2}`.
- `h4`: `font-sans text-h4 text-heading mt-5 mb-2` — sans on purpose(serif h1–h3와의 hierarchy 대비).
- 본문 `<p>`: `text-body leading-[1.7] my-4`.
- 인라인 `<a>`: `text-link underline decoration-1 underline-offset-[3px] hover:decoration-2 hover:text-link-hover transition-[color,text-decoration-thickness] duration-fast`.
- 인라인 `<code>`: `font-mono text-code bg-code text-code rounded-sm px-1 py-[1px]`.
- `<pre>`: `relative font-mono text-code bg-code rounded-lg p-4 overflow-x-auto` + 우상단 mono 언어 칩(`absolute top-2 right-3 font-mono text-meta uppercase tracking-wider text-faded`).
- `<blockquote>`: `border-l-[3px] border-strong pl-5 my-6 italic text-muted` (배경/따옴표 글리프 없음).
- `<figure>` / `<img>`: `<img>`는 `rounded-lg w-full`, `<figcaption class="mt-2 text-small text-muted text-center font-sans">{alt}</figcaption>`. alt 누락 시 빌드 경고 + `<p class="text-small text-warn">[이미지 설명 누락]</p>`.
- **Embed aside** (transcluded `![[Note]]`): `<aside class="my-7 border-l-[3px] border-strong bg-surface rounded-lg p-5">{body}</aside>`.
- 라이트/다크 시각: 본문 색은 `--color-text-body` 토큰을 통해 양쪽 모드에서 자동 전환. 코드 블록은 `--color-bg-code`로 페이지 색과 분명히 구분.
- 모바일(`< 640px`): 측정폭 `min(100%, 65ch)`, `h1` → `text-[1.75rem]`, 코드 블록은 가로 스크롤, embed aside의 좌측 padding 1단계 축소.

### 7-3. 메타 행 (`Note` 안)

- 날짜 / updated / 태그가 `h1` 바로 아래 단일 mono 행에 `gap-x-4`로 배치.
- `lg+`에서는 동일 메타가 좌측 마진 컬럼(본문 좌측 12rem)에 *추가로* 미러링되어 스크롤 중에도 보이게. `< lg`에선 인라인 행만.
- 메타 행 안의 태그 링크는 본문 링크 스타일을 상속하되 `#` 접두만 붙임(칩 X — 칩은 `TagList`/`TagPage` 전용).

### 7-4. 헤딩 앵커 (`#`)

- 모든 헤딩에 안정적 `id`(텍스트의 kebab-case slug) 부여.
- 형제 `<a class="heading-anchor" href="#{id}" aria-label="이 섹션 링크 복사">#</a>`:
  - `lg+`: 마진 컬럼에 절대 위치, `font-mono text-meta text-faded -ml-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-base`.
  - `< lg`: 헤딩 텍스트 뒤 inline-end, 동일한 호버 노출.
- 약 30줄짜리 vanilla-JS 클릭 핸들러를 `BaseLayout`에서 한 번만 로드: `location.origin + location.pathname + '#' + id`를 클립보드에 복사 + 1.5s 동안 mono "copied" 인라인. `prefers-reduced-motion: reduce` 시 페이드 없이 즉시.
- 모바일(`< 640px`): 호버 상태가 없으므로 앵커는 **항상 표시**. 탭으로 복사.

### 7-5. `Backlinks`

```html
<aside class="mt-12 pt-6 border-t border-default" aria-label="백링크">
  <h2 class="font-mono text-meta uppercase tracking-wider text-muted">
    referenced by · 이 노트를 참조하는 노트
  </h2>
  <ul class="mt-3 space-y-1">
    {entries.map(e =>
      <li class="font-sans text-body">
        <span class="font-mono text-meta text-faded mr-2">→</span>
        <a href="/{e.slug}">{e.title}</a>
      </li>
    )}
  </ul>
</aside>
```

- article 본문 아래·푸터 위에 위치. `lg+`에서는 마진 컬럼에 "↓ backlinks (n)" 앵커가 추가로 따라붙는다.
- **빈 상태에서는 아무것도 렌더하지 않음** (privacy: 비어있는 "Backlinks" 헤딩은 "여기 private 노트가 있을 수 있다"는 신호가 됨).
- 라이트/다크 모두 `text-muted` 헤딩, `text-faded` 화살표, body 톤 링크 — 토큰만으로 양쪽 모드 일관.
- 모바일(`< 640px`): 동일 구조, 폰트 크기 변동 없음.

### 7-6. `TagList` (인덱스 페이지)

```html
<section class="space-y-5">
  <h1 class="font-serif text-h1 text-heading">tags</h1>
  <ul class="flex flex-wrap gap-2">
    {tags.map(t =>
      <li>
        <a href="/tags/{t.tag}"
           class="inline-flex items-baseline gap-1 px-2 py-1
                  rounded-md border border-default bg-surface
                  hover:bg-surface-strong
                  font-mono text-meta text-body">
          <span>#{t.tag}</span>
          <sup class="text-faded">{t.count}</sup>
        </a>
      </li>
    )}
  </ul>
</section>
```

- 칩: `--radius-md`(4px), 보더 + bg, mono. 호버 `bg-surface-strong`. 포커스는 `--color-focus-ring` outline.
- Active(현재 태그가 `TagPage`에 있을 때): `bg-accent-soft` + 액센트 텍스트.
- 모바일(`< 640px`): wrap-grid 그대로 유지.

### 7-7. `TagPage`

```html
<section class="space-y-6">
  <h1 class="font-serif text-h1 text-heading">#{tag}</h1>
  {entries.length > 0 ? (
    <ul class="space-y-3">
      {entries.map(e =>
        <li class="flex items-baseline gap-3 font-sans text-body">
          {e.date && <time class="font-mono text-meta uppercase tracking-wider
                                  text-faded shrink-0">{e.date}</time>}
          <span class="font-mono text-meta text-faded">→</span>
          <a href="/{e.slug}">{e.title}</a>
        </li>
      )}
    </ul>
  ) : (
    <p class="text-muted">이 태그를 가진 공개 노트가 없습니다.</p>
  )}
</section>
```

- 좌측 mono 날짜, `→` 구분자, sans body 타이틀 링크.
- 모바일(`< 640px`): `flex-wrap`으로 날짜가 타이틀 아래로 떨어짐.

### 7-8. `Graph`

- 정적 SVG, `viewBox`는 기존 `computeCircularLayout` 유지.
- 노드 `<circle>`: `fill="currentColor" class="text-heading hover:text-link"` — CSS 상속으로 라이트/다크 자동 대응.
- 엣지 `<line>`: `stroke="currentColor" class="text-faded" stroke-width="1"`.
- 래퍼 `<figure class="font-mono text-meta">`: 옵션 캡션 "n nodes · m edges"는 mono uppercase.
- 빈 상태: `<p class="text-muted">아직 공개된 글이 없습니다.</p>` (v0.1 카피 유지).
- Privacy: private 노드는 데이터 레이어(Phase C)에서 이미 제거. 시각 레이어에는 필터링 책임이 없다.
- 모바일(`< 640px`): SVG `width="100%" height="auto"` — 비율 유지, 노드 탭으로 내비게이션.

## 8. 다크 모드

### 8-1. 토글 정책

- 첫 방문: `prefers-color-scheme`을 따른다(시스템이 dark면 dark로 시작).
- 사용자 토글: `BaseLayout` 헤더의 `#theme-toggle` 버튼(28×28 hit area)으로 명시 전환.
- 영속화: `localStorage.theme = "light" | "dark"`. `<html data-theme>`로 적용.
- `prefers-reduced-motion: reduce` 시 토글 아이콘 트랜지션 0ms.

### 8-2. FOUC 방지

- `<head>` 안에 동기 inline script *1개* 허용: `localStorage.theme`을 읽어 `<html>`에 `data-theme`을 즉시 주입(또는 `prefers-color-scheme`을 폴백). 이 스크립트가 v0.2에서 새로 도입되는 **유일한** 동기 head script.
- 본문 페인트 후 페이드 등의 후처리 금지. 정적 출력 계약 유지.

### 8-3. 토큰의 이중 모드 동작

- 4절의 모든 색 토큰은 `:root`에 라이트 값, `[data-theme="dark"]`에 다크 값으로 정의(또는 `@media (prefers-color-scheme: dark)`로 미러). 컴포넌트는 **항상 토큰만 참조** — 컴포넌트 안에 라이트/다크별 분기 CSS 금지.
- iron-oxide 액센트는 라이트 `#a83612` / 다크 `#f0a373`로 모드 간 luminance가 자연스럽게 이동하지만 *의미*는 동일(링크·포커스·앵커).

## 9. 모션

| 토큰 | 값 | 용도 |
|---|---|---|
| `--duration-fast` | 100ms | 링크 underline 두께 |
| `--duration-base` | 150ms | 링크 색, 버튼 bg, 테마 토글 아이콘 |
| `--duration-menu` | 200ms | 모바일 메뉴 슬라이드 |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | 감속, 기본 ease |
| `--ease-linear` | `linear` | 색만 트랜지션할 때 |

- 허용: 위 표의 트랜지션, 모바일 메뉴 슬라이드, 헤딩 앵커 호버 페이드, 토글 아이콘 회전.
- 금지: 페이지 전환 fade-in/slide-up, scroll-reveal, 패럴랙스, 카드 lift on hover, 자동 캐러셀.
- `--duration-slow`/spring 토큰은 의도적으로 미제공 — 호출부가 랜딩페이지식 모션을 합성할 수 없게.
- **`prefers-reduced-motion: reduce` 의무 지원**: `base.css`에서 위 모든 duration을 0으로 덮어쓴다(토큰을 포함해서). 새 컴포넌트는 별도의 모션을 도입할 때 이 미디어 쿼리를 반드시 준수.

## 10. 아이콘

- SVG 인라인, `stroke-width: 1.5`, `currentColor` fill/stroke.
- 둥근 배경 박스로 감싸지 **않는다** — 아이콘은 텍스트 옆 라인으로만 존재.
- 출처: **Lucide icons** 또는 **Heroicons outline** 중 한 종을 프로젝트 단위로 선택. **둘을 혼용하지 않는다** — 시각 일관성 깨짐.
- 장식 아이콘 금지(랜덤 graphic, mascot, illustration). UI 어포던스가 명시될 때만(테마 토글, 햄버거, 외부 링크 ↗ 등).

## 11. 접근성

- 모든 인터랙티브 요소는 키보드 포커스 outline 유지(제거 금지). `--color-focus-ring`을 사용해 라이트/다크 양쪽에서 보이도록.
- semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<figure>`, `<time>`. div/span으로 의미 깔지 않기.
- 이미지 `alt` 의무. 누락 시 빌드 경고 + 본문에 `[이미지 설명 누락]` 안내.
- 색상 대비: WCAG AA(본문 텍스트/배경 4.5:1 이상). 4-2의 모든 body 토큰이 양쪽 모드에서 통과. `--color-text-faded`는 body 금지.
- `sr-only` 사용처: "외부 링크", "비공개 링크 자리"(strip-to-text 보강), "다음 섹션 링크 복사"(헤딩 앵커), "테마 전환"(토글 라벨), "메뉴"(햄버거).
- 키보드 단축키나 마우스 전용 인터랙션 도입 시 동등한 키보드 경로 보장.

## 12. URL 포맷 (참고)

- 내부 링크: `href="/projects/foo"` (상대 경로, trailing slash 없음).
- 외부 링크: `target="_blank" rel="noopener noreferrer"` + 작은 ↗ 아이콘(선택).

## 13. 404 페이지

- 카피(고정): "페이지를 찾을 수 없습니다" / "요청하신 페이지가 존재하지 않거나, 더 이상 공개되지 않습니다." / `→ home`.
- **private 노트의 존재를 누설하지 않는 문구** — "삭제됨" / "이전에 있었으나" 등 표현 금지. 노트가 비공개로 전환된 경우와 애초에 없었던 경우를 시각적으로 구분하지 않는다.
- 시각: `lg+`에서 큰 mono "404"가 좌측 마진 컬럼(`text-[5rem] text-faded`)에 위치, 본문은 `font-serif text-h1 text-heading`. 모바일에서는 stack(`text-[3.5rem]`).

## 14. Privacy 시각 계약 (절대 우회 금지)

이 절은 시각 디자인 변경이 privacy 계약을 *시각 레이어에서* 우회하는 것을 막기 위한 가이드다. 데이터 레이어의 처리는 `docs/PRD.md` / `docs/ARCHITECTURE.md`(Phase C)에 정의되어 있고, 본 가이드는 그것이 시각으로 새지 않도록 보강한다.

1. **Private wikilink는 `<a>` 없는 strip-to-text** — public 노트에서 private을 가리키는 `[[Private]]`는 plain text로만 남는다. 시각 레이어에서 placeholder("[비공개 링크]"), 회색 박스, hover tooltip, badge 같은 *어떤 표시도* 금지. private이 거기 있다는 신호 자체를 만들지 않는다.
2. **Private embed(`![[Private]]`)는 AST에서 제거 — 빈 자리도 표시 금지** — embed가 사라진 자리에 "[비공개 임베드]" 박스, 점선 테두리, "재방문 시 공개될 수 있음" 같은 카피 모두 금지. 그냥 흐름이 자연스럽게 이어져야 한다.
3. **Allowlist 외 frontmatter는 meta/og에 노출 금지** — 본 가이드의 어떤 `<meta>`/`<og:*>` 슬롯에도 allowlist(`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`) 외 필드를 채우지 않는다. "보기 좋게" 추가 메타를 노출하는 디자인 수정 금지.
4. **그래프/백링크는 filtered 데이터만 받는다** — `Graph`/`Backlinks` 컴포넌트는 입력으로 받은 노드/엣지 셋을 그대로 그릴 뿐, 스스로 필터링하거나 추가 데이터(예: total count, "n more" 따위)로 보완하지 않는다. 빈 상태는 7-5의 정책대로 — 비어 있을 땐 *섹션 자체가 없다*.
5. **검색/리스팅에서 private 슬러그·제목 0회** — 향후 v0.2+에서 검색 UI/sitemap을 도입하더라도, UI가 받는 데이터는 public-only filtered 셋이어야 하며, "private이 있긴 하다"는 시각 신호(잠긴 자물쇠 아이콘 등)를 도입하지 않는다.
6. **시각 누출 회귀는 audit이 잡는다** — `pnpm obpub audit`가 dist에서 private 제목/첨부/`%%comment%%`/allowlist 외 필드를 0회 검증. 시각 변경 시 audit이 통과해야 머지 가능.

---

## v0.1에서 무엇이 바뀌었나

- **단일 라이트 테마 → 라이트/다크 동시 지원** — `prefers-color-scheme` 자동 + 헤더 토글, FOUC 방지 sync script 1개.
- **시스템 폰트 단일 스택 → serif/sans/mono triad self-host** — Source Serif 4 + Inter + JetBrains Mono(영문) / Noto Serif KR + Pretendard + D2Coding(한글). 외부 CDN 금지, 모두 OFL.
- **단일 컬럼 → 사이드 마진 그리드(`lg+` 12rem)** — 헤딩 앵커, 메타 미러, 404 의 큰 mono numeral이 마진 컬럼에 배치. 모바일은 인라인 collapse.
- **블루(`#2563eb`) 링크 → iron-oxide(`#a83612` light / `#f0a373` dark) 단일 액센트** — 보라/인디고는 여전히 금지. 두 번째 브랜드 컬러 도입도 금지.
- **그림자 0개 → `--shadow-1` 1단계** — sticky 헤더 헤어라인 그림자 1개만. 카드/aside는 헤어라인 보더로 elevation 표현.
- **타입 스케일·간격·radius 토큰화** — modular 1.25 ratio, 8-base spacing, sharp 2/4/8 radius. `xl+` radius와 멀티 스텝 그림자/duration은 토큰 tier에서 제거.
- **본문 측정폭 65ch → 68ch** — 사이드 마진 그리드와의 시각 균형. 모바일에서는 65ch로 다시 좁힘.
- **`text-zinc-*` 직접 참조 → CSS 변수 토큰** — 컴포넌트는 항상 토큰만 참조. 라이트/다크 분기는 토큰 레이어에서 한 번만 정의되고 컴포넌트는 모드에 무관.
