# Step 0: commit-split-4

## 컨텍스트

이 step은 **코드 변경 없이 git 작업만** 수행한다. working tree에 떠 있는 v0.4 작업분을 의미 단위 5커밋으로 분리한다. plan SSOT는 `docs/dev_contexts/nav_categories_about.md` §7.

이 phase는 v0.4 release prep — 1 phase 5 step 중 첫 번째.

오늘 날짜: **2026-04-29**.

추가 분리 사유: 직전 코드 리뷰 후 vault path 하드코딩을 `OBPUB_VAULT_PATH` 환경변수로 분리(`.env.example` 신규, `apps/blog/obsidian-blog.config.ts` 수정, README `빠른 시작` §3 갱신). 이건 Categories/About 작업과 의미가 다르므로 5번째 커밋(`docs+chore` 합성)으로 묶는다.

## 읽어야 할 파일

- `/CLAUDE.md` — 전역 + 프로젝트 규칙 (특히 `Co-Authored-By: Claude` 트레일러 금지)
- `/docs/dev_contexts/nav_categories_about.md` §7 — 4 commit split 정의 (commit message · 대상 파일)
- 실시간 `git status --short` — 분리 시작 시 working tree 상태 (참고용; phases/ 변경분은 제외)

## 작업

다음 5커밋을 순서대로 생성. 각 커밋은 conventional commits prefix를 따른다. **`Co-Authored-By: Claude`** 등 AI 트레일러는 절대 포함하지 않는다 (전역 CLAUDE.md 규칙).

각 커밋 메시지는 **HEREDOC**로 전달한다 (Bash `git commit -m "$(cat <<'EOF' ... EOF)"` 패턴).

### Commit 1 — docs(plan)

메시지:
```
docs(plan): nav 교체 + Categories/About 작업 계획 추가
```

대상:
- `docs/dev_contexts/nav_categories_about.md` (untracked)

### Commit 2 — feat(core)

메시지:
```
feat(core): site.about 스키마 추가
```

대상:
- `packages/core/src/config.ts`
- `packages/core/tests/config.test.ts`

내용 요지: `aboutSchema` (headline?/bio[]/highlights[]) optional 등록 + 6 test 추가 (optional / populated / partial-defaults / 3 rejection paths).

### Commit 3 — feat(theme)

메시지:
```
feat(theme): nav 교체 (Home/Categories/About) + CategoryOverview·AboutPage 컴포넌트
```

대상 (`packages/theme-default/` 하위만):
- modified: `src/components/FolderTree.astro`, `src/index.ts`, `src/layouts/BaseLayout.astro`, `src/layouts/BaseLayout.types.ts`, `src/styles/components.css`, `src/styles/layout.css`
- new: `src/components/CategoryOverview.astro`, `src/components/CategoryOverview.types.ts`, `src/components/AboutPage.astro`, `src/components/AboutPage.types.ts`, `src/components/SocialLinks.astro`, `src/components/SocialLinks.types.ts`

내용 요지:
- BaseLayout nav (desktop + mobile drawer) `notes/tags/graph` → `Home/Categories/About`
- `BaseLayoutProps.ogType` 유니온에 `'profile'` 추가
- CategoryOverview / AboutPage / SocialLinks 신규 + components.css 토큰만으로 BEM
- index.ts barrel export 갱신

### Commit 4 — feat(blog)

메시지:
```
feat(blog): /categories·/about 페이지 + payload lib + 테스트
```

대상 (`apps/blog/` 하위만, **`obsidian-blog.config.ts` 제외** — Commit 5로 분리):
- modified: `src/pages/404.astro`, `src/pages/[...slug].astro`, `src/pages/graph.astro`, `src/pages/index.astro`, `src/pages/tags/[tag].astro`, `src/pages/tags/index.astro`
- new: `src/pages/categories.astro`, `src/pages/about.astro`, `src/lib/categoryOverviewPayload.ts`, `tests/categoryOverviewPayload.test.ts`

내용 요지:
- /categories: FolderNode + dateBySlug → CategoryOverviewSection 평탄화
- /about: site.author/nickname/avatar/social + site.about 으로 AboutPage 호출
- payload lib + 6 unit tests
- 기존 5개 페이지에 v0.4 변경분 미세 적용 (BaseLayout 새 props 등)

### Commit 5 — feat(blog): vault path를 환경변수로 분리

메시지:
```
feat(blog): OBPUB_VAULT_PATH 환경변수로 vault 경로 분리
```

대상:
- modified: `apps/blog/obsidian-blog.config.ts` (process.loadEnvFile + OBPUB_VAULT_PATH 검증 + throw)
- modified: `README.md` (빠른 시작 §3 + 배포 섹션의 fork 안내 1단락)
- new: `.env.example` (저장소 루트, 사용자가 cp 후 채우는 템플릿)

내용 요지:
- vault 경로를 `process.env.OBPUB_VAULT_PATH`로 외부화 (Node 22+의 `process.loadEnvFile()`로 zero-dep `.env` 로딩)
- 누락 시 한국어 에러 throw — `cp .env.example .env` 가이드까지 메시지에 포함
- `.env`는 `.gitignore` 기존 규칙으로 자동 제외 (별도 변경 없음)
- README 빠른 시작 §3을 "config.ts 직접 편집" → "`.env` 작성"으로 갱신, 배포 섹션의 fork 안내 한 단락도 동일하게

### 작업 순서

1. `git status --short`로 현재 상태 확인.
2. **Commit 1**:
   ```bash
   git add docs/dev_contexts/nav_categories_about.md
   git commit -m "docs(plan): nav 교체 + Categories/About 작업 계획 추가"
   ```
3. **Commit 2**:
   ```bash
   git add packages/core/src/config.ts packages/core/tests/config.test.ts
   git commit -m "feat(core): site.about 스키마 추가"
   ```
4. **Commit 3**:
   ```bash
   git add packages/theme-default/
   git commit -m "feat(theme): nav 교체 (Home/Categories/About) + CategoryOverview·AboutPage 컴포넌트"
   ```
5. **Commit 4** (config.ts는 명시적으로 제외 — Commit 5로):
   ```bash
   git add apps/blog/src/ apps/blog/tests/
   git commit -m "feat(blog): /categories·/about 페이지 + payload lib + 테스트"
   ```
6. **Commit 5**:
   ```bash
   git add apps/blog/obsidian-blog.config.ts .env.example README.md
   git commit -m "feat(blog): OBPUB_VAULT_PATH 환경변수로 vault 경로 분리"
   ```
7. `git log --oneline -6`로 5커밋 확인 (HEAD가 위, `feat(blog): OBPUB…` → `feat(blog): /categories…` → `feat(theme)` → `feat(core)` → `docs(plan)` 순).
8. `git status --porcelain`로 working tree clean 확인 (`.env` 파일은 `.gitignore`되어 출력에 안 나와야 함).

`phases/step11-v04-release-prep/` 디렉토리는 별도 chore 커밋(이 phase가 시작되기 전 사용자 측에서 처리)으로 이미 분리되어 있으므로 무시한다.

## Acceptance Criteria

```bash
git log --oneline -5
git status --porcelain
git log -5 --format=%B | grep -ci 'co-authored-by: claude' || true
```

조건:
- `git log --oneline -5` 결과: 위에서부터 `feat(blog): OBPUB…` / `feat(blog): /categories…` / `feat(theme): …` / `feat(core): …` / `docs(plan): …`
- `grep -ci` 결과 0 (AI 트레일러 부재)
- `git status --porcelain` 출력 빈 문자열 (working tree clean — 단, `.env`는 `.gitignore`되어 표시되지 않음이 정상)

## 검증 절차

1. AC 명령 실행 및 위 조건 확인.
2. 각 커밋 변경 파일 검증:
   - `git show --stat HEAD~4` (Commit 1) → `docs/dev_contexts/nav_categories_about.md`만
   - `git show --stat HEAD~3` (Commit 2) → `packages/core/src/config.ts` + `packages/core/tests/config.test.ts`
   - `git show --stat HEAD~2` (Commit 3) → `packages/theme-default/` 하위만 (12 파일 부근)
   - `git show --stat HEAD~1` (Commit 4) → `apps/blog/src/` + `apps/blog/tests/` 하위만 (약 10 파일, **config.ts 부재**)
   - `git show --stat HEAD` (Commit 5) → `apps/blog/obsidian-blog.config.ts` + `.env.example` + `README.md` 정확히 3 파일
3. 결과 갱신 — `phases/step11-v04-release-prep/index.json` step 0:
   - 성공 → `"status": "completed"`, `"summary": "5커밋 분리 (docs/plan + feat/core + feat/theme + feat/blog-pages + feat/blog-envvar), <총 변경 파일 수> 파일, +<추가>/-<삭제>"`
   - 실패 → `"status": "error"`, `"error_message": "어느 단계에서 어떤 출력으로 실패했는지 구체"`

## 금지사항

- `Co-Authored-By: Claude` 트레일러를 어떤 커밋 메시지에도 포함하지 마라. 이유: 전역 CLAUDE.md 규칙.
- `git add -A`나 `git add .`을 한 번에 사용하지 마라. 이유: 4커밋 분리가 plan §7 SSOT.
- `git commit --amend`를 사용하지 마라. 이유: 분리 의도 손상 + 첫 시도에 신중히.
- 코드를 수정하지 마라. 이유: 이 step의 scope는 git 작업만.
- `phases/step11-v04-release-prep/`의 변경분을 4커밋 중 어느 하나에 포함하지 마라. 이유: 메타데이터는 별도 chore 커밋(execute.py 또는 사용자 측에서 처리).
- 커밋 후 force push, reset, rebase 같은 history 조작을 하지 마라. 이유: 검증 단계에서 회복 가능 상태 유지.
