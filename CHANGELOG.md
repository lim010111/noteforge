# Changelog

본 프로젝트는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며, [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

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

[0.2.0]: https://github.com/lim010111/obsidian-blog/releases/tag/v0.2.0
[0.1.0]: https://github.com/lim010111/obsidian-blog/releases/tag/v0.1.0
