# TODO

> 출하된 마일스톤은 retrospective 한 줄로 축약. step-by-step 이력은 git log + CHANGELOG.md가 SSOT.

## Shipped

- **v0.1.0** (2026-04-25) — MVP. privacy 엔진(`@noteforge/core`), Astro Content Layer 통합, 레퍼런스 테마, `obpub` CLI(dev/build/audit/status), GitHub Actions CI, MIT 라이선스, 통합 fixture(`vault-mixed`) + property-based fuzz. ([CHANGELOG §0.1.0](./CHANGELOG.md))
- **v0.2.0** (2026-04-26) — Editorial-technical 디자인 대대적 개편 + 배포 인프라. dual-theme tokens / FOUC-방지 / self-host font triad / iron-oxide 단일 액센트 / heading anchors / dual-theme code blocks / alias redirect / canonical+OG / Cloudflare Pages 가이드. ([CHANGELOG §0.2.0](./CHANGELOG.md))
- **v0.3.0** (2026-04-29) — 사이드바·폴더 트리·홈 레일·아이덴티티(AvatarBlock). warm earth tone family 토큰 확장(보조 액센트 1 + 카테고리 슬롯 5 + 사이드바 surface tier). `trailingSlash: 'always'` + 폴더↔노트/alias 충돌 빌드-타임 throw. 신규 canary `FOLDER_TREE_DO_NOT_LEAK_8a4f2`. ([CHANGELOG §0.3.0](./CHANGELOG.md), [ADR-0011](./docs/adr/0011-chromatic-palette-expansion.md), [ADR-0012](./docs/adr/0012-folder-routing-trailing-slash.md))
- **v0.4.0** (2026-04-29) — Top nav 교체(`Home/Categories/About`), `/categories`+`/about` 페이지, `site.about` schema, `OBPUB_VAULT_PATH` env 분리. ([CHANGELOG §0.4.0](./CHANGELOG.md))
- **v0.5.0** (2026-05-02) — KaTeX SSR(`$...$`/`$$...$$`), image-backed post previews, font triad → Noto Sans KR 단일. KaTeX CSS/폰트 self-host. ([CHANGELOG §0.5.0](./CHANGELOG.md))
- **v0.51.0** (2026-05-02) — Dev image picker 업로드 파이프라인(드래그-드롭/파일/클립보드) + tabbed 다이얼로그. `attachments.uploadDir`/`uploadMaxBytes` config. ([CHANGELOG §0.51.0](./CHANGELOG.md))
- **v0.6.0** (2026-05-03) — Note 페이지 우측 TOC 컬럼(`h2`–`h4`). 헤딩 0개 시 컬럼 미렌더. ([CHANGELOG §0.6.0](./CHANGELOG.md))
- **v0.7.0** (2026-05-03) — `nav.mode: 'folders' | 'categories'`. categories 모드는 `frontmatter.category` 집계 트리 + `buildCategoryTree`. 슬러그 공백 보존. ([CHANGELOG §0.7.0](./CHANGELOG.md))
- **v0.71.0** (2026-05-04) — Sidebar leaf-category 정렬(chevron 제거 + 노트 수 배지) + 원본 대소문자 보존. ([CHANGELOG §0.71.0](./CHANGELOG.md))

## v0.8.0 release readiness sweep — done (2026-05-04)

- [x] C1 working-tree 정리
- [x] C2 agent scaffolding(`phases/`, `dev_contexts/`, `ai-readiness`) 제거
- [x] C3 phase SSOT를 surviving docs로 인라인
- [x] C4 `evals/agent-results.json` placeholder 라벨링
- [x] C5 `resolvePublicImageFrontmatter`를 `@noteforge/core`로 이동(privacy DRY)
- [x] C6 hero background-image defense-in-depth
- [x] C7 `SECURITY.md` / `CODE_OF_CONDUCT.md` 신규 + `CONTRIBUTING.md` 갱신
- [x] C8 Identity sweep — LICENSE 컨트리뷰터 표기 + 모든 `package.json`에 `author`/`keywords` 추가
- [x] C9a ADR-0011 / ADR-0012 standalone 파일로 백필
- [x] C9b CHANGELOG v0.5–v0.71 백필 + v0.1 known-limitations 정리
- [x] C10 README EN/KO split + badges
- [x] C11 TODO.md collapse v0.1 MVP
- [x] C12 모든 패키지 `version` `0.0.0` → `0.8.0` bump + CHANGELOG `[0.8.0] - 2026-05-04` finalize

## 사용자 후속 액션 (수동)

- [ ] 누락 태그 백필 여부 결정. 후보: v0.2.0 / v0.3.0 / v0.5.0 / v0.51.0 / v0.6.0 / v0.7.0 / v0.71.0. 백필 시 lightweight tag 권장(예: `git tag v0.3.0 <commit>`)
- [ ] v0.8.0 GitHub Release notes 작성 — CHANGELOG `[0.8.0]` 인용
- [ ] dogfood 스크린샷 캡처 → `docs/screenshots/dogfood-v0.8-{light,dark}.png`
- [ ] (선택) brand 텍스트 하드코딩(`noteforge`)을 `obpubConfig.site.title`로 흘리는 후속 PR (v0.4 트리키 결정 행 §"brand 텍스트")

## Backlog — 알려진 한계 / 미구현

`CHANGELOG §0.1.0 Known limitations` 중 v0.5까지 미해결로 남은 항목 (의도적 후순위).

- Obsidian Callouts (`> [!note]`), Mermaid 미지원 — 현재 inert code block.
- Block reference (`[[Note#^block-id]]`) 미지원 — heading anchor만.
- RSS, sitemap, OG 이미지(자동 생성), 전문 검색(Pagefind) 없음.
- `.canvas`, Excalidraw, Dataview 쿼리 실행 미지원.
- 다중 vault 실행 미지원 (스키마는 배열 허용하나 `length > 1`이면 명확한 에러).
- 다국어 i18n 단일 로케일 가정.
- Obsidian 플러그인 래퍼 (인-app 발행 워크플로) 미구현.

## v0.4 트리키한 결정 (아키텍처 참고용)

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
