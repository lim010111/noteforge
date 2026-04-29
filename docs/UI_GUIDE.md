# UI 디자인 가이드 — @noteforge/theme-default (v0.3)

## 1. 설계 배경

v0.1은 "노트북·논문·위키" 톤의 미니멀 라이트 테마였다. v0.2는 같은 계약 위에 editorial-technical 방향으로 결을 다잡고, 라이트/다크 동시 지원과 serif/sans/mono triad self-host(Source Serif 4 + Inter + JetBrains Mono — 한글 미러로 Noto Serif KR + Pretendard + D2Coding)로 *production-grade*의 결을 만들었다.

v0.3는 v0.2의 골격을 그대로 유지하면서 **navigational spine**을 얹는다. 도그푸드를 한 사이클 운영해 보니 노트 한 편 한 편은 의도된 결로 읽혔지만 *vault 전체의 구조*는 가시성이 0이었다 — 첫 방문자에게는 제목 목록이 평탄하게 나열될 뿐, "이 사람의 지식이 어떻게 구획되어 있는지"가 한눈에 안 들어왔다. v0.3가 답하는 건 단 하나: **vault의 모양을 보여 주자.** 좌측에 영구 사이드바를 두고 그 안에 아이덴티티 블록(아바타+닉네임)과 JS-less 폴더 트리를 배치하고, 홈은 평탄 연대기 대신 Recent(`n=10`) + Featured(`n=6`) 두 레일로 연다. 색상은 단일 iron-oxide 액센트만으로 트리/레일/breadcrumb이 너무 평면적이라, *warm earth tone* 가족 안에서만 보조 액센트 1개(forest-moss)와 카테고리 액센트 5슬롯을 추가한다.

editorial-technical 골격은 그대로다. 라이트(`#f9f6f1` warm cream)와 다크(`#0f1115` cool ink) 페이지 색은 유일한 분위기. 헤딩은 letterpress serif, 본문은 humanist sans, 메타·코드·UI 크롬은 monospace. 1px 헤어라인 + 단계 0~1의 `--shadow-1`. **decorative loosening이 아니라 navigational depth**가 v0.3의 변화다.

다음 계약은 v0.1·v0.2와 동일하게 v0.3에서도 절대 변경되지 않는다.

- **Privacy-first 시각 계약** — private wikilink/embed/frontmatter는 시각 레이어에서 *우회 불가*. v0.3 폴더 트리도 데이터 레이어에서 이미 필터링된 입력만 받으며, 시각이 누출 경로를 만들지 않도록 컴포넌트 가이드와 별도로 14절에 명시한다.
- **접근성 계약** — WCAG AA 4.5:1 대비, 키보드 포커스 outline 보존, semantic HTML, alt 의무.
- **정적 출력 계약** — 모든 UI는 빌드 타임에 결정. 다크모드 토글의 FOUC 방지 sync script 1개를 제외하고 `<head>`/페이지 안에 인터랙티브 JS를 새로 들이지 않는다. v0.3가 도입하는 폴더 트리·사이드바 드로어 모두 `<details>` 기반으로 JS는 0줄 추가.

이 문서는 fork 사용자를 위한 외부 SSOT다. 내부 디자인 토큰의 출처는 `phases/step10-v03-sidebar-redesign/design/TOKENS.md`(v0.2 SSOT인 `phases/step9-design-overhaul/design/TOKENS.md` 위의 delta)이며, 본 가이드의 모든 수치는 그 파일과 1:1로 일치한다. v0.2 본문은 [`docs/UI_GUIDE.v0.2.md`](./UI_GUIDE.v0.2.md)에 보존되어 있다(v0.1은 [`docs/UI_GUIDE.v0.1.md`](./UI_GUIDE.v0.1.md)).

## 2. 디자인 원칙 (v0.3)

1. **읽기 우선** — 본문이 주인공. 좌측 16rem 사이드바는 navigational spine이지만, 우측 본문 컬럼의 measure(`68ch`)와 typography는 v0.2와 동일하게 보존된다. 사이드바는 본문 흐름을 끊지 않는 단계 1의 tonal recess + 1px 우측 헤어라인 보더로만 존재.
2. **Editorial-technical** — 학술지의 사이드 마진 표기 × 엔지니어링 로그의 모노스페이스 메타. v0.3에선 좌측 사이드 마진 컬럼이 `Sidebar`로 흡수되며, 우측 마진 표기는 향후 단계 도입을 위해 `--margin-col-w` 토큰만 보존.
3. **Navigational spine** — 좌측 사이드바가 모든 라우트에 동일하게 노출. 본문과의 분리는 단 두 가지 신호로만 표현한다 — `--color-bg-sidebar`의 1단계 tonal recess와 1px 우측 보더. 두 번째 보더·인셋 그림자·frosted backdrop·gradient·noise 모두 금지.
4. **Hairline elevation, no glow** — 입체감은 1px 헤어라인 보더 + `--shadow-1`(sticky 헤더 1단계만)로. 글로우/리프트/멀티스텝 그림자는 도구로도 토큰으로도 제공하지 않음. v0.3는 새 그림자 tier를 도입하지 않는다.
5. **Single primary accent + warm earth-tone family** — iron-oxide(`#a83612` / `#f0a373`)는 *action* 액센트(링크·포커스·헤딩 앵커 `#`). v0.3가 추가하는 forest-moss(`#4d6948` / `#9ec19a`) 보조 액센트는 *identity / current-location*용. 카테고리 슬롯 5개(red-brown / ochre / moss / bronze / slate)는 모두 warm earth tone 가족. 보라·인디고·네온·cool 색은 v0.3에서도 금지이며, 두 번째 브랜드 색 시스템도 금지(액센트 가족은 *coordinated earth tone* 한 가지).
6. **Restraint over decoration** — 모션·아이콘·둥근 모서리·색상 모두 *의도적 변주*가 있는 곳에만. 균일한 둥글기·일괄 fade-in·장식용 SVG·AI 무지개 카테고리는 v0.3에서도 금지.

## 3. 유지·완화·추가 (안티패턴 표)

### v0.1 → v0.3에서도 금지되는 7개 안티패턴

| Anti-pattern | v0.1 정책 | v0.2 정책 | v0.3 정책 | Rationale (왜 유지) |
|---|---|---|---|---|
| `backdrop-filter: blur()` (glass morphism) | banned | keep banned | **keep banned** | 가장 알아채기 쉬운 AI 템플릿 신호. v0.3 사이드바도 *frosted backdrop을 쓰지 않는다* — `--color-bg-sidebar`의 1단계 tonal recess + 1px 우측 헤어라인 보더만 사용. 유일한 분위기는 페이지 색(`--color-bg-page`)이다. |
| Gradient text (`background-clip: text` on `h1` 등) | banned | keep banned | **keep banned** | SaaS 랜딩 클리셰. letterpress serif 헤딩과 충돌 — serif `h1`을 그라디언트로 칠하면 즉시 "AI hero" 신호가 된다. v0.3의 폴더명·breadcrumb·rail 헤딩 모두 solid color 유지. |
| "Powered by AI" / 생성 배지 | banned | keep banned | **keep banned** | 장식이지 기능이 아님. v0.3에서도 배지 없음. 어트리뷰션이 필요하면 푸터 mono 한 줄로 충분. |
| Box-shadow 네온 글로우 / 펄스 애니메이션 | banned | keep banned | **keep banned** | v0.3의 차별 표면도 헤어라인 보더 + 액센트로 만든다. 토큰 tier가 `--shadow-1`(1px 헤어라인) 1개만 노출 — 글로우 스케일 자체가 존재하지 않으므로 호출부가 합성할 수 없다. v0.3는 새 그림자 토큰을 도입하지 않는다. |
| 보라/인디고 브랜드 색상 | banned | keep banned | **keep banned** | iron-oxide(`#a83612` / `#f0a373`)가 primary action 액센트로 그대로. v0.3가 추가하는 forest-moss(`#4d6948` / `#9ec19a`)와 카테고리 슬롯 5개도 *전부 warm earth tone* — 보라/인디고/cool/네온은 슬롯 안에서도 금지(§3 v0.3 chromatic 한계선 참조). |
| 모든 카드에 동일한 `rounded-2xl` | banned | partial allow (radius 스케일 = `2 / 4 / 8 px` only) | **keep partial allow (v0.3 변경 없음)** | 핵심은 *의도적 변주*. inline code는 `--radius-sm`(2px), 칩/버튼은 `--radius-md`(4px), embed aside / 이미지 / 코드 블록은 `--radius-lg`(8px). `radius-xl` / `2xl` / `full` 토큰은 존재하지 않는다. v0.3 `AvatarBlock`의 `rounded-full`은 단일 이미지 인스턴스의 의도적 선택이지 새 토큰이 아니며, 폴더 행/레일 행/breadcrumb 점은 모두 2/4/8 스케일 안에 머문다. |
| 배경 gradient orb (`blur-3xl` 블롭) | banned | keep banned | **keep banned** | 분위기는 warm-cream / cool-ink 페이지 색 *하나만*으로. 메시 그라디언트, 노이즈 오버레이, 텍스처 필터 모두 `--color-bg-page` 위에 금지. **v0.3 `--color-bg-sidebar` 위에서도 동일하게 금지** — 사이드바 표면은 flat fill이며, recess 자체가 유일한 효과다. |

### v0.2에서 도입된 모티프와 한계선 — v0.3에서도 유효

| 모티프 | 허용되는 곳 | 한계 / 금지 | v0.3 상태 |
|---|---|---|---|
| **사이드 마진 표기 그리드** (12rem 컬럼) | `BaseLayout` 메인 그리드, `Note` 헤딩 앵커와 메타 미러 | 텍스트와 숫자만. 장식 도형/일러스트/이미지 금지. `< lg`에서는 인라인으로 collapse. | **좌측은 Sidebar로 대체 — 우측 전용으로 재해석.** `--margin-col-w` 토큰은 미래 우측 사용을 위해 보존. 현재 노트 페이지에서는 미사용. |
| **Monospace accent** (JetBrains Mono / D2Coding — 메타·kbd·언어 라벨·브랜드 마크·내비게이션) | h1 아래 메타 행, 코드 블록, 언어 칩, 브랜드 마크, 푸터, 내비 | 본문은 절대 mono 금지. `h1`–`h4`는 mono 금지(serif/sans만). 본문 안의 링크 자체를 mono로 스타일링하지 않음. | **변경 없음.** v0.3 사이드바 보조 nav 링크와 rail 섹션 헤딩(`▸ recent`, `▸ featured`)은 mono uppercase. 폴더명과 rail row 타이틀은 sans body. |
| **Letterpress serif headings** (Source Serif 4 / Noto Serif KR — `h1`–`h3`) | `Note` 안의 `h1`/`h2`/`h3`, 페이지 타이틀 슬롯 | 본문에 serif 금지. `h4+` serif 금지. UI 크롬(내비/버튼/칩/푸터)에 serif 금지. | **변경 없음.** v0.3 `FolderIndex` 페이지 헤딩은 `font-serif text-h1`; rail/section 헤딩은 mono(UI 크롬으로 분류). `AvatarBlock` 닉네임은 `font-sans text-h4`(h4는 sans 규칙). |
| **Hairline rules instead of shadows** (1px `--color-border` 어디서나 + 옵션 `--shadow-1` 1개만) | 섹션 디바이더, 카드, embed aside, 테이블 행, 스크롤된 sticky 헤더 | 카드/aside/칩의 elevation 힌트로 그림자 사용 금지 — 보더로 표현. 토큰 tier에 멀티 스텝 그림자 스케일이 존재하지 않음. | **변경 없음.** 사이드바-본문 분리는 단일 우측 보더. rail row는 `divide-y` 헤어라인. v0.3는 새 그림자 tier 도입하지 않는다. |
| **Paper-cream / cool-ink 페이지 색이 유일 분위기** (`--color-bg-page`) | 모든 페이지, 라이트/다크 양쪽 | 페이지 배경 위에 그라디언트/메시/orb/노이즈/텍스처 필터 금지. | **신중한 확장.** v0.3는 `--color-bg-sidebar` 1개를 *옆에* 추가(위에 쌓는 게 아님). "page bg 위에 오버레이 금지" 규칙 그대로. 신규 tier도 단일 flat fill — 그라디언트/텍스처/오버레이 동일 금지. |

### v0.3 chromatic 확장 — 새로 도입된 한계선

v0.3가 새로 허용하는 단 한 가지: **확장된 chromatic 시스템** — 보조 액센트 1개 + 카테고리 액센트 5슬롯 + 새 사이드바 surface tier. 그 *허용*과 함께 다음 *한계선*을 같은 강도로 명문화한다. 리뷰어는 이 표의 어느 한 행이라도 위반하는 PR을 거부해야 한다.

| 새로 허용 | 어디 적용 | 한계선 (위반 시 거부) |
|---|---|---|
| **보조 액센트** `--color-accent-2` / `-hover` / `-soft` (forest-moss) | `FeaturedRail` 헤딩, `FolderTree` current-folder row(텍스트+soft bg), 선택적 `AvatarBlock` 닉네임 보조 라인 | 그 외 어디에도 사용 금지. 본문 prose 링크는 iron-oxide 그대로. 두 번째 브랜드 색 시스템 금지(forest-moss는 *동일한 warm earth-tone family*의 보조이지 새 브랜드가 아니다). |
| **카테고리 액센트 슬롯** `--color-accent-cat-1`..`-5` (iron oxide / ochre / moss / bronze / slate) | depth-0 폴더 row 점, `FolderIndex` 첫 breadcrumb 점, `RecentRail` row 점, `FeaturedRail` row 점 | (a) 슬롯 6 이상 토큰 금지 — 6번째 폴더는 해시로 기존 슬롯 재사용. (b) per-슬롯 hover/soft/active 변종 금지(`--color-accent-cat-1-hover` 등 토큰 자체를 만들지 않는다). (c) 점 외에는 사용 금지(전체 row 배경 tint, full-width fill, "Project X is the purple one" 식 카테고리 브랜딩 금지). (d) 색은 인라인 `style="background-color: var(--color-accent-cat-N)"`로만 — 클래스명에 슬롯을 인코딩하지 않는다. (e) cool/saturated/non-warm 색 금지 — 모든 슬롯은 warm earth tone. |
| **사이드바 surface tier** `--color-bg-sidebar` (라이트 `#f4efe5` / 다크 `#13161d`) | 사이드바 패널(lg+ rail 및 < lg 드로어 본체)에서만 | 어떤 모달/팝오버/카드도 이 tier 사용 금지. `--color-bg-modal`/`--color-bg-popover`/`--color-bg-rail` 같은 추가 surface tier 금지(현재 ladder가 page / surface / surface-strong / code / sidebar로 종료). 텍스처/노이즈/그라디언트/메시 금지. |
| **액센트 사이의 gradient** | 없음 — 전부 금지 | `linear-gradient(--color-accent, --color-accent-2)` 같은 페어 그라디언트 금지. 카테고리 슬롯들로 메시 채우기 금지. 액센트는 항상 flat fill(텍스트 색 또는 점 background). |
| **color-only 상태 표시** | 없음 — 항상 동반 신호 필수 | active/current 상태는 색 단독으로 표현 금지. WCAG 1.4.1에 따라 `aria-current="page"` 또는 `--color-accent-2-soft` bg tint를 *반드시 함께* 사용. v0.3 current-folder row는 `aria-current="page"` + `bg-accent-2-soft` + `text-accent-2` 세 신호를 동시에 만족한다. |
| **private 상태 색-코딩** | 없음 — 전부 금지 | 자물쇠 아이콘, 회색 tint, "여기 비공개" 신호 모두 금지. 카테고리 시스템은 *공개 구조*에만 쓰인다(14절 §6 참조). 6번째 슬롯을 "private" 용도로 만드는 것 금지. |

## 4. 색상 토큰

토큰은 `packages/theme-default/src/styles/tokens.css`의 CSS 변수로 정의된다(전사 step 2 책임). 본문 텍스트와 페이지/사이드바 배경 대비는 라이트·다크 양쪽 WCAG 상대휘도 계산으로 ≥ 4.5:1 검증됨. 본 절의 모든 토큰명·hex 값은 v0.3 SSOT(`phases/step10-v03-sidebar-redesign/design/TOKENS.md` — v0.2 SSOT 위의 delta)와 1:1.

### 4-1. 배경

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--color-bg-page` | `#f9f6f1` | `#0f1115` | 페이지 표면. warm cream / cool ink. 의도적으로 순백/순흑 아님. |
| `--color-bg-surface` | `#ffffff` | `#161922` | 카드, embed aside, 코드 블록 단차. |
| `--color-bg-surface-strong` | `#f1ede5` | `#1c2030` | 칩/내비 호버, 테이블 헤더 행, 폴더 트리/레일 row 호버. |
| `--color-bg-code` | `#f1ede4` | `#1a1d27` | 코드 블록 배경. |
| `--color-bg-sidebar` *(v0.3 NEW)* | `#f4efe5` | `#13161d` | 사이드바 패널 표면(lg+ rail 및 `< lg` 드로어 본체). `--color-bg-page`로부터 라이트는 한 단계 warmer-darker, 다크는 한 단계 lighter — Δ 휘도가 의도적으로 1.5:1 미만이라 *recess*로 읽히고 *panel*로 읽히지 않는다. 본문 텍스트(`--color-text-body`)는 양쪽 모드에서 AAA(라이트 ≈ 14.0:1, 다크 ≈ 12.7:1). |

### 4-2. 텍스트

| 토큰 | Light | Dark | 페이지 배경 대비 | 용도 |
|---|---|---|---|---|
| `--color-text-body` | `#1b1d22` | `#dcdee2` | Light ≈ **14.8:1** · Dark ≈ **13.4:1** (AAA) | 본문 prose. |
| `--color-text-heading` | `#0a0c10` | `#f1f2f5` | Light ≈ **18.6:1** · Dark ≈ **16.9:1** (AAA) | 헤딩. |
| `--color-text-muted` | `#5a5e68` | `#9aa0ad` | Light ≈ **5.9:1** · Dark ≈ **5.3:1** (AA) | 보조 prose, 캡션, 백링크 헤딩, rail/folder 섹션 헤딩. |
| `--color-text-faded` | `#8a8e98` | `#6b7180` | Light ≈ **3.4:1** · Dark ≈ **3.6:1** — **non-body only** | 메타 날짜, 카운트 배지, 엣지 라벨, 폴더 chevron / leaf 글리프. |
| `--color-text-link` | `#a83612` | `#f0a373` | Light ≈ **5.7:1** · Dark ≈ **9.3:1** (AA) | iron-oxide 액센트 링크. |
| `--color-text-link-hover` | `#7c2810` | `#f5be94` | Light ≈ **7.6:1** · Dark ≈ **11.2:1** | 링크 호버. |
| `--color-text-code` | `#1b1d22` | `#dcdee2` | body와 동일 | 인라인 코드 텍스트. |

> `--color-text-faded`는 의도적으로 4.5:1 미만이며 **body가 아닌** large UI/메타 영역(uppercase mono ≥ 12px @ 500, 또는 더 큰 numeral)에만 허용된다. 본문 prose에 사용 금지. 이 제한은 컴포넌트 가이드에서 재차 강제된다.

### 4-3. 시맨틱

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--color-success` | `#0f7a3a` | `#5fd599` | audit pass, OK 배지 |
| `--color-warn` | `#9a5a06` | `#f0b860` | audit warn |
| `--color-error` | `#a51b1b` | `#f08080` | audit fail |
| `--color-border` | `#e4dfd3` | `#262a36` | 헤어라인 보더, 기본 1px solid. 사이드바 우측 분리, rail `divide-y`, breadcrumb 구분자 모두 동일 토큰. |
| `--color-border-strong` | `#c9c1ad` | `#3a4054` | embed-aside 리본, blockquote rule. |
| `--color-focus-ring` | `#a83612` | `#f0a373` | 링크 액센트와 동일 — 절대 제거 금지. |

### 4-4. 액센트

#### 4-4-1. Primary action accent — iron oxide (v0.2 그대로)

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--color-accent` | `#a83612` | `#f0a373` | primary 브랜드 액센트. 링크, 포커스 링, 헤딩 앵커 `#`, blockquote rule, breadcrumb 마지막(현재) 세그먼트. |
| `--color-accent-soft` | `#f3e1d6` | `#3a261b` | 미세 액센트 표면 — selection bg, 태그 칩 active. 절제해서 사용. |

#### 4-4-2. Secondary identity accent — forest moss *(v0.3 NEW)*

iron-oxide가 *action*(링크·포커스·앵커)을 담당한다면, forest-moss는 *identity / current-location*을 담당한다. 두 액센트는 서로 다른 의미 채널이며 동일 표면에서 충돌 없이 공존한다.

| 토큰 | Light | Dark | `--color-bg-page` 대비 | `--color-bg-sidebar` 대비 | 용도 |
|---|---|---|---|---|---|
| `--color-accent-2` | `#4d6948` | `#9ec19a` | Light ≈ **6.5:1** · Dark ≈ **8.5:1** (AA) | Light ≈ **6.0:1** · Dark ≈ **8.1:1** (AA) | `FeaturedRail` 헤딩, `FolderTree` current-folder row 텍스트(+ 점), 선택적 `AvatarBlock` 닉네임 보조 라인. |
| `--color-accent-2-hover` | `#3a5234` | `#bcd3b8` | Light ≈ **8.7:1** · Dark ≈ **11.2:1** | Light ≈ **8.0:1** · Dark ≈ **10.7:1** | `--color-accent-2`로 칠해진 링크의 호버. |
| `--color-accent-2-soft` | `#e3eadd` | `#1f2a1d` | non-text 표면 전용 | non-text 표면 전용 | current-folder row 배경 tint, `FeaturedRail` 섹션 헤더 strip. **텍스트로 쓰지 않는다.** |

> **Why forest-moss**: 따뜻한 yellow-green. iron-oxide와 warm color wheel 위에서 보색 관계지만 보라/인디고/cool 영역으로 넘어가지 않는다. 도서관·식물지 인상 — editorial-technical 방향에 자연스럽게 맞는다. **단일 보조 액센트** — v0.3에서 세 번째 브랜드 색 도입은 금지.

#### 4-4-3. Category accent slots *(v0.3 NEW)*

폴더 트리·breadcrumb·홈 레일에서 노트의 첫 슬러그 세그먼트를 색-코딩하는 5개 슬롯. 슬롯 인덱스는 *의미적으로 중립*이며 — `--color-accent-cat-1`은 "슬롯 1" 외 어떤 의미도 갖지 않는다. 슬러그 → 슬롯 매핑은 `packages/core/src/folderTree/categorySlot.ts`(step 3)의 결정론적 해시로 결정한다.

| 토큰 | Light | Dark | `--color-bg-page` 대비 | `--color-bg-sidebar` 대비 | 색 이름 / 비고 |
|---|---|---|---|---|---|
| `--color-accent-cat-1` | `#a83612` | `#f0a373` | Light ≈ **5.7:1** · Dark ≈ **9.3:1** | Light ≈ **5.3:1** · Dark ≈ **8.9:1** | Iron oxide — `--color-accent`와 의도적으로 동일. 가장 흔한 폴더가 브랜드 색을 자연스럽게 차지. |
| `--color-accent-cat-2` | `#9a6f0e` | `#d4a849` | Light ≈ **4.7:1** · Dark ≈ **9.6:1** | Light ≈ **4.4:1** · Dark ≈ **9.2:1** | Ochre — yellow-brown. |
| `--color-accent-cat-3` | `#5d6f3a` | `#a3b46b` | Light ≈ **5.5:1** · Dark ≈ **8.7:1** | Light ≈ **5.1:1** · Dark ≈ **8.3:1** | Moss — `--color-accent-2`보다 한 단계 밝은 yellow-green. ~1.0:1 휘도 단차로 구분. |
| `--color-accent-cat-4` | `#7d4f1c` | `#c79866` | Light ≈ **6.6:1** · Dark ≈ **7.5:1** | Light ≈ **6.1:1** · Dark ≈ **7.2:1** | Bronze — mid-brown. |
| `--color-accent-cat-5` | `#3a4d50` | `#9aabaa` | Light ≈ **9.8:1** · Dark ≈ **8.0:1** | Light ≈ **9.1:1** · Dark ≈ **7.6:1** | Slate — warm charcoal. "맞는 슬롯이 없을 때"의 중립 슬롯. |

다섯 슬롯의 hue 회전은 의도적으로 좁다 — red-brown → yellow-brown → yellow-green → mid-brown → warm-charcoal. 무지개가 아니라 *coordinated earth-tone family*. 보라·인디고·cool·neon은 슬롯 안에서도 금지(§3 v0.3 chromatic 한계선).

### 4-5. 확장 팔레트 한계선 *(v0.3 새 절)*

위 4-4-2/4-4-3의 *어디에도 쓰지 않는* 한계선을 명문화한다 — 토큰을 추가했다고 해서 §3 안티패턴이 약해지진 않는다.

- **warm earth tone family에 머무를 것** — 모든 신규 액센트(`--color-accent-2`, `--color-accent-cat-N`)는 red/orange/yellow/yellow-green/warm-brown/warm-charcoal 안에서만. 새 슬롯 PR이 cool/saturated/네온을 도입하면 거부.
- **카테고리 슬롯은 5개 ceiling** — `--color-accent-cat-6+` 토큰 금지. 6개째 폴더는 슬롯을 재사용한다(해시 결과). 더 큰 ring을 만들면 hue 영역이 warm 가족 밖으로 밀려난다.
- **per-슬롯 hover/soft/active 변종 금지** — `--color-accent-cat-1-hover`, `-soft`, `-active` 등 토큰 자체를 만들지 않는다. 카테고리 점은 hover 상태가 없고, row hover는 슬롯에 무관하게 `--color-bg-surface-strong`을 쓴다. 변종을 허용하면 호출부가 per-카테고리 surface 시스템을 합성할 수 있다(§3 보라/인디고 행 위반).
- **액센트 사이 gradient 금지** — `linear-gradient(--color-accent, --color-accent-2)`, 슬롯 메시 fill, 색 사이클 애니메이션 모두 금지(§3 gradient text / orb 행 적용).
- **새 surface tier 금지** — `--color-bg-modal`, `--color-bg-popover`, `--color-bg-rail` 등 추가 tier 금지. v0.2 ladder(page / surface / surface-strong / code) + v0.3 sidebar로 전체 ladder가 종료된다. 더 추가하면 `--shadow-1`-only 정책이 막은 multi-elevation 느낌이 다시 들어온다.
- **`--color-bg-sidebar` 위에 텍스처/노이즈/그라디언트/메시 금지** — `--color-bg-page`와 동일 규칙. 사이드바는 flat fill, recess가 유일 효과.
- **radius/그림자 스케일 변경 없음** — `--radius-xl`/`-2xl`/`-full`/`-pill`, `--shadow-2`/`-md`/`-lg` 모두 금지. AvatarBlock의 `border-radius: 9999px`는 단일 이미지 인스턴스의 의도적 선택이지 새 토큰이 아니며, 향후 PR에서 "pill" 토큰으로 일반화 금지.
- **color-only 상태 표시 금지** — active/current-page 상태는 `--color-accent-2` 텍스트 + `--color-accent-2-soft` bg + `aria-current="page"` 세 가지를 *동시에* 만족해야 한다(WCAG 1.4.1). 색 단독으로 신호하지 않는다.
- **private 상태 색-코딩 금지** — 자물쇠 아이콘, 회색 tint, "비공개 슬롯" 모두 금지. 14절 privacy 시각 계약과 동일.

## 5. 타이포그래피

### 5-1. 폰트 스택과 self-host 정책

| 토큰 | 스택 | Self-host 출처 | 용도 |
|---|---|---|---|
| `--font-sans` | `Inter, "Pretendard Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif` | Inter Variable woff2 (rsms/inter, OFL) · Pretendard Variable woff2 (orioncactus/pretendard, OFL) | 본문, `h4`, UI 크롬, 폴더명, rail row 타이틀. |
| `--font-serif` | `"Source Serif 4", "Noto Serif KR", ui-serif, Georgia, "Apple SD Gothic Neo", serif` | Source Serif 4 Variable woff2 (Adobe, OFL) · Noto Serif KR woff2 (Google, OFL) | `h1`–`h3` only. `FolderIndex` 페이지 헤딩 포함. |
| `--font-mono` | `"JetBrains Mono", "D2Coding", ui-monospace, SFMono-Regular, Menlo, monospace` | JetBrains Mono Variable woff2 (JetBrains, OFL) · D2Coding woff2 (Naver, OFL) | 코드, 메타, kbd, 언어 라벨, 브랜드 마크, 내비, 사이드바 보조 nav, rail/section 헤딩(`▸ recent`, `▸ featured`), breadcrumb. |

> 세 종 모두 `apps/blog/public/fonts/` 아래 self-host. **Google Fonts / Bunny / 그 어떤 외부 CDN에서도 로드하지 않는다.** privacy-first 제품의 referrer/IP 누출 경로가 되기 때문. `font-display: swap`. v0.3는 새 웹폰트를 도입하지 않는다.

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

- 본문 측정폭(measure): `--measure-prose = 68ch` (사이드 마진 그리드와의 시각 균형, v0.2와 동일).
- 모바일에서는 `min(100%, 65ch)`로 좁힌다.
- line-height: 본문 1.7, 헤딩 1.2–1.35.

## 6. 레이아웃

### 6-1. 컨테이너 & 사이드바

| 토큰 | 값 | 용도 |
|---|---|---|
| `--container-sidebar-w` *(v0.3 NEW)* | `16rem` (256px) | `lg+`에서 사이드바 폭. `< lg`에서는 사이드바가 `<details>` 드로어로 collapse하고 이 토큰은 사용되지 않는다. |
| `--measure-prose` | 68ch | 본문 reading column |
| `--container-main` | 72ch | 메인 콘텐츠 max-width |
| `--container-index` | 56rem | 홈/태그 인덱스 |
| `--margin-col-w` | 12rem | 우측 사이드 마진 표기 컬럼(`lg+`에서만). v0.3는 좌측이 `Sidebar`로 흡수되어 우측 전용으로 재해석. 현재 노트 페이지에서는 미사용이지만 향후 도입을 위해 토큰은 보존. |

- `lg+` 뷰포트: 페이지 전체가 좌측 16rem `Sidebar` + 우측 본문 컬럼(`max-w-[var(--container-main)]`)으로 분리. 사이드바와 본문은 1px `--color-border` 우측 헤어라인 + 1단계 tonal recess(`--color-bg-sidebar`)로만 구분.
- `< lg`: 사이드바는 `<details class="sidebar-drawer">` 드로어로 collapse. 본문 컬럼은 단일 컬럼.
- `BaseLayout`의 `<header>`/`<footer>`는 우측 본문 영역의 `mx-auto max-w-[var(--container-main)]` 안에 머문다 — 사이드바가 헤더/푸터 위에 떠 있는 게 아니라 페이지 좌측 stripe로 존재.

### 6-2. 정렬과 모바일 분기

- 정렬: **좌측 정렬**. 페이지 제목 외 중앙 정렬 금지(404의 큰 mono "404"는 우측 마진/상단 stack에 좌측 정렬).
- Breakpoint: `md = 768px`(헤더 nav 표시), `lg = 1024px`(사이드바 활성).
- 모바일(`< 640px`): `px-4`, 메인 패딩 `py-8`, 측정폭 `min(100%, 65ch)`, 사이드바는 드로어.
- 데스크톱(`md+`): `px-6`, 메인 패딩 `py-12`.

### 6-3. Spacing scale (8-base, v0.2와 동일)

| 토큰 | px | 용도 |
|---|---|---|
| `--space-1` | 4 | 인라인 코드 padding, 칩 x-padding |
| `--space-2` | 8 | 타이트 스택, 리스트 아이템 y |
| `--space-3` | 12 | 메타→타이틀, 칩 y, **폴더 트리 depth indent** |
| `--space-4` | 16 | 단락 간격, 내비 y |
| `--space-5` | 24 | 섹션 내부, 사이드바 좌우 padding |
| `--space-6` | 32 | 섹션 사이 |
| `--space-7` | 48 | h2 top margin, 주요 블록 사이 |
| `--space-8` | 64 | 내비→콘텐츠, 푸터 top |
| `--space-9` | 96 | landing 전용 top breath |
| `--space-10` | 128 | reserved |

v0.3는 새 spacing 토큰을 도입하지 않는다 — 폴더 indent는 `--space-3` 재사용.

### 6-4. Radius scale (sharp by default — v0.2와 동일)

| 토큰 | px | 용도 |
|---|---|---|
| `--radius-sm` | 2 | 인라인 코드 칩, kbd |
| `--radius-md` | 4 | 태그 칩, 버튼, 내비 아이템, 폴더 행 active bg, rail row hover bg |
| `--radius-lg` | 8 | 이미지 컨테이너, embed aside, 코드 블록 |

> v0.3는 새 radius 토큰을 도입하지 않는다. `AvatarBlock`의 `border-radius: 9999px`는 단일 이미지 인스턴스의 의도적 인라인 처리이지 토큰이 아니며, 폴더 행/rail 행/breadcrumb 점은 모두 2/4/8 스케일 안에 머문다(점은 `rounded-full` 클래스를 단일 6×6px 인스턴스에 적용한 것).

### 6-5. Elevation (max 1, v0.2와 동일)

| 토큰 | Light | Dark | 용도 |
|---|---|---|---|
| `--shadow-1` | `0 1px 0 rgba(0,0,0,0.06)` | `0 1px 0 rgba(0,0,0,0.5)` | 스크롤 시 sticky 헤더에만. 글로우/카드 lift/사이드바 그림자 모두 금지. |

> 사이드바와 본문의 분리는 *오직* 1px 우측 보더 + 1단계 tonal recess. v0.3는 새 그림자 tier를 도입하지 않는다.

## 7. 컴포넌트 가이드

각 컴포넌트의 시각·모바일 동작은 `phases/step10-v03-sidebar-redesign/design/COMPONENTS.md`와 1:1.

### 7-1. `BaseLayout` *(v0.3 갱신 — Sidebar 통합)*

```html
<body class="bg-page text-body font-sans antialiased">
  <a class="skip-link">본문으로 건너뛰기</a>

  <!-- < lg: 드로어형 사이드바가 헤더 위에 위치 -->
  <Sidebar avatar={...} nickname={...} tree={tree} currentPath={currentPath} extraNav={[...]} />

  <div class="lg:ml-[var(--container-sidebar-w)]">
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
  </div>
</body>
```

- 브랜드 마크: monospace, lowercase, `text-meta` uppercase tracking, `text-heading` 색.
- 헤더 nav: monospace, uppercase, `text-meta` 크기, `gap-6`. 활성 항목은 `text-link`.
- 테마 토글: 28×28 hit area, `localStorage` 영속 + 첫 방문은 `prefers-color-scheme` 존중.
- v0.2의 햄버거 버튼은 v0.3에서 제거 — 모바일 사이드바 드로어는 `<details>`의 `<summary>` 클릭으로 열고 별도 토글 JS는 없다.
- `lg+`: `<body>` 내부에서 사이드바가 `position: sticky` + `top: 0` + `height: 100vh`로 좌측에 고정. 본문 영역은 `lg:ml-[var(--container-sidebar-w)]`로 사이드바 폭만큼 밀려난다.
- 라이트/다크 시각: 라이트는 warm-cream 사이드바가 페이지보다 한 단계 짙고, 다크는 cool-ink 사이드바가 페이지보다 한 단계 옅다. 양쪽 모두 우측 보더 1px만으로 분리.
- 모바일(`< 640px`): 사이드바 드로어가 페이지 상단에 붙고 본문이 그 아래로 푸시된다. 헤더 높이 48px 유지.

### 7-2. `Sidebar` *(v0.3 새 절)*

**목적**: navigational spine. 모든 라우트에 동일하게 노출. 위에서부터 `AvatarBlock`(선택) + `FolderTree` + 보조 nav(선택)를 단일 recessed 좌측 패널로 합성한다.

**Props (TS-shape, prose form)**:

- `avatar?: { src: string; alt: string }` — `AvatarBlock`으로 그대로 전달.
- `nickname?: string` — `AvatarBlock`으로 그대로 전달.
- `handle?: string` — 닉네임 아래 mono 두 번째 라인(선택).
- `tree: FolderNode` — 폴더 트리 루트.
- `currentPath: string` — `aria-current="page"` 표시와 active row tint 결정.
- `extraNav?: Array<{ label: string; href: string }>` — 트리 아래 보조 링크(예: tags, graph). 비어 있으면 하단 nav 블록 자체가 미렌더.

**Markup contract**:

```html
<aside class="sidebar bg-sidebar border-r border-default w-[var(--container-sidebar-w)]
              hidden lg:flex flex-col" aria-label="사이트 내비게이션">
  {avatar && nickname && <AvatarBlock {...} />}
  <FolderTree tree={tree} currentPath={currentPath} />
  {extraNav?.length && (
    <nav class="border-t border-default px-5 py-4
                font-mono text-meta uppercase tracking-wider text-muted
                flex flex-col gap-2" aria-label="보조 내비게이션">
      {extraNav.map(n => <a href={n.href}>{n.label}</a>)}
    </nav>
  )}
</aside>

<details class="sidebar-drawer lg:hidden border-b border-default" aria-label="내비게이션 메뉴">
  <summary class="h-12 px-4 flex items-center gap-3
                  font-mono text-meta uppercase tracking-wider text-heading">
    <span class="chevron" aria-hidden="true">▸</span>
    <span>noteforge</span>
  </summary>
  <div class="bg-sidebar pb-4">
    {avatar && nickname && <AvatarBlock {...} />}
    <FolderTree tree={tree} currentPath={currentPath} />
    {extraNav?.length && <nav>…</nav>}
  </div>
</details>
```

- `lg+`: 사이드바는 `bg-sidebar`, 우측 1px 헤어라인. 좌측 보더·인셋 그림자·frosted backdrop 모두 금지.
- `< lg`: `<details>` 드로어. `<summary>`에 chevron + 브랜드 마크. `[open]` 상태에서 `--duration-menu`(200ms) 슬라이드. `prefers-reduced-motion: reduce` 시 즉시.
- 모바일에서도 별도 토글 JS는 추가하지 않는다 — 브라우저 기본 `<details>` 동작만 사용.
- Empty AvatarBlock(아바타/닉네임 한쪽 누락): AvatarBlock + 그 아래 보더 모두 미렌더, FolderTree가 사이드바 최상단에 `--space-6` top padding으로 시작.
- Empty extraNav: 하단 nav + 그 위 보더 모두 미렌더.

### 7-3. `AvatarBlock` *(v0.3 새 절)*

**목적**: 사이드바 최상단의 아이덴티티 슬롯. **placeholder 없는 render-when-complete** 정책.

**Props**:

- `avatarSrc?: string` — 이미지 URL(site config 또는 frontmatter source).
- `avatarAlt?: string` — 스크린리더용 alt; 기본은 nickname.
- `nickname?: string` — 표시명.
- `handle?: string` — mono 두 번째 라인(선택).

**Render rule (privacy-adjacent)**: `avatarSrc`와 `nickname`이 *둘 다* 비어 있지 않은 문자열인 경우에만 블록을 렌더한다. 둘 중 하나라도 누락되면 블록 자체를 출력하지 않는다 — initials 폴백, 실루엣 placeholder, "Anonymous" 카피 모두 금지. *placeholder는 "여기 누군가 숨겨져 있다"는 신호*가 되며 이는 거부한다(또한 AI 템플릿식 "user card" 분위기를 막는다).

**Markup**:

```html
{avatarSrc && nickname && (
  <div class="px-5 pt-6 pb-5 flex flex-col items-start gap-3">
    <img src={avatarSrc} alt={avatarAlt ?? nickname}
         width="64" height="64"
         class="w-16 h-16 rounded-full border border-default object-cover" />
    <div>
      <div class="font-sans text-h4 text-heading">{nickname}</div>
      {handle && (
        <div class="mt-1 font-mono text-meta uppercase tracking-wider text-faded">
          @{handle}
        </div>
      )}
    </div>
  </div>
)}
```

**아이덴티티 입력의 출처와 검증**: site-level 설정은 `apps/blog/obsidian-blog.config.ts`의 `site.avatar` / `site.nickname` / `site.handle` 필드로 받는다. step 2가 `siteSchema`(Zod)에 다음 검증을 추가한다.

- `site.avatar`는 **외부 호스트 거부** — `http://`, `https://`, `//`, `data:`로 시작하는 값은 모두 reject. 허용되는 형태는 `/`(앱 public 루트 상대 경로)나 vault 내부 첨부 경로뿐. *이유*: 외부 호스트 이미지는 referrer / IP 누출 경로가 되며, privacy-first 계약을 fork 사용자가 부지불식간에 깨뜨리는 가장 흔한 경로다(폰트 self-host 정책과 같은 결).
- `site.nickname`은 빈 문자열을 허용하지 않는다(빈 문자열은 누락과 동일하게 처리되어 블록 미렌더).
- `site.handle`은 선택. 누락 시 두 번째 라인 미렌더.
- 둘 다 누락 시 `Sidebar`는 `AvatarBlock` 없이 `FolderTree`만 렌더.

`Note` 본문의 `cover` frontmatter는 별개(allowlist 14개 중 하나). AvatarBlock과 cover는 다른 컴포넌트.

**카테고리 액센트 적용**: 없음. AvatarBlock은 트리 *위*에 있고 카테고리 컨텍스트가 없다. 닉네임 색은 `--color-text-heading`이며 `--color-accent-2`가 아니다(아이덴티티는 조용해야 한다).

**Mobile (`< 640px`)**: 동일 레이아웃, 드로어 본체 최상단. 아바타 크기 변동 없음.

### 7-4. `FolderTree` *(v0.3 새 절)*

**목적**: 폴더 계층을 JS-less 디스클로저 트리로 렌더. **폴더명은 항상 보이는 링크**, *children 리스트만* collapse.

**Props**:

- `tree: FolderNode` — 재귀 shape `{ name, href, depth, categorySlot?: 1..5, isCurrent?, children: Array<FolderNode | NoteNode> }`.
- `currentPath: string` — 일치하는 row에 `aria-current="page"`.

**JS-less `<details>` 패턴**:

기본 `<details>`는 collapsed일 때 `<summary>`가 아닌 모든 자식을 숨긴다. v0.3는 폴더명 링크가 **항상** 보이도록 cascade를 덮어써 *children `<ul>`만* 토글되게 한다.

```css
/* tokens.css 또는 theme-default base.css — step 2 책임 */
.folder-tree details > a.folder-name { display: inline-block; }
.folder-tree details > ul             { display: none; }
.folder-tree details[open] > ul       { display: block; }
.folder-tree details > summary .chevron { transition: transform var(--duration-base) var(--ease-out); }
.folder-tree details[open] > summary .chevron { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) {
  .folder-tree details > summary .chevron { transition: none; }
}
```

`<summary>`는 chevron(`▸` 글리프, `aria-hidden`)만 담는다 — 클릭 시 disclosure 토글. 폴더명 링크는 sibling이며 폴더가 열렸든 닫혔든 항상 보인다. **JS는 0줄**.

**ARIA 정책**:

- 컨테이너: `<nav aria-label="Folder tree">` + 중첩 `<ul>`.
- active row: `aria-current="page"` *only* — `data-active` 같은 커스텀 속성 금지.
- **`role="tree"` / `role="treeitem"` 미사용 + 키보드 화살표 핸들러 없음.** *이유*: WAI-ARIA tree-widget 계약은 화살표 키 내비, type-ahead, level announcement, roving tabindex을 모두 구현해야 하며, 그러려면 JS를 한 컴포넌트에 ~200줄 들여놓아야 한다. 콘텐츠 사이트에는 과한 비용 — Tab/Enter/Space만으로도 `<a>` traversal과 `<summary>` 토글이 모두 커버된다. tree role을 *부분만* 선언하면 보조기술이 사용자에게 "여기 화살표 내비가 있을 것"이라고 약속해 놓고 실제로는 깨뜨리는 결과 — 정직하게 일반 `<nav>`로 둔다.

**Markup (요약)**:

```html
<nav class="folder-tree px-5 py-4" aria-label="Folder tree">
  <ul class="flex flex-col gap-1">
    {/* 폴더 노드 */}
    <li>
      <details open={node.isCurrent || node.containsCurrent}>
        <summary class="inline-flex items-center justify-center w-5 h-5
                        cursor-pointer rounded-sm
                        text-faded hover:text-body hover:bg-surface-strong
                        focus-visible:outline focus-visible:outline-2
                        focus-visible:outline-accent">
          <span class="chevron" aria-hidden="true">▸</span>
          <span class="sr-only">{node.name} 폴더 펼치기/접기</span>
        </summary>
        {node.depth === 0 && node.categorySlot && (
          <span class="folder-dot inline-block w-1.5 h-1.5 rounded-full mx-1.5"
                style={`background-color: var(--color-accent-cat-${node.categorySlot})`}
                aria-hidden="true" />
        )}
        <a href={node.href} class="folder-name font-sans text-body text-body
                                   hover:text-link rounded-md px-1.5 py-0.5
                                   aria-[current=page]:bg-accent-2-soft
                                   aria-[current=page]:text-accent-2"
           aria-current={node.href === currentPath ? 'page' : undefined}>
          {node.name}
        </a>
        <ul class="ml-3 mt-1 flex flex-col gap-1 border-l border-default pl-3">
          {/* recurse */}
        </ul>
      </details>
    </li>
    {/* 노트 leaf */}
    <li class="ml-5 flex items-baseline gap-2 font-sans text-body">
      <span class="font-mono text-meta text-faded" aria-hidden="true">─</span>
      <a href={node.href} class="hover:text-link
                                 aria-[current=page]:text-accent-2
                                 aria-[current=page]:font-medium"
         aria-current={node.href === currentPath ? 'page' : undefined}>
        {node.name}
      </a>
    </li>
  </ul>
</nav>
```

**카테고리 액센트 적용**:

- **Depth 0만** 6×6px 점 — 슬롯은 `--color-accent-cat-1..5` 중 하나로 결정론적 해시(step 3 책임).
- **Depth ≥ 1**: 점 없음. 하위 폴더는 부모의 카테고리를 indent rail(`border-l border-default`)로 암묵적으로 상속.
- 점 색은 *인라인* `style="background-color: var(--color-accent-cat-N)"`로만 — 클래스명에 슬롯을 인코딩하지 않는다(per-슬롯 surface 합성 차단).

**States**:

- default: chevron `▸`, 폴더명 `--color-text-body`.
- hover (chevron): `bg-surface-strong`. hover (폴더명): 텍스트 `--color-text-link`.
- focus: `--color-focus-ring` outline.
- expanded(`[open]`): chevron 90° 회전 → `▾`, children `<ul>` 표시.
- active(`aria-current="page"`): 폴더명 링크에 `bg-accent-2-soft` + `text-accent-2`. iron-oxide 영역과 분리되어 "you are here"가 *identity*로 읽힌다.
- empty children: children `<ul>` 자체를 미렌더, chevron `pointer-events: none` + `opacity: 0.4`.

**Privacy 계약(컴포넌트 내)**:

- 트리 입력은 *이미* `packages/core/src/privacy/`에서 필터링됨(Phase C). 컴포넌트는 받은 그대로 렌더하며 자체 필터링 없음.
- private 노트만 있는 폴더 → 입력에서 제외 → 미렌더 → "빈 폴더 누설" 0회.
- public/private 혼합 폴더 → public children만 렌더. chevron은 정상 인터랙티브 — "여기 더(private) 있다"는 시각 신호 없음.

**Mobile (`< 640px`)**: 동일 구조, tap target은 padding으로 ≥ 44×44 logical px 유지.

### 7-5. `FolderIndex` *(v0.3 새 절)*

**목적**: `/<folder>/` URL에서 렌더되는 페이지(충돌 규칙은 step 6 책임 — 본 절은 폴더 라우트가 닿을 수 있다는 가정). breadcrumb + child folders + child notes.

**Props**:

- `breadcrumb: Array<{ label, href }>` — root → current. 첫 항목은 home(`{ label: 'home', href: '/' }`). 마지막 항목은 현재 폴더.
- `categorySlot?: 1..5` — 첫 breadcrumb 세그먼트의 슬롯(트리의 depth-0 점과 동일하게 미러).
- `childFolders: Array<{ name, href, noteCount }>` — public 자식 폴더.
- `childNotes: Array<{ title, href, date? }>` — public 자식 노트.

**Markup (요약)**:

```html
<article class="mx-auto max-w-[var(--measure-prose)]">
  <nav class="font-mono text-meta uppercase tracking-wider text-muted
              flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="breadcrumb">
    {breadcrumb.map((seg, i) => (
      <>
        {i === 0 && categorySlot && (
          <span class="folder-dot w-1.5 h-1.5 rounded-full"
                style={`background-color: var(--color-accent-cat-${categorySlot})`}
                aria-hidden="true" />
        )}
        {i < breadcrumb.length - 1 ? (
          <a href={seg.href} class="hover:text-link">{seg.label}</a>
        ) : (
          <span class="text-link" aria-current="page">{seg.label}</span>
        )}
        {i < breadcrumb.length - 1 && <span class="text-faded">/</span>}
      </>
    ))}
  </nav>

  <h1 class="mt-4 font-serif text-h1 text-heading">
    {breadcrumb[breadcrumb.length - 1].label}
  </h1>

  {/* ▸ folders / ▸ notes 섹션, 각각 hairline-bordered row 리스트 */}

  {childFolders.length === 0 && childNotes.length === 0 && (
    <p class="mt-7 text-muted">이 폴더에는 공개된 글이 없습니다.</p>
  )}
</article>
```

- 자식 폴더가 자식 노트 위에 먼저 나오며, 두 섹션은 `▸ folders` / `▸ notes` mono 헤딩으로 구분된다.
- 각 row는 hairline-bordered(공통 `border-y border-default divide-y divide-default`) — 카드가 아니라 row.
- breadcrumb 첫 세그먼트만 카테고리 점을 carry. 마지막 세그먼트는 `text-link` + `aria-current="page"`.
- 공개 자식 0개일 때 fallback `<p>`는 "이 폴더에는 공개된 글이 없습니다." — 폴더가 과거에 private 노트를 담았는지 여부를 노출하지 *않는* 카피.

**Mobile (`< 640px`)**: breadcrumb wrap, row hover의 tap padding 보강, row layout `flex items-baseline gap-4` + flex-wrap으로 날짜가 타이틀 아래로 떨어진다.

### 7-6. `Note` — 본문 article *(v0.2 그대로)*

```html
<article class="prose mx-auto max-w-[var(--measure-prose)]">
  <header class="mb-7 not-prose">
    <h1 class="font-serif text-h1 text-heading">{title}</h1>
    <div class="mt-3 font-mono text-meta uppercase tracking-wider text-muted
                flex flex-wrap gap-x-4 gap-y-1">
      <time datetime="{date}">{date}</time>
      {updated && <span>updated {updated}</span>}
      {tags.map(t => <a href="/tags/{t}/">#{t}</a>)}
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
- `<pre>`: `relative font-mono text-code bg-code rounded-lg p-4 overflow-x-auto` + 우상단 mono 언어 칩.
- `<blockquote>`: `border-l-[3px] border-strong pl-5 my-6 italic text-muted`.
- `<figure>` / `<img>`: `<img>`는 `rounded-lg w-full`, `<figcaption class="mt-2 text-small text-muted text-center font-sans">{alt}</figcaption>`. alt 누락 시 빌드 경고 + `<p class="text-small text-warn">[이미지 설명 누락]</p>`.
- **Embed aside** (transcluded `![[Note]]`): `<aside class="my-7 border-l-[3px] border-strong bg-surface rounded-lg p-5">{body}</aside>`.
- 모바일(`< 640px`): 측정폭 `min(100%, 65ch)`, `h1` → `text-[1.75rem]`, 코드 블록 가로 스크롤.

### 7-7. 메타 행 (`Note` 안) *(v0.2 그대로)*

- 날짜 / updated / 태그가 `h1` 바로 아래 단일 mono 행에 `gap-x-4`로 배치.
- `lg+`에서 우측 마진 미러는 향후 step에서 도입 예정(현재는 인라인 행만 표시 — `Sidebar`가 좌측을 점유).
- 메타 행 안의 태그 링크는 본문 링크 스타일 상속 + `#` 접두.

### 7-8. 헤딩 앵커 (`#`) *(v0.2 그대로)*

- 모든 헤딩에 안정적 `id`(텍스트의 kebab-case slug) 부여.
- 형제 `<a class="heading-anchor" href="#{id}" aria-label="이 섹션 링크 복사">#</a>`:
  - `lg+`: 헤딩 텍스트 바로 앞 inline-end 위치, `font-mono text-meta text-faded -ml-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-base`.
  - `< lg`: 헤딩 텍스트 뒤 inline-end, 동일 호버.
- 약 30줄 vanilla-JS 클릭 핸들러를 `BaseLayout`에서 한 번 로드: 클립보드 복사 + 1.5s "copied" 인라인. `prefers-reduced-motion: reduce` 시 즉시.
- 모바일(`< 640px`): 호버 없으므로 앵커 항상 표시. 탭으로 복사.

### 7-9. `Backlinks` *(v0.2 그대로)*

```html
<aside class="mt-12 pt-6 border-t border-default" aria-label="백링크">
  <h2 class="font-mono text-meta uppercase tracking-wider text-muted">
    referenced by · 이 노트를 참조하는 노트
  </h2>
  <ul class="mt-3 space-y-1">
    {entries.map(e =>
      <li class="font-sans text-body">
        <span class="font-mono text-meta text-faded mr-2">→</span>
        <a href="/{e.slug}/">{e.title}</a>
      </li>
    )}
  </ul>
</aside>
```

- article 본문 아래·푸터 위에 위치.
- **빈 상태에서는 아무것도 렌더하지 않음** (privacy: 비어있는 "Backlinks" 헤딩은 "여기 private 노트가 있을 수 있다"는 신호가 됨).

### 7-10. `TagList` (인덱스 페이지) *(v0.2 그대로)*

```html
<section class="space-y-5">
  <h1 class="font-serif text-h1 text-heading">tags</h1>
  <ul class="flex flex-wrap gap-2">
    {tags.map(t =>
      <li>
        <a href="/tags/{t.tag}/"
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

### 7-11. `TagPage` *(v0.2 그대로)*

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
          <a href="/{e.slug}/">{e.title}</a>
        </li>
      )}
    </ul>
  ) : (
    <p class="text-muted">이 태그를 가진 공개 노트가 없습니다.</p>
  )}
</section>
```

### 7-12. `Graph` *(v0.2 그대로)*

- 정적 SVG, 노드 `<circle fill="currentColor" class="text-heading hover:text-link">`, 엣지 `<line stroke="currentColor" class="text-faded">`.
- 빈 상태: `<p class="text-muted">아직 공개된 글이 없습니다.</p>`.
- Privacy: private 노드는 데이터 레이어(Phase C)에서 이미 제거.

### 7-13. `RecentRail` *(v0.3 새 절)*

**목적**: 홈 페이지 첫 레일 — 가장 최근 공개 노트 N개, `date` desc 정렬.

**Props**:

- `entries: Array<{ title, href, date, categorySlot?: 1..5 }>` — `selectRecent(n)`(step 7, `packages/core`)이 이미 필터+정렬한 결과.
- `limit: number` — 기본 **10**.
- `seeAllHref?: string` — "all notes" 링크. 없으면 trailing affordance 미렌더.

**Markup (요약)**:

```html
<section class="mt-7" aria-labelledby="recent-heading">
  <h2 id="recent-heading"
      class="font-mono text-meta uppercase tracking-wider text-muted">
    ▸ recent
  </h2>
  <ul class="mt-3 border-y border-default divide-y divide-default">
    {entries.slice(0, limit).map(e => (
      <li>
        <a href={e.href}
           class="flex items-baseline gap-3 py-3 px-3 -mx-3 rounded-md
                  hover:bg-surface-strong">
          {e.categorySlot && (
            <span class="folder-dot w-1.5 h-1.5 rounded-full shrink-0 self-center"
                  style={`background-color: var(--color-accent-cat-${e.categorySlot})`}
                  aria-hidden="true" />
          )}
          <time class="font-mono text-meta uppercase tracking-wider text-faded shrink-0"
                datetime={e.date}>{e.date}</time>
          <span class="font-sans text-body">{e.title}</span>
        </a>
      </li>
    ))}
  </ul>
  {seeAllHref && (
    <p class="mt-3 font-mono text-meta uppercase tracking-wider">
      <a href={seeAllHref} class="text-link hover:text-link-hover">→ all notes</a>
    </p>
  )}
</section>
```

- **빈 상태(`entries.length === 0`)**: 레일은 그대로 렌더하되 fallback `<p class="text-muted">아직 공개된 글이 없습니다.</p>`. RecentRail은 `FeaturedRail`과 달리 빈 상태를 인정해도 무방 — 새 vault에서 공개 노트가 없는 건 누설이 아니라 사실이다.

### 7-14. `FeaturedRail` *(v0.3 새 절)*

**목적**: 홈 페이지 두 번째 레일 — 저자가 큐레이션한 featured 노트.

**입력 정의**: `frontmatter.featured: true`인 공개 노트만 포함. `selectFeatured(n)`(step 7, `packages/core`)이 이미 필터+정렬한 결과를 받는다. `featured`는 v0.2 frontmatter allowlist에 이미 포함되어 있으며, v0.3는 추가 필드를 도입하지 않는다(allowlist 확장 금지).

**Props**:

- `entries: Array<{ title, href, date?, categorySlot?: 1..5 }>` — 이미 필터+정렬됨.
- `limit: number` — 기본 **6**.

**핵심 정책 — empty 미렌더**: `entries.length === 0`이면 **섹션 자체를 렌더하지 않는다**. 헤딩도, fallback도, 디바이더도 출력하지 않는다. 비어 있는 "Featured" 헤딩은 *"여기 featured 노트가 있었는데 비공개로 바뀌었다"*는 privacy-adjacent 누설 신호이며, 이는 v0.2 `Backlinks` 빈-상태 정책과 동일한 결로 거부한다.

**Markup (요약)**:

```html
{entries.length > 0 && (
  <section class="mt-9 pt-7 border-t border-default" aria-labelledby="featured-heading">
    <h2 id="featured-heading"
        class="font-mono text-meta uppercase tracking-wider text-accent-2">
      ▸ featured
    </h2>
    <ul class="mt-3 border-y border-default divide-y divide-default">
      {entries.slice(0, limit).map(e => (
        <li>
          <a href={e.href}
             class="flex items-baseline gap-3 py-3 px-3 -mx-3 rounded-md
                    hover:bg-surface-strong">
            {e.categorySlot && (
              <span class="folder-dot w-1.5 h-1.5 rounded-full shrink-0 self-center"
                    style={`background-color: var(--color-accent-cat-${e.categorySlot})`}
                    aria-hidden="true" />
            )}
            {e.date && (
              <time class="font-mono text-meta uppercase tracking-wider text-faded shrink-0"
                    datetime={e.date}>{e.date}</time>
            )}
            <span class="font-sans text-body">{e.title}</span>
          </a>
        </li>
      ))}
    </ul>
  </section>
)}
```

- 섹션 헤딩 `▸ featured`만 `--color-accent-2`(forest-moss) — 홈 페이지에서 보조 액센트가 등장하는 *유일한* 위치이며, 이것이 강한 surface 처리 없이 "featured"를 신호한다.
- per-row 카테고리 점은 `RecentRail`과 동일 슬롯 매핑 사용 — 동일 폴더가 모든 표면에서 동일 색으로 읽힌다.

### Cross-component 불변식 (요약)

1. **JS 추가 0줄.** v0.2 테마 토글 sync script 외에 새 JS 없음. `FolderTree`, 사이드바 드로어, rail 모두 `<details>` 또는 정적 리스트.
2. **Privacy-filtered 데이터만 입력.** 모든 컴포넌트는 `packages/core/src/privacy/`에서 이미 걸러진 입력만 받는다. 컴포넌트는 자체 필터링하지 않는다.
3. **`aria-current="page"`** 가 유일한 active-state 메커니즘. 커스텀 데이터 속성 금지.
4. **카테고리 액센트가 닿는 곳**: depth-0 폴더 점, FolderIndex 첫-breadcrumb 점, RecentRail row 점, FeaturedRail row 점 — *그 외 어디에도 안 됨*.
5. **보조 액센트 `--color-accent-2`가 닿는 곳**: AvatarBlock 닉네임 보조 라인(선택), FeaturedRail 헤딩, FolderTree current-folder row text + soft bg — *그 외 어디에도 안 됨*.
6. **iron-oxide `--color-accent`가 그대로 소유**: 본문 prose 링크, `text-link` 클래스 어디서나, 포커스 링, 헤딩 앵커 `#`, breadcrumb 마지막(현재) 세그먼트.

## 8. 다크 모드 *(v0.2와 동일)*

### 8-1. 토글 정책

- 첫 방문: `prefers-color-scheme`을 따른다.
- 사용자 토글: `BaseLayout` 헤더의 `#theme-toggle` 버튼(28×28 hit area).
- 영속화: `localStorage.theme = "light" | "dark"`. `<html data-theme>`로 적용.
- `prefers-reduced-motion: reduce` 시 토글 아이콘 트랜지션 0ms.

### 8-2. FOUC 방지

- `<head>` 안에 동기 inline script *1개* 허용: `localStorage.theme`을 읽어 `<html>`에 `data-theme`을 즉시 주입. v0.2에 도입된 **유일한** 동기 head script — v0.3는 추가 script 없음.

### 8-3. 토큰의 이중 모드 동작

- 4절의 모든 색 토큰은 `:root`에 라이트 값, `[data-theme="dark"]`에 다크 값. 컴포넌트는 **항상 토큰만 참조** — 컴포넌트 안 라이트/다크 분기 CSS 금지.
- `--color-bg-sidebar`, `--color-accent-2`, `--color-accent-cat-1..5` 모두 동일한 정책으로 양쪽 모드에 정의.

## 9. 모션 *(v0.2와 동일)*

| 토큰 | 값 | 용도 |
|---|---|---|
| `--duration-fast` | 100ms | 링크 underline 두께 |
| `--duration-base` | 150ms | 링크 색, 버튼 bg, 토글 아이콘, **폴더 chevron 회전** |
| `--duration-menu` | 200ms | 모바일 메뉴 슬라이드, **사이드바 드로어 슬라이드** |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | 감속, 기본 ease |
| `--ease-linear` | `linear` | 색만 트랜지션 |

- 허용: 위 표의 트랜지션, 사이드바 드로어 슬라이드, 폴더 chevron 회전, 헤딩 앵커 호버 페이드, 토글 아이콘 회전.
- 금지: 페이지 전환 fade-in/slide-up, scroll-reveal, 패럴랙스, 카드 lift on hover, 자동 캐러셀, **폴더 펼침의 height-animate**(layout shift 비용이 무거우며 v0.3 정책에 어긋남).
- `--duration-slow` / spring 토큰은 의도적으로 미제공.
- **`prefers-reduced-motion: reduce` 의무 지원**: `base.css`에서 위 모든 duration을 0으로 덮어쓴다. v0.3 새 컴포넌트도 동일하게 준수.

## 10. 아이콘 *(v0.2와 동일)*

- SVG 인라인, `stroke-width: 1.5`, `currentColor` fill/stroke.
- 둥근 배경 박스로 감싸지 **않는다**.
- 출처: **Lucide icons** 또는 **Heroicons outline** 중 한 종을 프로젝트 단위로 선택. **둘을 혼용하지 않는다**.
- 장식 아이콘 금지. UI 어포던스가 명시될 때만(테마 토글, 외부 링크 ↗ 등). v0.3의 폴더 chevron(`▸`)·rail 화살표(`▸`)·breadcrumb 점은 SVG가 아니라 글리프/`<span>` — 아이콘 시스템 안에 있지 않다.

## 11. 접근성 *(v0.2와 동일)*

- 모든 인터랙티브 요소는 키보드 포커스 outline 유지(제거 금지). `--color-focus-ring`을 사용해 라이트/다크 양쪽에서 보이도록.
- semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<figure>`, `<time>`, `<details>`, `<summary>`. div/span으로 의미 깔지 않기.
- 이미지 `alt` 의무. 누락 시 빌드 경고 + 본문에 `[이미지 설명 누락]` 안내.
- 색상 대비: WCAG AA(본문 텍스트/배경 4.5:1 이상). 4-2의 모든 body 토큰이 양쪽 모드에서 통과. `--color-text-faded`는 body 금지. v0.3 새 액센트 토큰들도 4-4-2/4-4-3 표대로 AA 통과.
- `sr-only` 사용처: "외부 링크", "비공개 링크 자리"(strip-to-text 보강), "다음 섹션 링크 복사"(헤딩 앵커), "테마 전환"(토글 라벨), **"폴더 펼치기/접기"(`FolderTree` chevron `<summary>`)**.
- 키보드 단축키나 마우스 전용 인터랙션 도입 시 동등한 키보드 경로 보장. `FolderTree`는 Tab 이동 + Enter/Space의 표준 `<details>` 키보드 모델만 약속한다(7-4 ARIA 정책 참조).

## 12. URL 포맷과 트레일링 슬래시 정책 *(v0.3 갱신 — 새 절)*

### 12-1. trailingSlash 정책

- **`astro.config.mjs`에서 `trailingSlash: 'always'`**. 모든 내부 경로는 trailing slash로 끝난다.
- 노트 URL: `/projects/foo/`.
- 폴더 인덱스 URL: `/AI/Claude/`.
- 태그 URL: `/tags/typescript/`.

**채택 이유**: v0.3가 폴더 인덱스 URL(`/AI/Claude/`)을 도입하면서 *"슬러그 끝 슬래시 유무"가 더 이상 vacuous한 선택*이 아니게 됐다. 노트 URL과 폴더 URL의 슬래시 정책이 서로 다르면 — 예를 들어 노트는 `/AI/Claude/foo`, 폴더는 `/AI/Claude/` — 두 라우트가 동일 prefix를 공유할 때 매칭 우선순위·canonical/og·`_headers` 매처가 모두 갈라진다. 한 규칙으로 통일하면 충돌 면이 닫힌다. 충돌이 *발생하더라도* silent override가 아니라 빌드 타임 throw로 처리한다(ADR-012).

### 12-2. URL 포맷 일반

- 내부 링크: `href="/projects/foo/"` (상대 경로, **trailing slash 있음**).
- 외부 링크: `target="_blank" rel="noopener noreferrer"` + 작은 ↗ 아이콘(선택).

### 12-3. 마이그레이션 노트

- v0.2 빌드의 `_headers` / `_redirects` / canonical / og:url / alias `<meta http-equiv="refresh">` 매처가 모두 새 슬래시 정책을 따른다 — step 6에서 일괄 갱신. step 8 audit이 dist에서 모든 내부 URL이 trailing slash를 갖는지 검증한다.

## 13. 404 페이지 *(v0.2와 동일)*

- 카피(고정): "페이지를 찾을 수 없습니다" / "요청하신 페이지가 존재하지 않거나, 더 이상 공개되지 않습니다." / `→ home`.
- **private 노트의 존재를 누설하지 않는 문구** — "삭제됨" / "이전에 있었으나" 등 표현 금지. 노트가 비공개로 전환된 경우와 애초에 없었던 경우를 시각적으로 구분하지 않는다.
- 시각: `lg+`에서 큰 mono "404"는 본문 컬럼 우측 마진 또는 상단 stack(`text-[5rem] text-faded`), 본문은 `font-serif text-h1 text-heading`. 모바일에서는 stack(`text-[3.5rem]`).

## 14. Privacy 시각 계약 (절대 우회 금지)

이 절은 시각 디자인 변경이 privacy 계약을 *시각 레이어에서* 우회하는 것을 막기 위한 가이드다. 데이터 레이어의 처리는 `docs/PRD.md` / `docs/ARCHITECTURE.md`(Phase C)에 정의되어 있고, 본 가이드는 그것이 시각으로 새지 않도록 보강한다.

1. **Private wikilink는 `<a>` 없는 strip-to-text** — public 노트에서 private을 가리키는 `[[Private]]`는 plain text로만 남는다. 시각 레이어에서 placeholder("[비공개 링크]"), 회색 박스, hover tooltip, badge 같은 *어떤 표시도* 금지. private이 거기 있다는 신호 자체를 만들지 않는다.
2. **Private embed(`![[Private]]`)는 AST에서 제거 — 빈 자리도 표시 금지** — embed가 사라진 자리에 "[비공개 임베드]" 박스, 점선 테두리, "재방문 시 공개될 수 있음" 같은 카피 모두 금지. 그냥 흐름이 자연스럽게 이어져야 한다.
3. **Allowlist 외 frontmatter는 meta/og에 노출 금지** — 본 가이드의 어떤 `<meta>`/`<og:*>` 슬롯에도 allowlist(`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`) 외 필드를 채우지 않는다. "보기 좋게" 추가 메타를 노출하는 디자인 수정 금지.
4. **그래프/백링크는 filtered 데이터만 받는다** — `Graph`/`Backlinks` 컴포넌트는 입력으로 받은 노드/엣지 셋을 그대로 그릴 뿐, 스스로 필터링하거나 추가 데이터(예: total count, "n more" 따위)로 보완하지 않는다. 빈 상태는 7-9의 정책대로 — 비어 있을 땐 *섹션 자체가 없다*.
5. **검색/리스팅에서 private 슬러그·제목 0회** — 향후 v0.2+에서 검색 UI/sitemap을 도입하더라도, UI가 받는 데이터는 public-only filtered 셋이어야 하며, "private이 있긴 하다"는 시각 신호(잠긴 자물쇠 아이콘 등)를 도입하지 않는다.
6. **시각 누출 회귀는 audit이 잡는다** — `pnpm obpub audit`가 dist에서 private 제목/첨부/`%%comment%%`/allowlist 외 필드를 0회 검증. 시각 변경 시 audit이 통과해야 머지 가능.
7. **폴더 트리·breadcrumb·rail은 데이터 레이어 필터링 결과만 그린다** *(v0.3 새 항목)* — `FolderTree`는 `packages/core/src/privacy/`에서 이미 걸러진 트리만 받는다. private 노트만 담은 폴더는 입력 트리에 부재하므로 시각이 자연 부재로 표현한다(빈 children `<ul>` 자체가 미렌더). 카테고리 슬롯은 *공개 구조*에만 사용되며 "private 슬롯"은 토큰에도 컴포넌트에도 존재하지 않는다(§3 v0.3 chromatic 한계선의 "private 상태 색-코딩 금지"). 자물쇠 아이콘·회색 tint·"이 폴더에 더 있음" 같은 신호 모두 금지. `FeaturedRail`은 빈 상태에서 섹션 자체를 미렌더(7-14) — 비어 있는 "Featured" 헤딩이 누설 신호가 되기 때문.

---

## v0.2 → v0.3에서 무엇이 바뀌었나

- **단일 컬럼 레이아웃 → 좌측 영구 사이드바(16rem)** — 모든 라우트에 `Sidebar`가 동일하게 노출. `lg+`는 stripe, `< lg`는 `<details>` 드로어. 새 JS 0줄.
- **아이덴티티 슬롯 도입(`AvatarBlock`)** — 사이드바 최상단에 아바타+닉네임. `obpubConfig.site.{avatar, nickname}` 둘 다 비어있지 않을 때만 렌더(privacy-adjacent: placeholder 금지). `site.avatar`는 외부 호스트 거부(`http`/`https`/`//`/`data:` 차단).
- **JS-less 폴더 트리(`FolderTree`)** — `<details>` 기반. 폴더명 링크는 항상 보이고 children `<ul>`만 토글. ARIA는 `<nav aria-label="Folder tree">` + `aria-current="page"` only — `role="tree"` 미사용(키보드 화살표 핸들러 없이 정직한 `<nav>`).
- **폴더 인덱스 페이지(`FolderIndex`)** — `/<folder>/` URL. breadcrumb + child folders + child notes. 빈 폴더 카피는 private 누설 안 되는 vague form.
- **홈 두 레일(`RecentRail` + `FeaturedRail`)** — 평탄 연대기 → Recent(`n=10`) + Featured(`n=6`). Recent는 빈 상태 인정, Featured는 *empty-section 미렌더*(privacy-adjacent).
- **chromatic 확장** — 보조 액센트 `--color-accent-2`(forest moss `#4d6948` / `#9ec19a`) + 카테고리 슬롯 `--color-accent-cat-1..5`(iron oxide / ochre / moss / bronze / slate, 모두 warm earth tone) + `--color-bg-sidebar` 1단계 surface tier.
- **트레일링 슬래시 정책 — `trailingSlash: 'always'`** — 폴더 인덱스 URL과 노트 URL의 슬래시 정책 통일. 슬러그 충돌 시 빌드 타임 throw(ADR-012, `apps/blog/src/pages/[...slug].astro:39` 패턴).
- **v0.2 좌측 사이드 마진 컬럼은 사이드바로 흡수** — `--margin-col-w` 토큰은 향후 우측 사용을 위해 보존, 현재 노트 페이지에서는 미사용.
- **금지선은 그대로** — 7개 v0.1 안티패턴, v0.2 5개 모티프 한계선, privacy 시각 계약 6항목 전부 verbatim 유지. v0.3 새 chromatic 시스템도 §3 한계선 표로 잠겨 있다.
