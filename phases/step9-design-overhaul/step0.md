# Step 0: design-direction

v0.2 비주얼 방향을 확정하는 **설계 전용** step. 코드는 한 줄도 바꾸지 않는다. 산출물은 phase 디렉토리(`phases/step9-design-overhaul/design/`)에만 보존한다. 이후 모든 step(1~6)은 이 산출물을 단일 진실 공급원(SSOT)으로 삼는다.

## 배경 — 왜 v0.2인가

v0.1 UI는 의도적으로 미니멀("읽기 우선 · 장식 없음 · SaaS 클리셰 금지")이었으나, 도그푸드 결과 사용자가 **distinctive · production-grade** 방향으로 전환하기로 결정했다. 단, 다음 계약은 v0.1과 동일하게 유지한다:

- **privacy**: frontmatter allowlist, `private/**` tripwire, public/private wikilink·transclusion 분기 — 시각 디자인은 이 결정 로직을 절대 우회하지 않는다.
- **접근성**: `prefers-reduced-motion` 존중, 모든 인터랙티브 요소의 keyboard focus outline, 본문 텍스트 WCAG AA 4.5:1.
- **정적 출력**: SSG로 빌드된 정적 HTML/CSS만. 런타임 JS는 모바일 메뉴·테마 토글·heading anchor 정도로 최소.

## 읽어야 할 파일

먼저 다음을 읽고 현재 상태와 제약을 정확히 파악하라:

- `docs/UI_GUIDE.md` — v0.1 톤·안티패턴·토큰. **삭제하지 않는다**(step 1에서 백업 후 재작성).
- `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md` — privacy/threat model, 디렉토리 규칙, 정적 출력 제약.
- `packages/theme-default/src/styles/tokens.css`, `packages/theme-default/src/styles/base.css` — 현행 토큰/베이스.
- `packages/theme-default/src/layouts/BaseLayout.astro`, `packages/theme-default/src/components/Note.astro` — 메인 레이아웃·노트 본문 컴포넌트.
- `packages/theme-default/src/components/{Backlinks,TagList,TagPage,Graph,NotFound}.astro` — 보조 컴포넌트.
- `apps/blog/src/pages/{index,[...slug],graph}.astro`, `apps/blog/src/pages/tags/` — 페이지 진입점.
- `README.md` (도그푸드 스크린샷 위치 확인 — `docs/screenshots/dogfood.png`).

## 작업

### 0-1. frontend-design 스킬 호출 (필수)

이 step에서 가장 먼저 할 일은 `affaan-m-everything-claude-code-frontend-design` 스킬을 Skill 도구로 호출하는 것이다. 호출 시 다음을 명시적으로 전달하라:

- 프로젝트 정체성: "Obsidian vault에서 `public: true` 노트만 발행하는 privacy-first 정적 블로그 SSG. 사용자 본인의 dogfood 사이트 + 오픈소스 테마(`@noteforge/theme-default`)."
- 톤 전환: v0.1의 "장식 없음 · SaaS 클리셰 금지" → v0.2의 "**distinctive · production-grade**" 비주얼. 단 학술 논문/노트북/위키 메타포는 유지(SaaS 랜딩 페이지 메타포로 가지 않는다).
- 비유지 제약: glass morphism(`backdrop-filter: blur()`), gradient-text, 보라/인디고 단일 톤, 모든 카드에 균일한 `rounded-2xl`, 배경 gradient orb — 이런 v0.1 안티패턴 중 어떤 것을 완화하고 어떤 것을 그대로 금지로 둘지 항목별로 결정한다.
- 라이트/다크 동시 설계 — 두 모드 모두 distinctive해야 하며, 단순한 색 반전이 아닌 의도적인 다크 팔레트.
- 컴포넌트 범위: `BaseLayout`(nav/footer/mobile menu), `Note`(prose/heading anchor/code block/blockquote/image/embed aside), `Backlinks`, `TagList`/`TagPage`, `Graph`(정적 SVG), `NotFound`(404).

스킬 호출 결과(무드보드, 토큰 시안, 컴포넌트 시안)를 그대로 phase 디렉토리에 저장하지 말고, 아래 형식의 **재작성된 명세 문서 4종**으로 정리해 보존한다.

### 0-2. 산출물 4종 작성

다음 4개 파일을 `phases/step9-design-overhaul/design/`에 작성하라(디렉토리 신규 생성).

#### `design/MOODBOARD.md`
- 디자인 방향 한 단락 요약(2~3문장). "노트북·논문·위키" 메타포 위에 "distinctive·production-grade"를 어떻게 얹는지.
- 참조 사이트/제품 3~6개. 각 항목에 어떤 요소를 가져오고(typography, layout, accent, motion) 어떤 요소는 가져오지 않는지 한 줄 코멘트.
- 핵심 비주얼 모티프 1~2개(예: "monospace accent + 한정된 chromatic accent", "wide measure + 좁은 sidemargin notation" 같은 식의 결정).

#### `design/TOKENS.md`
라이트/다크 두 모드의 모든 토큰을 표로 명세한다. 이후 step 2에서 그대로 CSS 변수로 전사된다.

표는 다음 컬럼: `토큰 이름`(예: `--color-bg-page`), `라이트 값`, `다크 값`, `용도/근거`.

다음 카테고리를 **모두** 포함하라:

- **색상 — 배경**: 페이지, 표면(카드/aside), 코드 블록 배경, 강조(hover)
- **색상 — 텍스트**: 본문, 제목, 보조, 비활성/메타, 링크, 링크 hover, 인라인 코드
- **색상 — 시맨틱**: success/warn/error, border 기본/강조, focus ring
- **색상 — 액센트**: brand accent 1~2개(v0.1의 `blue-600` 단일 → v0.2의 distinctive accent. 보라/인디고 단일은 금지)
- **타이포그래피**: 본문 font stack, 제목 font stack, 모노 font stack(웹폰트 사용 시 self-host 정책 — 외부 CDN 금지, privacy 누출 방지)
- **타입 스케일**: h1~h4, 본문, small, code의 size/weight/line-height/letter-spacing
- **spacing scale**: 4 또는 8 베이스, 컴포넌트 간격에서 사용할 키들(예: `--space-1` ~ `--space-12`)
- **radius scale**: 적어도 `sm`, `md`, `lg`. 모든 카드에 동일한 radius를 쓰지 않는다는 원칙을 어떻게 변수화할지 결정.
- **그림자/엘리베이션**: 사용한다면 1~2개로 제한하고 사용처를 명시. v0.1은 그림자 0개였다.
- **motion duration/ease**: 허용 motion(예: 링크 색상 전환 150ms, 모바일 메뉴 200ms)과 금지 motion(스크롤 reveal, fade-in landing)을 토큰 수준으로 명시.

각 토큰의 라이트/다크 대비는 본문 텍스트 기준 WCAG AA(4.5:1)를 만족해야 한다. 만족하지 않으면 그 자리에서 값을 조정하고, 검증 방식(예: `colorjs.io` 계산 결과)을 비고에 적어라.

#### `design/COMPONENTS.md`
컴포넌트별 시안을 다음 형식으로 명세한다(각 항목당 1~2 단락 + 마크업/클래스 스케치):

- `BaseLayout` — 헤더(브랜드 마크 위치/크기, nav 항목, 데스크톱/모바일 분기, 테마 토글 위치), 메인 컨테이너 폭(본문 측정폭 65~72ch 권장), 푸터(저작권/출처 링크).
- `Note` 본문 — h1~h4 시각 위계, 본문 prose 폭, 인라인 링크 스타일(밑줄 처리), 코드 블록(언어 라벨, 다크모드 대비), `blockquote`, 인라인 코드 chip, 이미지(반응형 컨테이너, alt 폴백 시 안내), embed aside(임베드 wikilink로 들어온 public 노트 본문 표시 영역 — 좌측 리본/색상).
- `Note` 메타 — 발행일/수정일/태그 칩/카테고리(있다면) 위치.
- heading anchor — h2~h4에 호버 시 `#` 표시, 클릭 시 fragment 복사. 정적 출력만 — JS는 클립보드 복사용 최소 코드.
- `Backlinks` — 노트 하단 또는 사이드(결정 명시), private 링크 누설 0(이미 데이터에서 필터됨).
- `TagList` / `TagPage` — 태그 칩 디자인, 인덱스 페이지 그리드.
- `Graph` — 정적 SVG, 노드 색상이 토큰을 사용해야 하며 라이트/다크 모두에서 가독성 유지. private 노드는 데이터 단계에서 이미 제거되어 있음(시각 단계 책임 0).
- `NotFound` (404) — "해당 노트가 없거나 비공개입니다." 메시지 유지(private 존재 누설 금지). 시각만 갱신.

각 컴포넌트의 모바일 동작(< 640px)을 한 줄로 명시하라.

#### `design/ANTIPATTERNS.md`
v0.1 `docs/UI_GUIDE.md`의 "AI 슬롭 안티패턴" 표(7개 항목)를 기반으로 표를 작성하라. 컬럼: `안티패턴`, `v0.1 정책`, `v0.2 정책`, `근거(왜 완화/유지/금지인가)`. 추가로 v0.2에서 새로 도입할 만한 시각 요소(예: 의도적 grain texture, 모노스페이스 액센트, 사이드 margin notation 등)와 그 사용 한계도 1~3개 추가 항목으로 명세한다.

### 0-3. 메모리 메모

step 0 완료 후, 향후 세션에서 v0.2 디자인 결정 사항을 빠르게 회수할 수 있도록 메모리에 다음 항목을 1~2개 저장하라:

- v0.2 디자인 방향(distinctive·production-grade, 학술/노트북 메타포 유지) 한 줄 요약 + 산출물 경로 4종.
- v0.1 안티패턴 중 v0.2에서 완화/유지로 바뀐 항목 요약(특히 보라색 금지 유지 여부, glass morphism 금지 유지 여부).

이는 본 step의 의무 산출물이다(파일 + 메모리 둘 다).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 검증:
- `phases/step9-design-overhaul/design/` 디렉토리에 4개 파일(MOODBOARD.md, TOKENS.md, COMPONENTS.md, ANTIPATTERNS.md)이 존재한다.
- TOKENS.md 표에 라이트/다크 두 컬럼이 모두 채워져 있고, 본문 텍스트 토큰의 라이트/다크 모드 대비가 모두 4.5:1 이상임을 비고에 기록.
- 코드 변경 0건 — `git diff --stat` 결과에 `packages/`, `apps/`가 등장하지 않는다(phases/만 변경).

## 검증 절차

1. 위 AC 커맨드 실행(회귀 확인 — 변경이 없으니 기존 421+ 테스트가 그대로 통과해야 한다).
2. 산출물 4개 파일 존재 + 본문 채워졌는지 확인.
3. `git diff --stat` 으로 코드 변경 0 확인.
4. 결과에 따라 `phases/step9-design-overhaul/index.json`의 step 0를 갱신:
   - 성공 → `"status": "completed"`, `"summary": "v0.2 디자인 방향 4종 산출물 확정 (MOODBOARD/TOKENS/COMPONENTS/ANTIPATTERNS)"`.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 사유"`.
   - 사용자 개입 필요(예: 디자인 방향 결정에 추가 입력 필요) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단.

## 금지사항

- **이 step에서 코드를 변경하지 마라.** 이유: design-direction은 의사결정 단계이며 step 1 이후가 그 결정을 구현한다. step 0에서 코드까지 손대면 결정·구현을 분리한 phase 설계 의도가 무너진다.
- **`docs/UI_GUIDE.md`를 직접 편집하지 마라.** 이유: UI_GUIDE 갱신은 step 1의 책임이다. step 0은 산출물을 phase 디렉토리에만 둔다.
- **frontend-design 스킬을 우회하지 마라.** 이유: 메모리에 기록된 사용자 결정 — "v0.2 디자인 phase는 frontend-design 스킬 활용". 스킬을 부르지 않고 직접 무드보드를 작성하면 결과가 일반화되어 v0.1과 차별화되지 않는다.
- **외부 CDN 폰트를 토큰에 박지 마라.** 이유: privacy-first 제품이므로 외부 호스트로의 referrer/요청 누출을 막아야 한다. 웹폰트를 도입하면 self-host(`apps/blog/public/fonts/`) 전제로 결정.
- **보라/인디고 단일 액센트 채택 금지 유지 여부를 명시 없이 풀지 마라.** 이유: AI 슬롭 안티패턴의 1번. 다른 액센트로 가더라도 "보라색 금지" 유지/완화 결정을 ANTIPATTERNS.md에 명시적으로 기록해야 후속 step이 흔들리지 않는다.
- 기존 테스트를 깨뜨리지 마라.
