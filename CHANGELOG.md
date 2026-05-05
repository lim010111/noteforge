# Changelog

본 프로젝트는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며, [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

(아직 없음)

## [0.8.1] - 2026-05-05

Metadata-only 패치. GitHub repo를 `lim010111/obsidian-blog`에서 `lim010111/noteforge`로 rename하면서 모노레포 내 옛 repo URL과 사용자 config 컨벤션을 새 브랜드에 맞춰 일괄 정리. privacy 계약 / 빌드 산출물 동작 변경 0줄.

### Changed

- **GitHub repo rename**: `lim010111/obsidian-blog` → `lim010111/noteforge`. 옛 URL은 GitHub의 영구 redirect로 자동 보존. 5개 `package.json`의 `repository` / `homepage` / `bugs` URL, `BaseLayout.astro` 푸터의 source/LICENSE 링크, README/CHANGELOG/CONTRIBUTING/SECURITY/docs의 직접 참조를 모두 새 URL로 갱신.
- **사용자 config 파일명**: `obsidian-blog.config.ts` → `noteforge.config.ts`. `apps/blog`의 실제 파일과 13개 정적 import 경로(설정/lib 5개 + 페이지 8개), CLI help text, 에러/힌트 메시지, 테스트 fixture, 문서 가이드를 새 이름으로 통일.

### Deprecated

- **legacy config 파일명** (`obsidian-blog.config.{ts,mjs,js}`): `@noteforge/cli`의 `loadConfig`는 한 minor 동안 옛 이름도 계속 발견하되, 매칭 시 `process.stderr`로 1회 deprecation warning을 출력. 다음 minor 릴리스에서 lookup 배열에서 제거 예정.

### Privacy / Security

- privacy 코어 변경 0줄. 모든 검증 동작(`isPublic`, `private/**` tripwire, frontmatter allowlist, `%%...%%` 강제 제거, transclusion / link rewriter, attachment closure)은 v0.8.0과 동일.

## [0.8.0] - 2026-05-04

릴리스 준비 sweep. 새 기능 추가 없이 (1) repo 정리, (2) privacy 단일 소스 강화, (3) OSS-readiness 메타데이터 정렬을 한 번에 묶었다. 모든 패키지의 `version`을 `0.0.0` → `0.8.0`으로 일괄 bump해 git tag와 정합. privacy 계약은 한 줄도 바뀌지 않았으며, defense-in-depth 가드를 한 곳 추가했다.

### Added

- **`SECURITY.md`** — 신규. `noteforge`의 privacy 계약을 1순위 보안 이슈로 정의하고, GitHub private vulnerability reporting을 단일 채널로 안내. 합성 fixture 기반 재현 가이드 포함(canary 사용).
- **`CODE_OF_CONDUCT.md`** — 신규. Contributor Covenant v2.1 채택 사실과 본 프로젝트 한정 운영 사항(scope · 보고 채널 · 채택 일자)만 기록.
- **`README.ko.md`** — 신규. 기존 한국어 README를 분리해 한·영 양 버전을 갖춤.
- **`docs/adr/0011-chromatic-palette-expansion.md`** — `docs/ADR.md`에 인라인되어 있던 v0.3 팔레트 확장 결정을 standalone ADR 파일로 백필.
- **`docs/adr/0012-folder-routing-trailing-slash.md`** — v0.3 폴더 라우팅 전략 결정을 standalone ADR 파일로 백필.
- **Hero background-image defense-in-depth** (`@noteforge/theme-default`): 노트 hero 배경이 attachment closure 외 자원을 가리키는 경우 렌더 단계에서 차단하는 가드 추가. 기본 게이트는 여전히 loader / pipeline에 있고, 이 가드는 후행 회귀 보호용.

### Changed

- **`resolvePublicImageFrontmatter`를 `@noteforge/core`로 이동** — `cover` / `thumbnail` frontmatter의 `/attachments/<rel>` 값을 public attachment closure로 게이트하는 로직이 `astro-integration` loader와 `theme-default`의 `heroBackground.ts`에 이중 정의되어 있던 것을 core의 단일 함수로 통합. 호출부는 import만 갱신.
- **LICENSE** — `Copyright (c) 2026 woohyun` → `Copyright (c) 2026 woohyun and noteforge contributors`.
- **모든 `package.json`에 `author` / `keywords` 추가** — npm 메타데이터 보강. 루트 `package.json`에는 추가로 `repository` / `homepage` / `bugs`도 추가.
- **`README.md` 영문 primary로 전환** — badges(license / Node / pnpm / Astro / latest release) + 한국어 링크. privacy 계약과 allowlist를 본문에 명시.
- **`CONTRIBUTING.md`** — "보안 이메일/`SECURITY.md` 채널은 추후 마련 예정" placeholder 제거. 신규 `SECURITY.md` / `CODE_OF_CONDUCT.md`로의 상호 참조 추가.
- **`TODO.md`** — v0.1 MVP step-by-step checklist를 retrospective 한 줄로 축약. v0.2~v0.71 마일스톤도 동일 형식. 현재 열려 있는 v0.8 sweep 항목과 사용자 후속 액션은 명시적으로 분리.
- **`evals/agent-results.json`** — 의도적 빈 placeholder임을 `evals/README.md`에 명시.

### Removed

- **agent scaffolding 정리** — `phases/` 디렉터리, `docs/dev_contexts/`, `ai-readiness` 점수 보드 등 OSS 공개 main 브랜치에 부적합한 작업 산출물을 제거. 보존 가치가 있는 SSOT는 `docs/ADR.md` / `docs/ARCHITECTURE.md` / `docs/UI_GUIDE.md` 등으로 인라인. 원본은 `archive/agent-scaffolding-pre-v0.8` 브랜치에 보관.
- **stale working-tree state 정리** — 리포지토리 루트의 임시 / 미커밋 산출물 정리.

### Privacy / Security

- privacy 코어(`packages/core/src/privacy/**`) 동작 변경 0줄. 모든 핵심 검증(`isPublic`, `private/**` tripwire, frontmatter allowlist, `%%...%%` 강제 제거, transclusion / link rewriter, attachment closure)은 v0.71과 동일.
- 단, `resolvePublicImageFrontmatter`의 단일 소스 통합으로 frontmatter 이미지 게이트의 *호출부 표면*이 좁아짐 — 추후 frontmatter 이미지 정책 변경 시 한 곳만 고치면 모든 어댑터/테마에 반영된다.
- canary 회귀 가드(`DO_NOT_LEAK_BANANA_6f3c1` · `CLAUDE_COMMENT_LEAK_77b` · `FOLDER_TREE_DO_NOT_LEAK_8a4f2`) 모두 빌드 산출물에 0회 등장 검증 유지.

## [0.71.0] - 2026-05-04

### Changed

- **Sidebar leaf-category alignment**: 자식 카테고리만 가지는 leaf-parent 폴더 행에서 chevron 토글을 제거하고, 카테고리 행 우측에 노트 수 배지를 표시. 행 정렬 규칙을 깊이별로 일관시켜 사이드바 시선 흐름을 단순화.
- **Display title casing preservation**: 폴더 라벨과 노트 제목에 원본 대소문자를 그대로 유지(이전에는 슬러그 정규화 단계에서 lower-case로 떨어졌음). 슬러그 자체는 라우팅용으로 lower-case 유지.

## [0.7.0] - 2026-05-03

### Added

- **`nav.mode` 설정** (`@noteforge/core/config`): `'folders'`(기본) 또는 `'categories'`. categories 모드에서는 사이드바와 폴더 인덱스 라우트가 `frontmatter.category`로 집계된 트리에서 파생.
- **`category` frontmatter allowlist 항목**: categories 모드에서 노트의 카테고리를 명시. 미설정 시 `Uncategorized` 섹션으로 폴백.
- **`buildCategoryTree`** (`@noteforge/core`): 노트 컬렉션에서 categories 트리를 집계하는 순수 함수. `nav.mode === 'categories'`일 때 사이드바와 카테고리 인덱스 라우트 양쪽이 동일 헬퍼를 호출.
- **Category-prefixed slug**: categories 모드에서 노트의 슬러그가 `frontmatter.category`로 prefix됨(예: `AI/Claude/foo`). 폴더 기반 URL 멘탈 모델은 그대로 유지.

### Changed

- 사이드바와 폴더 인덱스 라우트가 `nav.mode`에 따라 폴더 트리 또는 카테고리 트리에서 분기. privacy 파이프라인은 한 줄도 바뀌지 않음 — categories 모드도 publishable 집합에서 파생.
- **헤더 정렬 fix**: 사이드바/TOC 그리드 하에서 헤더 inner 정렬이 main 컬럼과 어긋나던 문제 수정. (PR #15)
- 슬러그 세그먼트 정규화에서 공백을 보존하도록 변경 — 한국어/영문 혼용 폴더명에서 가독성 회복.

## [0.6.0] - 2026-05-03

### Added

- **Table of Contents on note pages**: `h2`–`h4` 헤딩에서 자동 추출한 TOC를 lg+ 뷰포트의 우측 컬럼에 표시. 헤딩이 없으면 컬럼 자체 미렌더(empty-state 누설 0). `rehype-slug` + `rehype-autolink-headings`가 만든 stable id를 그대로 사용해 헤딩 앵커와 중복 책임 없음. (PR #14)

### Changed

- BaseLayout 그리드를 사이드바 + main + TOC 3-컬럼 구조로 확장. TOC가 없으면 main이 자연스럽게 폭을 흡수.

## [0.51.0] - 2026-05-02

### Added

- **Dev image picker upload** (`apps/blog`): dev 서버에서 `이미지 설정` 다이얼로그를 통해 cover/thumbnail 이미지를 드래그-드롭, 파일 선택, 클립보드 붙여넣기로 업로드. 업로드는 dev-only `POST /__obpub/upload-attachment`에서 파일 저장 + frontmatter 갱신 + pipeline cache refresh를 한 트랜잭션으로 처리. (PR #13)
- **Attachment upload config**: `attachments.uploadDir`(기본 `attachments`)와 `attachments.uploadMaxBytes`(기본 `10_485_760`) 추가. `private/` 업로드 경로는 tripwire 보호를 위해 기본 거부.
- **Tabbed picker reskin**: 이미지 설정 다이얼로그를 `cover` / `thumbnail` 탭으로 분리, 후보 미리보기 추가.

### Changed

- 공개 노트의 `cover`/`thumbnail` frontmatter가 `/attachments/<rel>`을 단독으로 가리켜도 public attachment closure에 포함됨. private 노트의 frontmatter 참조는 기존 public source gate를 통과하지 못함.
- dev 서버에서 이미지 업로드 후 Content Layer 캐시를 자동 refresh — 다이얼로그를 닫지 않고 업데이트 결과를 즉시 미리보기.

## [0.5.0] - 2026-05-02

### Added

- **KaTeX SSR for `$...$` / `$$...$$`** (`@noteforge/core`): vault의 LaTeX 수식을 빌드 타임에 KaTeX로 렌더. `micromark-extension-math` + `mdast-util-math`를 파이프라인에 연결하고 `rehype-katex`를 hast 단계에서 실행. KaTeX의 CSS와 폰트는 `apps/blog/public/{styles,fonts}/katex/`에 vendored — CDN fetch 0. (PR #12)
- **Image-backed post previews**: 노트 목록(홈 레일, 카테고리 페이지, tag 페이지)에서 cover/thumbnail 이미지를 카드 배경으로 사용. 이미지가 없으면 텍스트-only 카드로 폴백. 모든 이미지 참조는 public attachment closure 게이트 통과 후에만 노출. (PR #11)
- **Vendor scripts**: `scripts/vendor-fonts.mjs`, `scripts/vendor-katex.mjs`. 빌드 전 자동 실행(`pnpm vendor:assets`). zip 파일을 동시에 커밋해 외부 다운로드 없이 재현 가능.

### Changed

- **Type triad → single family**: Source Serif 4 / Inter / JetBrains Mono / Noto Serif KR / Pretendard / D2Coding / RIDIBatang 7종 → **Noto Sans KR 단일** + 시스템 mono. `--font-sans` / `--font-serif` 토큰은 동일 값으로 폴드(약 50개 callsite를 손대지 않음). 위계는 weight + size로만 표현. (PR #12)
- **Preload list 축소**: 3 파일(Inter / SourceSerif4 / RIDIBatang) → 1 파일(NotoSansKR-Regular). Bold는 above-the-fold가 아니므로 lazy 유지.

### Removed — v0.1 Known limitations resolved in v0.5

- KaTeX 미지원 — 구현 완료. (Obsidian Callouts, Mermaid는 여전히 inert 렌더)

## [0.4.0] - 2026-04-29

### Added

- **Categories overview** (`/categories`): 폴더 트리 평탄화 → 섹션별 카드 그리드. `Uncategorized` 섹션은 항상 맨 끝 고정. 카테고리 accent 5슬롯 (`pickCategoryAccentSlot`) 활용.
- **About page** (`/about`): identity (author / nickname / avatar / social) + 선택적 `site.about` 컨텐츠 (headline / bio[] / highlights[]). `site.about`이 비어있어도 identity만으로 의미 있게 렌더.
- **`site.about` config schema** (`@noteforge/core/config`): `aboutSchema` (headline?, bio[], highlights[]) optional. 빈 문자열 / 잘못된 타입 거부.
- **`SocialLinks` 컴포넌트** (`@noteforge/theme-default`): 헤더 액션 + About identity에서 공통 사용. presence-based 렌더.
- **`buildCategoryOverviewSections`** payload helper (`apps/blog/src/lib/categoryOverviewPayload.ts`): `FolderNode + dateBySlug → CategoryOverviewSection[]` (case-insensitive 섹션 정렬, 노트 date desc + href asc, `Uncategorized` 마지막).
- **`OBPUB_VAULT_PATH` 환경변수 + `.env.example`**: vault 경로를 `apps/blog/obsidian-blog.config.ts` 하드코딩에서 분리. Node 22+의 `process.loadEnvFile()`로 zero-dep `.env` 로딩, 누락 시 한국어 에러 메시지 (cp 가이드 포함). fork 사용자가 config.ts를 손대지 않고 본인 vault만 바꾸면 됨.

### Changed

- **상단 네비게이션**: `notes / tags / graph` → `Home / Categories / About` (desktop + mobile drawer 동일 적용).
- **README 빠른 시작 §3**: "config.ts 직접 편집" → "`cp .env.example .env` 후 `OBPUB_VAULT_PATH` 입력".
- **README 배포 섹션**: Cloudflare Pages 단일 서술 → 2행 호스팅 표(Cloudflare 권장 + GitHub Pages 대안) + 정책 한 줄("빌드는 로컬, 호스트는 자유"). Vercel/Netlify는 한 줄 언급 + `docs/DEPLOY.md` §9 cross-link.
- **`docs/DEPLOY.md` §9 부록 추가**: GitHub Pages / Vercel / Netlify 절차 (§1–8 무수정).
- **`BaseLayoutProps.ogType`**: `'website' | 'article'` → `'website' | 'article' | 'profile'` (About 페이지 OpenGraph profile object 지원).

## [0.3.0] - 2026-04-29

v0.2 dogfood 결과로 사이드바 · 폴더 트리 · 홈 레일 · 아이덴티티(AvatarBlock) 도입. privacy 계약 · 정적 출력 계약 · 접근성은 v0.2와 동일하게 유지.

### Added

- 좌측 사이드바 + 폴더 트리(데스크톱 lg+ 상시 / 모바일 햄버거 드로어). JS-less `<details>` 토글 + ARIA `<nav aria-label="Folder tree">` + `aria-current="page"`.
- AvatarBlock — `obpubConfig.site.avatar`(상대 경로만, 외부 호스트 차단) + `nickname`. 둘 다 미정의 시 블록 미렌더(empty-state 누설 0).
- 홈 두 레일 — Recent(`n=10`) + Featured(`featured: true` frontmatter, `n=6`). featured 0개 시 섹션 자체 미렌더.
- 폴더 인덱스 페이지 — `/<path/with/slashes>/`. 폴더↔노트/alias 슬러그 충돌은 빌드 타임 throw.
- 토큰 확장 — 보조 accent 1개(`--color-accent-2`/-hover/-soft, forest moss) + 카테고리 accent 5 슬롯(`--color-accent-cat-1..5`, iron oxide / ochre / moss / bronze / slate, 모두 warm earth tone) + 새 surface tier(`--color-bg-sidebar`, 라이트/다크 양쪽). 카테고리 accent는 첫 슬러그 segment FNV-1a 결정성 매핑.

### Changed

- `trailingSlash: 'never'` → `'always'`. canonical URL · OG `og:url` · alias `<meta refresh url=...>` 모두 trailing slash로 정규화.

### Privacy / Security

- 새 canary `FOLDER_TREE_DO_NOT_LEAK_8a4f2` 도입. 기존 `DO_NOT_LEAK_BANANA_6f3c1` · `CLAUDE_COMMENT_LEAK_77b` + 새 canary 모두 빌드 산출물에 0회 등장 검증.
- `siteSchema.avatar`는 `http://` · `https://` · `//cdn` · `data:` 모두 거부 — fork 사용자 실수로 외부 자산 로드 불가.
- privacy 코어(`packages/core/src/privacy/**`) 수정 0줄.

### Docs

- `docs/UI_GUIDE.md` v0.3 전면 개정. v0.2 백업: `docs/UI_GUIDE.v0.2.md`.
- `docs/ARCHITECTURE.md`에 사이드바 · 폴더 라우팅 섹션 추가.
- ADR 2건(ADR-011, ADR-012) — 팔레트 확장 / 폴더 라우팅 전략(`trailingSlash` + 충돌 throw).

## [0.2.0] - 2026-04-26

v0.1 도그푸드 결과로 디자인을 distinctive · production-grade로 전환한 디자인 대대적 개편 + 배포 인프라 정착 릴리스. privacy 계약·접근성·정적 출력 제약은 v0.1과 동일하게 유지.

### Added — Design overhaul (Step 9)

- **Dual-theme tokens** — `tokens.css` 라이트/다크 동시 정의(`:root` + `[data-theme="dark"]` + `prefers-color-scheme`). FOUC 방지용 inline `theme-init` script 1개와 `localStorage` 토글이 라이트/다크 영속화를 담당.
- **Self-host font triad** — Source Serif 4 / Inter / JetBrains Mono(영문) + Noto Serif KR / Pretendard / D2Coding(한글) 모두 `apps/blog/public/fonts/` self-host(외부 CDN 금지).
- **Iron-oxide 단일 액센트** — `#a83612` 라이트 / `#f0a373` 다크. 보라/인디고 금지 정책 유지.
- **Editorial-technical 레이아웃** — 헤더의 mono 브랜드 마크 + uppercase 내비, JS-less `<details>` 모바일 메뉴, `lg+`에서 12rem 사이드 마진 컬럼.
- **Heading anchors** — `h2`–`h4`에 stable id + autolink `#` 앵커(`rehype-slug` + `rehype-autolink-headings`, behavior `append`).
- **Dual-theme code blocks** — Shiki light/dark 동시 하이라이트(테마 토글 시 즉시 전환).
- **Component visual refresh** — Backlinks/TagList/TagPage/Graph/NotFound 모두 토큰 기반 BEM 클래스(`.backlinks*`/`.tag-*`/`.graph*`/`.not-found*`)로 재정렬, hex 0회. Graph SVG는 `.graph__node*` 클래스로 라이트/다크 자동 추상화.
- **`docs/UI_GUIDE.md` v0.2 전면 개정** — 14절(Privacy 시각 계약 — 시각 레이어가 데이터 레이어의 privacy 보장을 우회 못 함을 명문화).
- **`docs/UI_GUIDE.v0.1.md`** — v0.1 톤(미니멀 라이트, system font) 보존본.
- **Phase 산출물** — `phases/step9-design-overhaul/design/{MOODBOARD,TOKENS,COMPONENTS,ANTIPATTERNS}.md`(v0.2 시각 디자인 SSOT).

### Added — Deploy + alias (Step 8)

- alias frontmatter → 정적 redirect HTML 생성 (`buildAliasRedirects`, audit redirect 무결성 검증).
- canonical URL + 기본 OG meta(`og:url`, `og:type`, `og:title`, `og:description`, `og:site_name`).
- Cloudflare Pages 배포 가이드(`docs/DEPLOY.md`) + `_headers`(X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- `apps/blog/wrangler.toml`.

### Changed

- 본문 측정폭 65ch → **68ch**(사이드 마진 그리드와 균형). 모바일은 65ch로 다시 좁힘.
- `apps/blog/src/pages/index.astro`/`404.astro` — 잔존 v0.1 Tailwind utility 클래스(`text-zinc-*`, `text-blue-*`)를 토큰 기반 BEM(`.tag-page__*`)으로 정렬, 404의 미사용 `nav` slot fragment 제거.
- 컴포넌트 테스트 — viewport 클래스 어서션을 v0.2 토큰 기반 BEM 클래스 + hex 금지 회귀 가드로 갱신.
- `apps/blog/obsidian-blog.config.ts`의 `site.url`을 placeholder에서 Cloudflare Pages 기본 도메인으로 교체.

### Removed — v0.1 Known limitations resolved in v0.2

- alias frontmatter → canonical URL 정적 redirect HTML 미생성 — 구현 완료.
- Dark mode 부재 — 이중 테마 토큰 + 토글 + FOUC 방지로 구현 완료.
- Heading anchor 호버 `#` UI 부재 — `rehype-autolink-headings` append behavior로 구현 완료.

## [0.1.0] - 2026-04-25

첫 도그푸드 가능 릴리스(MVP). npm 패키지 이름은 안정화 전 변경될 수 있습니다 (Pre-release naming).

### Added

- **Privacy 엔진** (`@noteforge/core`): `isPublic` 분류 + `private/**` tripwire, frontmatter allowlist, 태그 blocklist, `%%...%%` 코멘트 강제 제거, wikilink/transclusion link rewriter (private → strip-to-text, public → 재귀 임베드), 첨부 reference closure, full/filtered 그래프.
- **Astro 통합** (`@noteforge/astro`): Content Layer loader, remark wikilink 브리지, chokidar watcher (의존 그래프 invalidation + 200ms debounce), HMR.
- **테마** (`@noteforge/theme-default`): Tailwind v4 토큰, BaseLayout/Note/Backlinks/TagList/Graph(정적 SVG, 클릭 가능)/404 컴포넌트, 모바일 반응형.
- **CLI** (`@noteforge/cli`): `obpub dev`, `obpub build`, `obpub audit` (`--strict`), `obpub status <file>`. tsup으로 빌드된 단일 바이너리(`dist/bin.js`).
- **앱**: `apps/blog` 도그푸드 사이트 (홈/노트/태그/그래프/api/graph.json/404).
- **CI**: GitHub Actions — install → typecheck → lint → vitest → build → audit.
- **에러 메시지**: config 파싱 실패 + status 입력 오류는 `file:line` 형식 (에디터 cmd-click 호환).
- **테스트**: privacy 모듈 단위 테스트(170+) + 통합 fixture vault(`vault-mixed`) + property-based fuzz (fast-check).
- **문서**: `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`, README threat model.

### Known limitations

다음은 **의도적으로** v0.2 이후로 미뤘습니다 (`docs/PRD.md` MVP scope 참조):

- Obsidian Callouts (`> [!note]`), Mermaid 미지원 (inert code block 렌더). KaTeX는 v0.5에서 지원.
- Block reference (`[[Note#^block-id]]`) 미지원 (heading anchor만).
- Dark mode, RSS, sitemap, OG 이미지, 전문 검색(Pagefind) 없음.
- Alias frontmatter → canonical URL 정적 redirect HTML 미생성.
- `.canvas`, Excalidraw, Dataview 쿼리 실행 미지원.
- 다중 vault 실행 미지원 (스키마는 배열 허용하나 `length > 1`이면 명확한 에러).
- 다국어 i18n 단일 로케일 가정.
- Heading anchor 호버 `#` UI 부재.
- Obsidian 플러그인 래퍼는 v0.3+.

### Acknowledgments

- [Astro](https://astro.build/) — Content Layer API.
- Obsidian — wikilink/transclusion 문법(소프트웨어 자체와는 무관, 상표권은 Dynalist Inc.).
- 영감을 준 선행 프로젝트들: Quartz, Digital Garden, Flowershow.

[0.8.1]: https://github.com/lim010111/noteforge/releases/tag/v0.8.1
[0.8.0]: https://github.com/lim010111/noteforge/releases/tag/v0.8.0
[0.71.0]: https://github.com/lim010111/noteforge/releases/tag/v0.71.0
[0.7.0]: https://github.com/lim010111/noteforge/releases/tag/v0.7.0
[0.6.0]: https://github.com/lim010111/noteforge/releases/tag/v0.6.0
[0.51.0]: https://github.com/lim010111/noteforge/releases/tag/v0.51.0
[0.5.0]: https://github.com/lim010111/noteforge/releases/tag/v0.5.0
[0.4.0]: https://github.com/lim010111/noteforge/releases/tag/v0.4.0
[0.3.0]: https://github.com/lim010111/noteforge/releases/tag/v0.3.0
[0.2.0]: https://github.com/lim010111/noteforge/releases/tag/v0.2.0
[0.1.0]: https://github.com/lim010111/noteforge/releases/tag/v0.1.0
