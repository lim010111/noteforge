# Project Memory — Obsidian-Publish-OSS

`MEMORY.md` 는 프로젝트 차원의 결정·교훈을 외부화하는 단일 위치다. 코드/CLAUDE.md/PRD 에서 추론할 수 없고, 한 번 잊으면 같은 실수를 반복하게 되는 종류의 사실만 적는다. 각 모듈 단위 결정은 모듈 CLAUDE.md 에, 큰 아키텍처 결정은 [docs/adr/](./docs/adr/) 에.

## 프로젝트 정체성

- **차별화 한 줄**: "표시하지 않은 것은 존재조차 드러내지 않는다." Quartz / Digital Garden / Flowershow 와는 *기본값* 이 정반대 (opt-out → opt-in).
- **타깃 사용자**: Quartz 를 써봤지만 실수로 private 노트 제목이 graph / backlinks 에 새는 게 불안한 사람.
- **non-goal**: 다중 vault, Obsidian 플러그인 래퍼, 전문 검색, OG image — v0.4+ 까지 의도적으로 미룬다.

## 다시 하지 말 것 (lessons)

- **Privacy 결정을 두 곳에 두지 말 것.** 한 곳: `packages/core/src/privacy/classify.ts`. 테마/어댑터/CLI 에서 재구현하는 순간 규약이 깨진다 — root CLAUDE.md CRITICAL 1번. 관련 결정: [adr/0001-privacy-first-opt-in.md](./docs/adr/0001-privacy-first-opt-in.md).
- **frontmatter allowlist 를 우회하지 말 것.** "이번 한 번만" 으로 넣은 필드가 다음 빌드부터 meta 에 새는 사고로 연결됐다. 변경은 항상 `packages/core/src/privacy/frontmatterFilter.ts` 한 곳. 관련: [adr/0002-allowlist-frontmatter.md](./docs/adr/0002-allowlist-frontmatter.md).
- **Astro 자동 빌드(GitHub Actions runner)를 만들려 하지 말 것.** apps/blog 의 vault 경로는 사용자 로컬 절대 경로다. CI 에서 빌드하려는 시도는 의도적 미지원이며 우회는 vault 노출 위험. 관련: [adr/0004-build-locally-not-ci.md](./docs/adr/0004-build-locally-not-ci.md).
- **canary 를 그냥 통과시키지 말 것.** `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, `FOLDER_TREE_DO_NOT_LEAK_8a4f2` 가 렌더 HTML 에 0회 등장하는지가 privacy 회귀의 last-line-of-defense. 변경 PR 에서 우회 fixtures 를 만들려는 충동이 들면 위험 신호.
- **TDD 를 privacy 영역에서 건너뛰지 말 것.** 실패 테스트 먼저, 통과 구현은 그 다음. 관련: [adr/0005-tdd-for-privacy.md](./docs/adr/0005-tdd-for-privacy.md).

## 현재 사이클의 큰 그림

- v0.5 design refresh 진행 중. 디자인 대대적 개편 + alias / Cloudflare 배포 인프라가 핵심 산출.
- evals / MEMORY 외부화 / 모듈 컨텍스트 / CI 검증은 2026-05-02 사이클에서 보강 완료. AI-readiness 점수 27 → 90 (AI-Native). 점수 보드는 [docs/ai-readiness-score.json](./docs/ai-readiness-score.json).

## 다음 사이클 후보 (AI-readiness 잔여)

- **god file 분할** — 점수 영향 0, 토큰/편집 효율 개선. 우선순위 낮음 + 회귀 위험으로 별도 PR 권장.
  - `packages/astro-integration/tests/integration.test.ts` (948줄) — 1-374 helper · 375-577 factory describe · 580-948 dev-server describe 로 자연 분할.
  - `packages/core/src/pipeline.ts` (695줄) — **코드** (테스트 아님). discover / classify / filter / render 단계별 분할 가능, 위험도 가장 높음.
  - `apps/blog/src/lib/folderAggregation.test.ts` (568줄) · `scripts/test_execute.py` (559줄) · `packages/cli/tests/audit/checks.test.ts` (514줄) — 테스트 파일, 비교적 안전.
- **F (pre-push hook)** — `.husky/` 추가 시 +2점. CI-only 정책과 충돌하지 않게 설계 필요 (현재는 CI에서만 검증).
- **score.py 정규식 버그** — `js`가 `json`보다 alternation 앞에 있어 `.json` path를 false positive로 잡음. validator는 fix 했고, score.py는 skill 영역이므로 그대로 둔다. E1 false positive 67건은 진짜 broken 0건이며, validator 출력 (`pnpm validate:context-paths`)이 진실 소스.

## 어디에 무엇이 있는가

- 모듈별 책임 / 핵심 파일 / 변경 패턴 → 각 모듈의 `CLAUDE.md` (= `AGENTS.md`).
- 큰 아키텍처 결정 → [docs/adr/](./docs/adr/) (한 결정 = 한 파일).
- 위협 모델 / 책임 범위 → [docs/PRD.md](./docs/PRD.md).
- 모듈 간 의존 / 파이프라인 → [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- 디자인 토큰 / 레이아웃 → [docs/UI_GUIDE.md](./docs/UI_GUIDE.md).
- 배포 / Cloudflare Pages → [docs/DEPLOY.md](./docs/DEPLOY.md).
- 릴리스 노트 → [CHANGELOG.md](./CHANGELOG.md).
