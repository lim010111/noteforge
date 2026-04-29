# Step 0: design-direction-v0.3

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `docs/UI_GUIDE.md` (현재 v0.2)
- `phases/step9-design-overhaul/design/MOODBOARD.md`
- `phases/step9-design-overhaul/design/TOKENS.md`
- `phases/step9-design-overhaul/design/COMPONENTS.md`
- `phases/step9-design-overhaul/design/ANTIPATTERNS.md`
- `phases/step10-v03-sidebar-redesign/refs/main_page.png` — 좌측 사이드바 + 아바타/닉네임 + 폴더 트리, 우측 Recent + Featured 두 레일 와이어프레임
- `phases/step10-v03-sidebar-redesign/refs/parent_page.png` — 폴더 인덱스 페이지(폴더 이름 클릭 시) 와이어프레임

## 작업

이 step은 **코드 변경 0**이다. 디자인 산출물 4종만 만든다.

`affaan-m-everything-claude-code-frontend-design` 스킬을 반드시 호출해 무드보드 → 토큰 → 컴포넌트 시안 → 안티패턴 흐름으로 작업하라. 산출물은 모두 `phases/step10-v03-sidebar-redesign/design/` 아래에 둔다.

### 산출물 1 — `design/MOODBOARD.md`

- v0.2 editorial-technical 골격(serif/sans/mono triad, hairline border, warm-cream / cool-ink 페이지 색)을 **유지**한다는 점을 명시.
- v0.3에서 *새로* 들어오는 모티프: 좌측 사이드바 + 폴더 트리, 아바타+닉네임 아이덴티티 블록, Recent + Featured 두 레일 홈, 보조 chromatic accent + 카테고리 accent + 추가 surface tier.
- 와이어프레임 PNG 2장에 대한 해석. 어떤 구조 요소를 그대로 가져올지(좌측 16rem 사이드바, 우측 본문 그리드, 폴더 이름 + ▶ 토글 분리), 어떤 시각 결정은 유지/변경할지(컬러풀하지만 v0.2 안티패턴 금지선은 그대로) 표로 정리.

### 산출물 2 — `design/TOKENS.md` (delta from v0.2)

v0.2 `phases/step9-design-overhaul/design/TOKENS.md`를 SSOT 기준으로 두고, **추가/변경되는 토큰만** 명시한다(전체 재작성 금지).

추가되어야 할 카테고리(이름은 final 결정):
1. **보조 accent** — 1개. 여전히 warm 계열(보라/인디고/네온 금지). 라이트/다크 변종, 본문 대비비 ≥ 4.5:1, 액센트 호버 변종 포함.
2. **카테고리 accent slots** — 4~6개. `--color-accent-cat-1` … `-N` 패턴. 각 슬롯에 라이트/다크 hex와 본문 대비비 표기. 슬롯은 의미 중립(슬러그 segment → slot 매핑은 코드의 결정, 토큰은 슬롯만 제공).
3. **새 surface tier** — 1개. 사이드바/폴더 트리 표면용(`--color-bg-sidebar` 권장). 페이지 색과 카드 색 사이 단차, 라이트/다크 양쪽.
4. **(필요 시)** spacing/radius 추가 토큰. 와이어프레임에 새로 등장하는 dimension만.

각 토큰의 라이트/다크 hex를 표로, 페이지 배경 대비 비를 함께 적는다.

### 산출물 3 — `design/COMPONENTS.md`

다음 컴포넌트 6종에 대해 props 시그니처(텍스트로) + 시각 시안(아스키 또는 마크다운) + 상태(default/hover/focus/active/empty)를 적는다.

1. `Sidebar` — AvatarBlock + FolderTree + (선택) nav links 컴포지션. lg+ 상시, < lg 드로어.
2. `AvatarBlock` — `avatarSrc?` + `nickname?`. 둘 다 없으면 블록 자체를 렌더하지 않음(빈 슬롯 누설 0).
3. `FolderTree` — `<details>` 기반 JS-less 토글, 폴더 이름은 링크(`/<path>/`), `▶`는 `<summary>` 영역. ARIA는 `<nav aria-label="Folder tree">` + `<ul>` + `aria-current="page"` (tree role 사용 금지 — 키보드 화살표 핸들러 없음).
4. `FolderIndex` — 폴더 페이지 전체. breadcrumb + 즉시 자식 노트 리스트 + 즉시 자식 서브폴더 리스트.
5. `RecentRail` — 홈 첫 레일. `selectRecent(n=10)` 결과 받음.
6. `FeaturedRail` — 홈 두 번째 레일. `selectFeatured(n=6)` 결과 받음. 0개면 레일 자체를 그리지 않음(빈 헤딩/카피 금지).

각 컴포넌트에 대해 카테고리 accent가 어디서 적용되는지(예: 폴더 트리의 첫 segment 색 도트, FolderIndex breadcrumb 색)도 명시.

### 산출물 4 — `design/ANTIPATTERNS.md`

v0.2 `ANTIPATTERNS.md`의 7개 금지 항목(글래스 모피즘, gradient text, AI 배지, 네온 글로우/펄스, 보라/인디고, `rounded-2xl` 일괄, gradient orb)을 **표 그대로 옮긴다**. 그런 다음 v0.3에서 완화되는 한 가지 — chromatic 확장(보조 accent + 카테고리 accent + 추가 surface tier)을 별도 표로 적고, 완화의 한계선("warm 계열만 / 페이지 배경 위 텍스처 여전히 금지 / radius 스케일 변경 없음 / 멀티스텝 그림자 여전히 0")을 명문화.

## Acceptance Criteria

```bash
# 산출물 4종 존재
test -f phases/step10-v03-sidebar-redesign/design/MOODBOARD.md
test -f phases/step10-v03-sidebar-redesign/design/TOKENS.md
test -f phases/step10-v03-sidebar-redesign/design/COMPONENTS.md
test -f phases/step10-v03-sidebar-redesign/design/ANTIPATTERNS.md

# 코드 0줄 변경 (packages/ apps/ 어디도 건드리지 않았어야 함)
test "$(git diff --stat -- packages apps | wc -l)" = "0"
```

## 검증 절차

1. 위 AC 커맨드 실행.
2. 디자인 체크리스트:
   - MOODBOARD에 v0.2 골격 유지 + v0.3 새 모티프 둘 다 명시?
   - TOKENS는 *delta*인가(전체 재작성 아님)? 라이트/다크 양쪽 hex 표기?
   - COMPONENTS의 6종이 모두 props/상태/카테고리 accent 적용 지점까지 명시?
   - ANTIPATTERNS는 v0.2 7개를 그대로 가져왔고, chromatic 확장의 한계선이 따로 적혀 있는가?
3. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "v0.3 디자인 방향 4종 산출(MOODBOARD/TOKENS/COMPONENTS/ANTIPATTERNS) — 사이드바·폴더 트리·아바타·홈 레일·확장 팔레트"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "<구체적>"` 후 즉시 중단

## 금지사항

- 코드 파일(`packages/**`, `apps/**`)을 1줄도 수정하지 마라. 이유: 이 step은 디자인 SSOT 확정 단계이고, 토큰/컴포넌트 구현은 step 2~5의 책임이다. 디자인이 굳기 전에 코드가 먼저 박히면 둘이 어긋난다.
- v0.2의 7개 안티패턴(글래스 모피즘, gradient text 헤딩, AI 배지, 네온 글로우/펄스, 보라/인디고, `rounded-2xl`/`rounded-full` 일괄, gradient orb 배경)을 완화하지 마라. 이유: dogfood 결과 사용자가 v0.2의 *시각 빈약함*을 비판한 것이지 *안티패턴 금지선*을 비판한 게 아니다. 컬러풀해지는 길은 *새로 도입하는 chromatic 토큰*이지 금지된 모티프 부활이 아니다.
- `affaan-m-everything-claude-code-frontend-design` 스킬 호출을 생략하지 마라. 이유: project memory(`project_v02_design_phase`)가 디자인 phase의 첫 step에서 이 스킬 호출을 강제한다. v0.2 step 9 step 0이 이 패턴을 확립했고 v0.3도 동일.
