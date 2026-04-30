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

## v0.2 — 디자인 대대적 개편 (Step 9) ✅

v0.1의 미니멀("읽기 우선 · 장식 없음 · SaaS 클리셰 금지") 톤은 의도된 결정이었으나, 도그푸드 결과 사용자 결정으로 v0.2에서는 **distinctive · production-grade** 시각 디자인으로 전환한다. 단, privacy 계약(allowlist · tripwire · transclusion 처리)·접근성(`prefers-reduced-motion`·focus outline·WCAG AA)·정적 출력 제약은 그대로 유지.

설계 강제: phase의 첫 step에서 반드시 `affaan-m-everything-claude-code-frontend-design` 스킬을 호출해 무드보드 · 컴포넌트 카탈로그 · 토큰 시스템(라이트/다크 동시)을 잡고 산출물을 phase 디렉토리에 보존한다.

- [x] Step 0: design-direction (frontend-design 스킬 호출 → 무드보드 + 색·타이포·spacing 토큰 + 컴포넌트 시안. v0.1 안티패턴 중 어떤 것을 완화/유지할지 명시)
- [x] Step 1: ui-guide-rewrite (`docs/UI_GUIDE.md` 전면 개정 — v0.2 톤·다크모드·금지/허용 목록 갱신, v0.1 보존본은 `docs/UI_GUIDE.v0.1.md`로 백업)
- [x] Step 2: tokens-and-base (theme-default `tokens.css`/`base.css` 재구성, dark mode 토큰 + `prefers-color-scheme` 스위치)
- [x] Step 3: layout-and-nav (BaseLayout 재설계 — 헤더/푸터/네비게이션·모바일 메뉴)
- [x] Step 4: note-and-prose (`Note.astro` 본문 타이포·코드블록·인용·이미지 처리, heading anchor 도입)
- [x] Step 5: backlinks-tags-graph (Backlinks/TagList/Graph 시각 개편)
- [x] Step 6: dogfood-and-screenshots (apps/blog 시각 검증, audit/typecheck/test 회귀 0; canary 0/0; CHANGELOG/README/TODO 마감. 스크린샷 캡처는 사용자 액션 — 본인 vault에서 노트를 `public: true`로 발행한 뒤 v0.2 dogfood 페이지를 캡처해 `docs/screenshots/`에 추가)

## v0.3 — 사이드바·폴더트리·홈·아이덴티티 개편 (Step 10) ✅

v0.1 → v0.2를 거친 dogfood 결과, 사용자가 현재 디자인을 "처참하다"고 평가하며 대대적인 프론트엔드 개편을 요청. 참조 와이어프레임은 `main_page.png`(좌측 사이드바 + 아바타/닉네임 + 폴더 트리, 우측 Recent + 커스텀 Post 모음)와 `parent_page.png`(폴더 이름 클릭 시 폴더 인덱스 페이지). 와이어프레임은 구조 참고용이고 시각은 "훨씬 더 컬러풀하고 세련" — v0.3 마일스톤으로 토큰 확장 허용.

v0.2의 editorial-technical 골격(serif/sans/mono triad, hairline border)은 유지하면서 (1) **vault 폴더 구조를 그대로 노출하는 좌측 사이드바**, (2) **로컬 아바타+닉네임 아이덴티티 블록**, (3) **Recent + Featured 두 레일로 구성한 홈**, (4) **카테고리 강조와 보조 chromatic accent를 도입한 더 컬러풀한 팔레트**를 더한다. v0.2 ANTIPATTERNS 금지 조항(글래스 모피즘·gradient orb·균일 pill·보라/인디고 SaaS 클리셰·다단 그림자)은 그대로 유지하되 **컬러 확장**과 **추가 surface tier**는 허용 — TOKENS/UI_GUIDE는 v0.3로 개정하고 v0.2 사본은 백업.

privacy 계약(`packages/core/src/privacy/`, `filterPublishable()`, `private/**` tripwire, frontmatter allowlist)은 한 줄도 바꾸지 않는다. 사이드바 폴더 트리도 동일한 publishable 집합에서 파생되므로 private-only 폴더는 트리에서 자연스럽게 사라진다(시각 단계 책임 0).

설계 강제: 첫 step에서 반드시 `affaan-m-everything-claude-code-frontend-design` 스킬을 호출해 사이드바·홈 레일·아바타 블록·확장 팔레트의 무드보드 + 컴포넌트 시안 + 토큰 델타 4종을 `phases/step10-v03-sidebar-redesign/design/`에 보존한다(v0.2 패턴과 동일).

사용자 결정 사항(plan 단계에서 확정):
- 커스텀 Post 모음 = `featured: true` 프론트매터 (이미 allowlist에 존재 — 새 메커니즘 0)
- 사이드바 = 데스크톱 lg+ 상시 노출 + 모바일 햄버거 드로어
- 디자인 = v0.3 마일스톤으로 토큰 확장 허용 (보조 accent · 카테고리 accent · surface tier 추가)
- 폴더 인덱스 URL = `/AI/Claude/` 형태 (`trailingSlash: 'always'` 전환)

- [x] Step 0: design-direction-v0.3 (frontend-design 스킬 호출 → MOODBOARD/TOKENS/COMPONENTS/ANTIPATTERNS 4종 산출. 코드 변경 0)
- [x] Step 1: docs-rewrite-and-backup (`UI_GUIDE.md` → `UI_GUIDE.v0.2.md` 백업 후 v0.3 재작성, ARCHITECTURE에 사이드바·폴더 라우팅 섹션, ADR 2건 추가 — 컬러 확장 + 폴더 라우팅 전략)
- [x] Step 2: tokens-and-config-extension (`tokens.css` v0.3 델타 적용 + `siteSchema`에 `avatar?`/`nickname?` 추가 — 외부 호스트 차단 검증 포함, `apps/blog/public/avatar.*` 자산 컨벤션)
- [x] Step 3: folder-tree-data-model (TDD) (`apps/blog/src/lib/folderAggregation.ts` `buildFolderTree(entries) → FolderNode`, 7~8 케이스 — 깊이 3·private 부재·draft 제외·정렬 안정성·슬러그 충돌)
- [x] Step 4: sidebar-and-avatar-components (`AvatarBlock.astro` + `FolderTree.astro` + `Sidebar.astro` 신규. `<details>` 기반 JS-less 토글, 폴더 이름 링크와 `▶` 토글 영역 분리, ARIA tree role)
- [x] Step 5: base-layout-grid-integration (BaseLayout grid 재배치 lg+ `[16rem | 1fr]` / 모바일 단일 컬럼 + 사이드바 드로어. 신규 props `sidebar?: { folderTree, activeSlug?, avatarSrc?, nickname? }`. 펼침 상태 영속화 안 함)
- [x] Step 6: folder-index-route-and-collision (`trailingSlash: 'never'` → `'always'` 전환, `[...slug].astro`에 `kind: 'folder-index'` 분기 + alias·노트·폴더 prefix 충돌 빌드 타임 throw, 신규 `FolderIndex.astro`)
- [x] Step 7: home-recent-and-featured-rails (홈 두 레일. `selectRecent(n=10)` + `selectFeatured(n=6)` 헬퍼. featured 0개면 레일 전체 숨김 — empty-state 누설 0)
- [x] Step 8: wire-sidebar-into-all-routes (`apps/blog/src/lib/sidebarPayload.ts` 헬퍼로 모든 라우트(`[...slug]`, `tags/*`, `graph`, `404`)에 사이드바 props 일괄 주입)
- [x] Step 9: privacy-tdd-and-fixtures (`vault-mixed`에 폴더 케이스 4종 추가, 신규 canary `FOLDER_TREE_DO_NOT_LEAK_*` 도입, 폴더-노트 충돌 케이스 e2e)
- [x] Step 10: dogfood-screenshots-and-release (typecheck/lint/test/build/audit 모두 통과, CHANGELOG v0.3.0, README에 avatar/nickname 사용법, 스크린샷 캡처는 사용자 액션)

### v0.3 트리키한 결정 사항 (구현자 참고)

| 결정 | 채택값 | 근거 |
|---|---|---|
| 폴더-노트 슬러그 충돌 | 빌드 타임 throw | alias 충돌 가드와 동일 패턴, silent override는 노트 누락 위험 |
| `trailingSlash` | `'never'` → `'always'` | 폴더 인덱스 URL과 노트 URL을 한 규칙으로 통일하면 충돌 면 축소 |
| `buildFolderTree` 위치 | `apps/blog/src/lib/folderAggregation.ts` | 입력이 Astro CollectionEntry, core 재사용 가치 낮음 |
| 사이드바 펼침 상태 영속화 | 영속화 안 함(`<details>` native + activeSlug 자동 open) | privacy-first + 정적 출력 + 직관 충돌 없음 |
| 모바일 드로어 메커니즘 | 기존 `<details class="mobile-menu">`와 동일 패턴 | 새 JS 0 |
| 아바타/닉네임 전달 경로 | `obpubConfig.site.{avatar,nickname}` → BaseLayoutProps | 페이지가 이미 collection을 읽고 있어 props 한 단계로 흘림 |
| featured 레일 cap | 6, named const | 0개면 레일 전체 숨김 |
| 카테고리 accent 매핑 | 첫 slug segment → 토큰 1개. 미매핑은 기본 accent | vault-agnostic 의미 중립 |

## v0.4 — nav 교체 + Categories/About + site.about (Step 11) ✅

v0.3 dogfood 결과로 사용자가 상단 nav를 일반 블로그 컨벤션(`Home / Categories / About`)에 맞추고 각 메뉴를 동작하는 페이지로 구현하길 요청. 별도 런타임 설정 UI는 만들지 않고 About 컨텐츠도 기존 `obsidian-blog.config.ts`(=`site.social.github`/`site.social.email`이 사는 자리)에서 관리한다. 추가로 코드 리뷰에서 vault 경로 하드코딩 문제가 드러나 `OBPUB_VAULT_PATH` 환경변수로 분리 — fork 사용자가 `config.ts`를 손대지 않고 `.env`만 채우면 됨.

privacy 계약(`packages/core/src/privacy/**`, `filterPublishable()`, `private/**` tripwire, frontmatter allowlist)은 한 줄도 바꾸지 않는다. Categories 페이지도 사이드바와 동일하게 publishable 집합에서 파생된 `FolderNode`를 평탄화해 사용 — private는 시각 단계에서 자연스럽게 사라진다(시각 단계 책임 0). 기존 `/tags`, `/graph` 라우트는 페이지·기능 유지하고 상단 메뉴에서만 제거(노트 본문 태그 칩은 그대로 `/tags/[tag]` 동작). plan SSOT는 `docs/dev_contexts/nav_categories_about.md`.

사용자 결정 사항:
- About 컨텐츠 소스 = `obsidian-blog.config.ts`의 `site.about` (별도 설정 UI 페이지 없음)
- Categories 레이아웃 = flat (최상위 폴더가 H2, descendant 모두 평탄화). vault 루트 노트는 `Uncategorized` 섹션
- Nav 텍스트 = 영문(`Home / Categories / About`) — 사이드바·footer 카피와 일치
- Categories 정렬 = 폴더명 case-insensitive, `Uncategorized` 항상 맨 끝. 노트는 date desc → slug asc
- About 스키마 = 구조화 필드(`headline?` / `bio[]` / `highlights[]`). markdown 파서 미도입 (표현력 부족 시 후속 PR)

### Feature 작업 (phase11 진입 전 working tree)

- [x] `siteSchema.about` 추가 — `aboutSchema` (`headline?` / `bio[]` / `highlights[]`) optional + 6 test (`packages/core/src/config.ts`, `packages/core/tests/config.test.ts`)
- [x] Nav 교체 — desktop + mobile drawer 동일 (`notes/tags/graph` → `Home/Categories/About`) (`packages/theme-default/src/layouts/BaseLayout.astro`)
- [x] `BaseLayoutProps.ogType` 유니온에 `'profile'` 추가 (About 페이지 OpenGraph profile object 지원)
- [x] `CategoryOverview.astro` + types — 섹션 리스트 렌더 (순수 렌더, privacy 책임은 caller)
- [x] `AboutPage.astro` + types — Identity + Headline + Social + Bio + Highlights 렌더 (`site.about`이 비어있어도 identity만으로 의미 있게 렌더)
- [x] `SocialLinks.astro` + types — 헤더 액션 + About identity 공통 사용 (presence-based 렌더)
- [x] `buildCategoryOverviewSections` payload helper — `FolderNode + dateBySlug → CategoryOverviewSection[]` + 6 unit test (`apps/blog/src/lib/categoryOverviewPayload.ts`, `apps/blog/tests/categoryOverviewPayload.test.ts`)
- [x] `/categories` 페이지 — FolderNode + dateBySlug → CategoryOverviewSection 평탄화
- [x] `/about` 페이지 — `site.author/nickname/avatar/social` + `site.about`으로 AboutPage 호출
- [x] `OBPUB_VAULT_PATH` 환경변수 분리 — Node 22+의 `process.loadEnvFile()`로 zero-dep `.env` 로딩, 누락 시 한국어 에러 throw (cp 가이드 포함). `.env.example` 신규 (`apps/blog/obsidian-blog.config.ts`, `.env.example`)
- [x] 기존 5개 페이지(`404`, `[...slug]`, `graph`, `index`, `tags/*`) v0.4 변경분 미세 적용 (BaseLayout 새 props 등)

### Phase11 — `step11-v04-release-prep` (release prep 5 step)

- [x] Step 0: commit-split-4 (5커밋 분리 — `docs(plan)` / `feat(core)` / `feat(theme)` / `feat(blog)` pages / `feat(blog)` envvar. 27 파일 +1384/-58)
- [x] Step 1: verify-build-test-audit (5단 그린 — typecheck 5pkgs / lint / test 619 / build 19 pages / audit 0 violations 38 files. canary 0/0/0)
- [x] Step 2: readme-deploy-section (정책 한 줄 + 2행 호스팅 표 Cloudflare 권장/GitHub Pages 대안 + Vercel/Netlify 1줄 + DEPLOY.md §9 cross-link 3개)
- [x] Step 3: deploy-md-other-hosts (`docs/DEPLOY.md` §9 부록 append — 9.1 GitHub Pages / 9.2 Vercel / 9.3 Netlify, §1–8 무수정)
- [x] Step 4: changelog-and-tag-prep (`CHANGELOG [0.4.0] - 2026-04-29` 엔트리 + reference link)

### v0.4 사용자 후속 액션 (수동)

- [ ] `git tag -a v0.4.0 -m "v0.4.0 — nav swap + Categories/About + site.about" && git push origin v0.4.0`
- [ ] GitHub Release notes 작성 (CHANGELOG `[0.4.0]` 인용 + 'Next' 단락에 후속 트랙 직접 명기)
- [ ] dogfood 스크린샷 캡처 → `docs/screenshots/dogfood-v0.4-{light,dark}.png`
- [ ] (선택) v0.2.0 / v0.3.0 누락 태그 백필 여부 결정 — 백필 시 lightweight tag (예: `git tag v0.3.0 ba928d0`)

### v0.4 트리키한 결정 사항 (구현자 참고)

| 결정 | 채택값 | 근거 |
|---|---|---|
| About 컨텐츠 소스 | `obsidian-blog.config.ts`의 `site.about` | 기존 `site.social` 자리와 동일. 런타임 설정 UI 도입 회피 |
| About 마크다운 파싱 | 미도입, 구조화 필드 (`headline`/`bio[]`/`highlights[]`) | 정적 출력 계약 + 표현력 부족 시 후속 PR |
| 기존 `/tags`, `/graph` 라우트 | 페이지·기능 유지, nav만 제거 | 노트 태그 칩 동작 유지, 회귀 면 0 |
| Categories 레이아웃 | flat (descendant 평탄화) | 최상위 폴더 = vault 카테고리. 깊이 변동 흡수, 사용자 멘탈 모델 단순 |
| `Uncategorized` 위치 | 항상 맨 끝 고정 | 알파벳 정렬 어디 들어가도 의미 충돌. 명시적 fallback이 직관적 |
| Vault 경로 외부화 메커니즘 | `OBPUB_VAULT_PATH` env + `process.loadEnvFile()` | Node 22+ 내장, 의존성 0. fork 사용자 `.env`만 채우면 됨 |
| 누락 시 동작 | 한국어 에러 throw + cp 가이드 | silent fallback은 원인 추적 어려움 — 빌드 실패가 더 안전 |
| brand 텍스트 하드코딩(`noteforge`) | v0.4 scope 외, out of scope 표시 | 실제 `site.title`은 `shine notes` — 별도 PR에서 `obpubConfig.site.title` 흘리는 방식 권장 |
