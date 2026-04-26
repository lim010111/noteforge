# Step 1: ui-guide-rewrite

step 0 산출물(`phases/step9-design-overhaul/design/*.md`)을 단일 진실 공급원으로 삼아 `docs/UI_GUIDE.md`를 v0.2 톤으로 전면 개정한다. v0.1 보존본은 `docs/UI_GUIDE.v0.1.md`로 백업한다.

## 읽어야 할 파일

먼저 다음을 읽어 현행 톤·산출물·아키텍처 제약을 정확히 파악하라:

- `docs/UI_GUIDE.md` (현행 v0.1) — 톤, 안티패턴 표, 색상/타이포 표.
- `phases/step9-design-overhaul/design/MOODBOARD.md` — v0.2 방향 한 단락 + 레퍼런스.
- `phases/step9-design-overhaul/design/TOKENS.md` — 라이트/다크 토큰 표.
- `phases/step9-design-overhaul/design/COMPONENTS.md` — 컴포넌트 시안.
- `phases/step9-design-overhaul/design/ANTIPATTERNS.md` — 완화/유지 결정.
- `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ADR.md` — privacy/threat model, 정적 출력 제약.
- `README.md` — UI_GUIDE를 참조하는 외부 링크 위치 확인.

## 작업

### 1-1. v0.1 백업

`docs/UI_GUIDE.md` 파일을 그대로 복사해 `docs/UI_GUIDE.v0.1.md`로 보존한다. 백업 파일 본문 맨 위에 다음 한 단락(영문/국문 자유)을 헤더로 추가하라:

```markdown
> **보존 문서.** 이 파일은 v0.1 시점의 UI 가이드 스냅샷이며, v0.2부터는 [UI_GUIDE.md](./UI_GUIDE.md)가 정본이다. v0.1의 의도(미니멀·읽기 우선·SaaS 클리셰 금지)와 안티패턴 항목은 v0.2에서도 일부 유지되므로 참조용으로 남긴다.
```

이후 백업 파일은 추가로 편집하지 않는다.

### 1-2. v0.2 UI_GUIDE.md 작성

기존 `docs/UI_GUIDE.md`를 완전히 갈아엎고, 다음 섹션 순서로 새로 쓴다. 모든 수치/토큰명은 step 0의 `TOKENS.md`를 그대로 인용해야 한다(불일치 금지).

#### 섹션 구성

1. **제목** — `# UI 디자인 가이드 — @noteforge/theme-default (v0.2)`
2. **설계 배경** — v0.1에서 v0.2로 톤이 바뀐 이유 한 단락. 유지되는 계약(privacy·접근성·정적 출력) 강조.
3. **디자인 원칙 (v0.2)** — 3~5개 원칙. step 0 MOODBOARD에 정리된 비주얼 모티프와 연결.
4. **유지/완화/추가 (안티패턴 표)** — `ANTIPATTERNS.md`의 표를 그대로 옮긴다. 컬럼 동일.
5. **색상 토큰** — 라이트/다크 두 표. `TOKENS.md`의 색상 카테고리(배경/텍스트/시맨틱/액센트)를 그대로. CSS 변수 이름과 hex 값을 명시.
6. **타이포그래피** — 폰트 스택, 타입 스케일, 측정폭. 웹폰트 self-host 정책 명시(외부 CDN 금지).
7. **레이아웃** — 컨테이너 폭, 정렬 규칙, 모바일 분기 breakpoint, spacing scale 사용 예.
8. **컴포넌트 가이드** — `COMPONENTS.md`의 컴포넌트별 시안을 정리. 각 컴포넌트 아래에 라이트/다크 모두에서의 시각 동작과 모바일 동작을 한 줄씩.
9. **다크 모드** — `prefers-color-scheme` 자동 + `html[data-theme="dark"|"light"]` 수동 토글 정책. 토글이 어떤 컴포넌트에 노출되는지(BaseLayout 헤더 권장) 명시. 깜빡임(FOUC) 방지 — head 안에서 sync script 1개 허용. 그 외 정적 출력 유지.
10. **모션** — 토큰화된 duration/ease + 허용/금지 motion. `prefers-reduced-motion: reduce` 지원 의무 명시.
11. **아이콘** — 인라인 SVG, stroke 정책, 출처(Lucide 또는 Heroicons outline 중 선택, 둘 혼용 금지).
12. **접근성** — focus outline 유지, 4.5:1 대비 유지, semantic HTML, alt 텍스트 의무, sr-only 사용처.
13. **404** — "해당 노트가 없거나 비공개입니다." 문구 유지(private 존재 누설 금지). 시각만 v0.2 토큰으로.
14. **Privacy 시각 계약** — 시각 디자인이 절대 우회하지 않는 규칙: private wikilink는 `<a>` 없는 strip-to-text, private embed는 AST에서 제거(빈 자리도 표시 금지), allowlist 외 frontmatter 필드는 meta/og에 노출 금지, graph/backlinks는 filtered 데이터만 받음.

각 섹션은 v0.1 가이드처럼 표/코드블록을 적극 활용해 구현자가 그대로 옮길 수 있는 수준으로 구체적으로 쓰라. "예쁘게" 같은 모호한 단어 금지.

#### v0.1과의 차이를 명시

문서 마지막에 "## v0.1에서 무엇이 바뀌었나" 섹션을 두고 4~8개 bullet으로 핵심 변화를 나열하라(예: "단일 라이트 테마 → 라이트/다크 동시 지원", "system font stack only → self-host 웹폰트 1종 도입", "그림자 0개 → elevation 토큰 1~2개 도입" 등). step 0 결정에 따라 항목 수는 달라질 수 있다.

### 1-3. 외부 참조 갱신 (필요 시)

다음 파일에서 UI_GUIDE를 참조하는 경로/문구가 있으면 갱신:

- `README.md` — 디자인 관련 언급.
- `CHANGELOG.md` — `[Unreleased]` 또는 v0.2 섹션에 "UI guide rewritten for v0.2 design overhaul" 한 줄 추가.
- `CLAUDE.md` — UI_GUIDE 경로/존재 가정이 있으면 v0.2 정책 반영. v0.1 보존본 경로(`docs/UI_GUIDE.v0.1.md`)도 새 줄로 추가.

존재하지 않는 참조를 새로 만들지는 마라.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 검증:
- `docs/UI_GUIDE.v0.1.md` 파일이 존재하고, 첫 줄이 백업 안내 단락이며, 그 아래 본문은 직전 커밋(`f8ff5d6` 시점)의 `docs/UI_GUIDE.md`와 동일.
- `docs/UI_GUIDE.md`는 v0.2 톤으로 완전히 새로 쓰여 있고, 14개 섹션을 모두 포함한다.
- v0.2 UI_GUIDE의 색상/타이포/spacing 수치가 `phases/step9-design-overhaul/design/TOKENS.md`와 1:1로 일치(불일치 0).
- `pnpm --filter blog build`는 통과(이 step은 코드 변경 없으므로 기존 빌드가 그대로 통과해야 함).

## 검증 절차

1. 위 AC 커맨드 실행.
2. 문서 정합성 체크리스트:
   - UI_GUIDE.md ↔ TOKENS.md 토큰 명/값 1:1 일치?
   - UI_GUIDE.md ↔ ANTIPATTERNS.md 안티패턴 표 1:1 일치?
   - 외부 CDN 웹폰트 명시가 없는가?
   - "private 존재 누설 금지" 문구가 404 섹션에 그대로 남아 있는가?
3. 결과에 따라 `phases/step9-design-overhaul/index.json`의 step 1을 갱신:
   - 성공 → `"status": "completed"`, `"summary": "docs/UI_GUIDE.md v0.2 재작성 + UI_GUIDE.v0.1.md 백업"`.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`.

## 금지사항

- **`packages/` 또는 `apps/` 코드를 수정하지 마라.** 이유: 코드(토큰 CSS, 컴포넌트)는 step 2 이후의 책임. 여기서 손대면 검증 단위가 흐트러진다.
- **TOKENS.md 값과 다른 수치를 UI_GUIDE에 적지 마라.** 이유: SSOT 위반. 후속 step이 어느 쪽을 따라야 할지 모호해진다.
- **v0.1 보존본을 새 위치로 옮기되 두 번 편집하지 마라.** 이유: 백업의 의미는 시점 고정. 추가 편집 시 v0.1 톤 자체가 왜곡된다.
- **외부 CDN 웹폰트(예: Google Fonts) 사용을 가이드에 적지 마라.** 이유: privacy-first 제품의 referrer/요청 누출. 도입할 경우 self-host 전제.
- 기존 테스트를 깨뜨리지 마라.
