# TODO

v0.1 MVP 작업 체크리스트.

## Step 0 — 문서 선행 ✅
- [x] `CLAUDE.md` 실내용 작성
- [x] `docs/PRD.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/ADR.md`
- [x] `docs/UI_GUIDE.md`
- [x] `README.md` 초안

## Step 1 — 루트 monorepo 스켈레톤 ✅
- [x] `.nvmrc` (Node 20)
- [x] `pnpm-workspace.yaml` (`packages/*`, `apps/*`)
- [x] 루트 `package.json`
- [x] `tsconfig.base.json`
- [x] `.gitignore`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`
- [x] ESLint flat config + Prettier
- [x] Vitest 루트 config
- [x] 각 패키지 스켈레톤 (core, astro-integration, theme-default, cli)
- [x] `apps/blog` 스켈레톤
- [x] `pnpm install` 성공, `pnpm -r typecheck` 통과, `pnpm lint`/`pnpm test` 통과

## Step 2 — @noteforge/core privacy 엔진 (TDD) ✅
각 항목은 **실패 테스트 → 통과 구현** 순서. fixture vault는 통합 테스트 직전에 준비.

- [x] `types.ts` — ParsedNote, ClassifyRule, Classification 타입
- [x] `privacy/classify.ts` — isPublic + tripwire (13 tests)
- [x] `tags.ts` — 5가지 태그 포맷 정규화 (20 tests)
- [x] `slug.ts` — 한국어/공백 처리 (18 tests)
- [x] `resolve/wikilink.ts` — case-insensitive 타겟 해석 + aliases (18 tests)
- [x] `privacy/commentStrip.ts` — `%%...%%` 제거 (10 tests)
- [x] `config.ts` — defineConfig + Zod 스키마 + 강제 private ignore + allowlist/blocklist (14 tests)
- [x] `discover/parseNote.ts` — gray-matter + 코멘트 스트리핑 + 태그 추출 (11 tests)
- [x] `discover/walk.ts` — ignore glob 적용 vault walker (9 tests)
- [x] `privacy/frontmatterFilter.ts` — allowlist 필터 (10 tests)
- [x] `privacy/graph.ts` — full/filtered 그래프 (13 tests)
- [x] `privacy/linkRewriter.ts` — wikilink remark plugin (private → strip-to-text) (14 tests)
- [x] `privacy/transclude.ts` — public 임베드 재귀/private 임베드 제거 (cycle detection) (12 tests)
- [x] `privacy/attachmentFilter.ts` — reference closure (11 tests)
- [x] `tests/fixtures/vault-mixed/` 구축 + 통합 테스트 11 assert (`pipeline.ts` + `tests/integration/`)
- [x] Property-based fuzz test (50회, fast-check seed=424242, 5 불변식)

## Step 3 — @noteforge/astro integration ✅
- [x] `integration.ts` — AstroIntegration factory + 훅 등록 (step3a-step2)
- [x] `loader.ts` — Content Layer loader (core 파이프라인 호출) (step3a-step1)
- [x] `remarkWikilink.ts` — MDX 파이프라인 브리지 (step3a-step0)
- [x] `watcher.ts` — chokidar + 의존 그래프 invalidation + 200ms debounce (step3b-step0/1)
- [x] HMR 통합 테스트 (server:setup/done + Vite hot dispatch + e2e coalesce) (step3b-step2)

## Step 4 — @noteforge/theme-default ✅
- [x] Tailwind v4 설정 + tokens.css (UI_GUIDE 참조)
- [x] `BaseLayout.astro` (nav, main, footer, semantic HTML)
- [x] `Note.astro` (prose 본문, 메타, 태그 칩)
- [x] `Backlinks.astro` (필터된 그래프 데이터 입력)
- [x] `TagList.astro` + 태그 인덱스 페이지 로직
- [x] `Graph.astro` (정적 SVG, 노드 클릭 가능)
- [x] 404 페이지 (private 존재 누설 금지 문구)
- [x] 모바일 반응형 점검

## Step 5 — @noteforge/cli ✅
- [x] `bin.ts` + commander/clipanion 진입점
- [x] `commands/dev.ts` (astro dev 래핑)
- [x] `commands/build.ts` (astro build + audit + 종료 리포트)
- [x] `commands/audit.ts` (독립 실행 누출 검증, `--strict` 지원)
- [x] `commands/status.ts` (노트 공개 판정 이유 출력)

## Step 6 — apps/blog 도그푸드 ✅
- [x] `astro.config.mjs` + 통합 등록
- [x] `obsidian-blog.config.ts` (실 vault 절대경로)
- [x] `content.config.ts`
- [x] `pages/index.astro`, `[...slug].astro`, `graph.astro`, `api/graph.json.ts`
- [x] 로컬 빌드 성공 + audit 통과
- [x] Cloudflare Pages / Vercel 배포 (step8에서 처리, docs/DEPLOY.md 참조)

## Step 7 — CI + 릴리스 준비 ✅
- [x] GitHub Actions: install → typecheck → lint → vitest → build → audit
- [x] CLI 빌드 파이프라인 — tsup으로 `dist/bin.js` 생성, `package.json` bin → `dist/bin.js`, `prepublishOnly` 추가 (Node 22 strip-types 의존 제거)
- [x] 에러 메시지 file:line 포함 — config 파싱 실패/status 입력 오류 시
- [x] `LICENSE` (MIT)
- [x] `CONTRIBUTING.md`
- [x] README 보완 (실 설치 가이드, 스크린샷)
- [x] 프로젝트명/npm 네임스페이스 정식 확정 (`noteforge` / `@noteforge/*`)
- [x] v0.1.0 릴리스 노트 작성 (CHANGELOG.md). git tag는 사용자가 직접 푸시:
      `git tag -a v0.1.0 -m "v0.1.0" && git push origin v0.1.0`

## 미결정 / 사용자 확인 필요
- [x] 실 Obsidian vault 절대경로 (Step 6에서 처리)
- [x] 정식 프로젝트명 + npm 네임스페이스 — `noteforge` / `@noteforge/*`
- [x] 배포 도메인 — Cloudflare Pages 기본 도메인(`noteforge.pages.dev`) 사용 (custom domain은 v0.2)

## Step 8 — 배포 + alias redirect ✅
- [x] Step 0: alias-redirect-engine (alias map 산출 함수 + 8 TDD 테스트)
- [x] Step 1: alias-pipeline-integration (core pipeline + Astro loader)
- [x] Step 2: alias-fixture-routes-audit (fixture + [...slug] meta-refresh + audit 규칙 2개)
- [x] Step 3: canonical-url-and-og (BaseLayout canonical + og:* 메타)
- [x] Step 4: cloudflare-pages-ops (wrangler.toml + _headers + docs/DEPLOY.md + site.url + CHANGELOG/README/TODO 갱신)
