# Changelog

본 프로젝트는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며, [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [Unreleased]

### Changed
- UI guide rewritten for v0.2 design overhaul — editorial-technical 방향(라이트/다크 듀얼 모드, serif/sans/mono triad self-host, iron-oxide 단일 액센트, 사이드 마진 그리드). v0.1 보존본은 `docs/UI_GUIDE.v0.1.md`로 백업.

## [0.2.0] - 2026-04-26

### Added
- alias frontmatter → 정적 redirect HTML 생성 (`buildAliasRedirects`, audit redirect 무결성 검증).
- canonical URL + 기본 OG meta(`og:url`, `og:type`, `og:title`, `og:description`, `og:site_name`).
- Cloudflare Pages 배포 가이드(`docs/DEPLOY.md`) + `_headers`(X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- `apps/blog/wrangler.toml`.

### Changed
- `apps/blog/obsidian-blog.config.ts`의 `site.url`을 placeholder에서 Cloudflare Pages 기본 도메인으로 교체.

### Removed (Known limitations)
- alias frontmatter → canonical URL 정적 redirect HTML 미생성 — 본 릴리스에서 구현됨.

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
