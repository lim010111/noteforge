# Step 6: dogfood-and-screenshots

`apps/blog`에서 v0.2 디자인을 실제 빌드/실행해 시각 회귀를 점검하고, README/문서의 스크린샷을 갱신한다. 전체 회귀 0(typecheck/lint/test/build/audit), canary 0/0를 최종 확인한 뒤 v0.2 phase를 마감한다.

## 읽어야 할 파일

먼저 다음을 읽고 검증 범위를 명확히 하라:

- `phases/step9-design-overhaul/design/COMPONENTS.md`, `TOKENS.md` — 시각 회귀 기준.
- `docs/UI_GUIDE.md` (v0.2) — 정책 기준.
- `README.md` — 스크린샷 위치(`docs/screenshots/dogfood.png`)와 캡션.
- `CHANGELOG.md` — `[Unreleased]` 또는 v0.2 섹션.
- `TODO.md` — Step 9 체크박스.
- `apps/blog/obsidian-blog.config.ts` — vault 절대경로(사용자 본인 경로).
- `apps/blog/src/pages/index.astro`, `[...slug].astro`, `graph.astro`, `tags/`.
- `packages/core/tests/integration/` + audit 호출부 — canary 검증.

## 작업

### 6-1. 빌드 + audit + 회귀 검증

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

빌드 후:

- audit 위반 0 확인. CLI 명령으로도 한 번 더:
  ```bash
  pnpm obpub audit --strict
  ```
- canary 2종 0회 확인:
  ```bash
  grep -r "DO_NOT_LEAK_BANANA_6f3c1" apps/blog/dist/ && echo "LEAK!" || echo "OK"
  grep -r "CLAUDE_COMMENT_LEAK_77b" apps/blog/dist/ && echo "LEAK!" || echo "OK"
  ```
- frontmatter allowlist 외 필드가 dist HTML에 0회 등장 (기존 audit 규칙 또는 직접 grep — 기존 검증을 신뢰).

### 6-2. dev 서버 스모크 (시각 회귀)

```bash
pnpm --filter blog dev
```

브라우저로 다음 페이지를 라이트/다크 모드 각각으로 열고 시각 회귀 체크:

- `/` (홈) — 헤더/네비/푸터/노트 목록.
- 임의 노트 페이지 — h1/메타/태그/본문 prose/heading anchor 호버/코드 블록(라이트·다크 두 테마)/blockquote/이미지/embed aside.
- `/tags/` — 태그 인덱스.
- `/tags/<some-tag>` — 태그별 노트 목록.
- `/graph` — 그래프 SVG.
- `/<없는-슬러그>` 또는 `/private-canary` — 404.
- 모바일 뷰포트(< 640px) — 모바일 메뉴 토글, 카드 그리드 단일 컬럼, prose 측정폭.

각 페이지에서 다음을 확인:

- 다크 모드 토글 클릭 → `localStorage('theme')` 갱신 + 즉시 토큰 변경 + 새로고침 시 깜빡임 0.
- 키보드 Tab으로 모든 인터랙티브 요소 도달 가능 + visible focus.
- `prefers-reduced-motion: reduce` (DevTools에서 강제) → 모션 0.
- `<a class="skip-link">` 첫 Tab에서 표시.

발견한 회귀는 step 3~5 중 해당 step의 책임 영역으로 분류해 즉시 수정하고 같은 step의 산출물 노트에 한 줄 추가. 큰 회귀(여러 컴포넌트 영향)면 본 step 산출물 summary에 명시.

### 6-3. 스크린샷 갱신

`docs/screenshots/`에 v0.2 스크린샷 추가/갱신:

- `dogfood.png` (라이트) — 노트 페이지 1장.
- `dogfood-dark.png` (다크) — 같은 노트 페이지 다크 모드.
- (선택) `graph.png`, `tags.png` — 시안 합의 시.

이미지 캡처 가이드:
- 1280x800 또는 1440x900 해상도 권장.
- 텍스트 가독성을 위해 retina(2x) 해상도로 저장.
- 파일 크기는 PNG 기준 1MB 이하로 압축(`pngquant`/`oxipng` 등). 외부 도구 사용 시 사용자 환경에 설치되어 있는지 먼저 확인.
- private 콘텐츠 노출 금지 — 캡처 전 vault 화면을 확인하고, 캡처된 스크린샷이 dist 빌드의 public 페이지에 한정되는지 재확인.

`README.md`의 캡션/이미지 경로 갱신:
- 라이트/다크 두 장을 나란히 보여줄 수 있다면 `<picture>` 태그 또는 두 줄로.
- 캡션에 v0.2 톤 한 문장.

### 6-4. 문서 마감

- `CHANGELOG.md` — `[Unreleased]` 섹션을 v0.2.0 항목으로 마감. 변경 요약: "Design overhaul: dual-theme tokens, layout/nav refresh, prose with heading anchors and dual-theme code blocks, backlinks/tags/graph visual refresh." 일자: 작업 완료일.
- `TODO.md` — `## v0.2 — 디자인 대대적 개편 (Step 9)` 블록의 모든 체크박스를 `[x]`로 갱신.
- `README.md` — "상태" 섹션을 v0.2.0으로 갱신, "v0.1에서 의도적으로 빠진 것" 항목 중 v0.2에서 채워진 항목(다크 모드, heading anchor 등) 처리.
- `docs/UI_GUIDE.v0.1.md` — 변경 없음(보존본).

### 6-5. 메모리 정리

향후 세션에서 유용할 항목 1~2개를 갱신/추가:

- v0.2 출시 한 줄 요약(완료일, 핵심 변경 4~5개 bullet) — project memory 갱신.
- v0.1 → v0.2 안티패턴 변화 요약(보라색 금지 유지/완화 결정 등) — feedback 또는 project memory.

이미 step 0에서 v0.2 디자인 방향 메모리를 만들었다면 그 항목을 update(중복 신규 작성 금지).

### 6-6. 릴리스 안내(사용자 액션)

execute.py가 처리하지 않는 항목은 step 산출물 노트에 한 줄로 명시:

- `git tag -a v0.2.0 -m "v0.2.0" && git push origin v0.2.0`
- Cloudflare Pages 재배포: `wrangler pages deploy apps/blog/dist` (사용자가 직접). `docs/DEPLOY.md` 절차 그대로.

본 step에서 직접 푸시/배포를 실행하지 않는다.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

추가 검증:
- canary 2종 0회.
- audit 위반 0.
- `apps/blog/dist/`의 임의 노트 페이지를 열었을 때 라이트/다크 모두 정상 표시(검증은 SSR 결과 문자열 또는 dev 서버 + 수동 확인).
- `docs/screenshots/dogfood.png`(또는 합의된 신규 파일명)이 v0.2 톤으로 갱신.
- `CHANGELOG.md`/`TODO.md`/`README.md`가 v0.2 마감 상태.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 회귀 체크리스트 — 다음 중 어느 하나라도 실패면 step `error`로 등록:
   - typecheck 0 error.
   - lint 0 error.
   - test 0 fail (회귀 0).
   - build 성공.
   - audit 위반 0.
   - canary 2종 0회.
3. 시각 체크리스트(시안 대비) — 발견된 회귀는 해당 step(3/4/5)으로 분류해 수정 후 본 step 다시 진행.
4. 결과에 따라 `phases/step9-design-overhaul/index.json`의 step 6를 갱신:
   - 성공 → `"status": "completed"`, `"summary": "v0.2 도그푸드 회귀 0; canary 0/0; audit 0; 스크린샷·CHANGELOG·TODO·README 마감"`.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요(예: 시각 회귀가 시안과 충돌, 사용자 결정 필요) → `"status": "blocked"`, `"blocked_reason": "..."`.

## 금지사항

- **본 step에서 코드 변경을 새로 도입하지 마라.** 이유: 회귀 검증 + 문서 마감 단계. 새 기능/시각 변경은 step 3~5의 책임. 발견한 회귀는 해당 step으로 돌아가 수정한 뒤 본 step 다시 실행.
- **사용자 vault의 private 노트가 들어간 화면을 캡처하지 마라.** 이유: privacy CRITICAL. 캡처는 dist 빌드의 public 페이지 한정.
- **외부 호스팅 이미지 URL을 README에 박지 마라.** 이유: privacy + 빌드 재현성. 이미지는 `docs/screenshots/`에 self-host.
- **`git tag` / `wrangler pages deploy` 를 실행하지 마라.** 이유: 사용자 책임. step은 안내만 한다.
- **`docs/UI_GUIDE.v0.1.md` 백업본을 편집하지 마라.** 이유: 시점 고정 보존본.
- **CHANGELOG/TODO/README의 무관 섹션을 동시에 손대지 마라.** 이유: 마감 커밋의 diff 가독성을 위해 v0.2 관련 영역만.
- 기존 테스트를 깨뜨리지 마라.
