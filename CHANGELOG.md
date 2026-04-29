# Changelog

본 프로젝트는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며, [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

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

- Obsidian Callouts (`> [!note]`), KaTeX, Mermaid 미지원 (inert code block 렌더).
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

[0.4.0]: https://github.com/lim010111/obsidian-blog/releases/tag/v0.4.0
[0.3.0]: https://github.com/lim010111/obsidian-blog/releases/tag/v0.3.0
[0.2.0]: https://github.com/lim010111/obsidian-blog/releases/tag/v0.2.0
[0.1.0]: https://github.com/lim010111/obsidian-blog/releases/tag/v0.1.0
