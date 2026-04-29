# Step 4: changelog-and-tag-prep

## 컨텍스트

이 phase의 마지막 step. `/CHANGELOG.md`에 `[0.4.0]` 엔트리를 추가하고 사용자 수동 액션(git tag · GitHub Release · dogfood 스크린샷 캡처)을 step output에 명시한다.

v0.2.0 / v0.3.0 누락 태그 백필 여부는 사용자에게 *질문 형식으로* 안내만 함 — 이 step에서 자동 처리 금지.

오늘 날짜: **2026-04-29**.

## 읽어야 할 파일

- `/CHANGELOG.md` — 기존 [Unreleased] / [0.3.0] / [0.2.0] / [0.1.0] 구조와 reference link 위치 확인
- `/docs/dev_contexts/nav_categories_about.md` — Added/Changed 항목 도출 출처
- `/phases/step11-v04-release-prep/step0-output.json`, `step1-output.json`, `step2-output.json`, `step3-output.json` — 각 step summary
- `git log --oneline HEAD~10..HEAD` — Commit 메시지에서 변경 도출

## 작업

### 1. CHANGELOG.md에 [0.4.0] 엔트리 추가

`[Unreleased]` 섹션 바로 아래(즉 `[0.3.0]` 위)에 다음을 삽입:

```markdown
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

[0.4.0]: https://github.com/lim010111/obsidian-blog/releases/tag/v0.4.0
```

배치 규칙:
- `## [0.4.0] - 2026-04-29` 헤더는 `## [Unreleased]` 와 `## [0.3.0]` 사이에 삽입.
- `[0.4.0]: https://...` reference link은 파일 맨 아래 reference link 영역(`[0.3.0]: ...` 등이 있는 곳)에 추가. 만약 reference link 영역이 없다면 파일 끝에 새 영역으로 추가.

후속 트랙(runtime `/settings`, About markdown body parser, brand text 토큰화 등)은 CHANGELOG가 아니라 GitHub Release notes 본문에 별도 'Next' 단락으로 사용자가 직접 작성한다. 이 step에서는 처리하지 않는다.

### 2. 사용자 수동 단계 안내 (step output에 기록)

이 step의 `summary`에 사용자가 수동으로 해야 할 4가지를 명시:

```
사용자 수동 액션:
1. git tag -a v0.4.0 -m "v0.4.0 — nav swap + Categories/About + site.about"
   git push origin v0.4.0
2. GitHub Release notes 작성 (CHANGELOG.md [0.4.0] 인용 + 'Next' 단락에 후속 트랙 항목 직접 명기)
3. dogfood 스크린샷 docs/screenshots/dogfood-v0.4-{light,dark}.png 캡처
4. (선택) v0.2.0 / v0.3.0 누락 태그 백필 여부 결정 — 백필하려면 CHANGELOG 날짜 기준 기존 커밋에 lightweight tag (예: git tag v0.3.0 ba928d0)
```

### 3. 산출물 커밋

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): [0.4.0] 엔트리 추가"
```

## Acceptance Criteria

```bash
test -f CHANGELOG.md
test "$(grep -c '^## \[0\.4\.0\] - 2026-04-29$' CHANGELOG.md)" -eq 1
test "$(grep -c '^\[0\.4\.0\]: ' CHANGELOG.md)" -eq 1
# [0.4.0]이 [0.3.0]보다 먼저 (위에) 나옴
[ "$(grep -n '^## \[0\.4\.0\]' CHANGELOG.md | head -1 | cut -d: -f1)" -lt "$(grep -n '^## \[0\.3\.0\]' CHANGELOG.md | head -1 | cut -d: -f1)" ]
pnpm -r typecheck
pnpm lint
pnpm test
```

조건:
- `## [0.4.0] - 2026-04-29` 정확히 1개
- `[0.4.0]: ` reference link 정확히 1개
- 0.4.0 섹션이 0.3.0 위에
- typecheck / lint / test exit 0

## 검증 절차

1. AC 통과.
2. CHANGELOG의 카테고리가 Keep a Changelog 표준만 사용 (Added/Changed/Deprecated/Removed/Fixed/Security) — `Out-of-scope`, `Roadmap`, `Notes` 같은 비표준 섹션 부재.
3. `[0.4.0]:` reference URL이 v0.3.0과 동일한 `releases/tag/` 패턴을 따름.
4. `git log --oneline HEAD~8..HEAD` 결과:
   - step0의 5커밋 (docs/plan + feat/core + feat/theme + feat/blog-pages + feat/blog-envvar)
   - step2 docs(readme) 커밋
   - step3 docs(deploy) 커밋
   - 본 step의 docs(changelog) 커밋
   총 8커밋이 v0.4 범위에 분포.
5. 결과 갱신 — `phases/step11-v04-release-prep/index.json` step 4:
   - 성공 → `"status": "completed"`, `"summary"`에 위 §2의 사용자 수동 액션 4개 그대로 기록.
   - 실패 → `"status": "error"`, `"error_message": "구체"`

## 사용자 수동 단계 (참고)

이 step 완료 후 사용자가 직접:

```bash
git checkout main
git merge feat-step11-v04-release-prep   # 또는 PR 머지
git tag -a v0.4.0 -m "v0.4.0 — nav swap + Categories/About + site.about"
git push origin v0.4.0
```

step에서 자동 실행하지 마라.

## 금지사항

- `git tag`를 자동 실행하지 마라. 이유: 배포 시점 통제 (사용자 수동).
- v0.2.0 / v0.3.0 누락 태그를 자동 백필하지 마라. 이유: 사용자 결정 사항 (이 step은 안내만).
- CHANGELOG에 미구현 기능을 적지 마라. 이유: Keep a Changelog 규칙 (실제 변경만).
- `Out-of-scope (next)`, `Roadmap`, `Notes` 같은 비표준 카테고리를 추가하지 마라. 이유: Keep a Changelog 표준 카테고리(Added/Changed/Deprecated/Removed/Fixed/Security)만 사용.
- `npm publish`를 실행하지 마라. 이유: 모든 패키지 `private: true` 유지 (별도 결정).
- README threat model / privacy 본문을 약화시키지 마라. 이유: 제품 핵심 약속.
- 스크린샷 실제 이미지 파일을 만들거나 첨부하지 마라. 이유: 사용자 직접 캡처 (도그푸드 신뢰성).
- `Co-Authored-By: Claude` 트레일러를 커밋 메시지에 포함하지 마라. 이유: 전역 CLAUDE.md 규칙.
