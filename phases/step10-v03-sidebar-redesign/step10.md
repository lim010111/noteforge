# Step 10: dogfood-screenshots-and-release

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `CHANGELOG.md` (기존 v0.1.0/v0.2.0 항목 형식)
- `README.md`
- `TODO.md` (특히 `## v0.3 — 사이드바·폴더트리·홈·아이덴티티 개편 (Step 10)` 섹션 — 11개 sub-step 체크리스트)
- `phases/step9-design-overhaul/step6.md` 와 `step6-output.json` (v0.2 dogfood-and-screenshots 패턴 — 사용자 액션 핸드오프 형식)
- `docs/DEPLOY.md` (배포 가이드 — `wrangler pages deploy` 명령)
- `docs/UI_GUIDE.md` (step 1 갱신 — v0.3)
- `apps/blog/obsidian-blog.config.ts` (사용자가 avatar/nickname을 추가할 자리)

## 작업

릴리스 마감 step. 코드 변경은 거의 없고 문서/메타데이터/회귀 검증이 중심.

### 1. 전 빌드 + audit 그린

```bash
pnpm -r typecheck && pnpm lint && pnpm test && pnpm --filter blog build && pnpm obpub audit
```

위 5단이 모두 통과. 하나라도 실패하면 stop-the-line — error 또는 blocked로 보고.

### 2. CHANGELOG.md `## v0.3.0` 항목 추가

기존 `## v0.2.0` 위에 새 섹션을 다음 구조로 추가:

```markdown
## v0.3.0 — YYYY-MM-DD

### Added
- 좌측 사이드바 + 폴더 트리(데스크톱 lg+ 상시 / 모바일 햄버거 드로어). JS-less `<details>` 토글 + ARIA `<nav aria-label="Folder tree">` + `aria-current="page"`.
- AvatarBlock — `obpubConfig.site.avatar`(상대 경로만, 외부 호스트 차단) + `nickname`. 둘 다 미정의 시 블록 미렌더(empty-state 누설 0).
- 홈 두 레일 — Recent(`n=10`) + Featured(`featured: true` frontmatter, `n=6`). featured 0개 시 섹션 자체 미렌더.
- 폴더 인덱스 페이지 — `/<path/with/slashes>/`. 폴더↔노트/alias 슬러그 충돌은 빌드 타임 throw.
- 토큰 확장 — 보조 accent 1개 + 카테고리 accent N개 슬롯 + 새 surface tier(라이트/다크 양쪽). 카테고리 accent는 첫 슬러그 segment 결정성 매핑.

### Changed
- `trailingSlash: 'never'` → `'always'`. canonical URL · OG `og:url` · alias `<meta refresh url=...>` 모두 trailing slash로 정규화.

### Privacy / Security
- 새 canary `FOLDER_TREE_DO_NOT_LEAK_8a4f2` 도입. 기존 `DO_NOT_LEAK_BANANA_6f3c1` · `CLAUDE_COMMENT_LEAK_77b` + 새 canary 모두 빌드 산출물에 0회 등장 검증.
- `siteSchema.avatar`는 `http(s)://` · `//cdn` · `data:` 모두 거부 — fork 사용자 실수로 외부 자산 로드 불가.
- privacy 코어(`packages/core/src/privacy/**`) 수정 0줄.

### Docs
- `docs/UI_GUIDE.md` v0.3 전면 개정. v0.2 백업: `docs/UI_GUIDE.v0.2.md`.
- `docs/ARCHITECTURE.md`에 사이드바·폴더 라우팅 섹션 추가.
- ADR 2건 — 팔레트 확장 / 폴더 라우팅 전략(`trailingSlash` + 충돌 throw).
```

날짜는 `git log` 기준 가장 최근 step 완료일자(또는 본 step 실행일).

### 3. README.md 보완

추가:
- `obpubConfig.site.avatar` / `nickname` 사용 예시 1 블록 (path는 `apps/blog/public/avatar.png` 컨벤션).
- 새 스크린샷 자리(placeholder 마크다운 한 줄 — 이미지는 사용자 액션). 기존 v0.2 스크린샷(`docs/screenshots/dogfood.png`)은 그대로 두되 v0.3 자리만 추가.
- 한 줄 노트: "v0.3부터 URL은 trailing slash(`/<path>/`)를 사용합니다 — fork 사용자 마이그레이션 시 외부 링크 정규화에 주의."

### 4. TODO.md 마감

`## v0.3 — 사이드바·폴더트리·홈·아이덴티티 개편 (Step 10)` 섹션의 11 sub-step 체크박스를 *모두 `[x]` 로* 변경.

### 5. CLAUDE.md canary 목록 갱신 (선택)

기존 canary 2종이 명시된 줄에 `FOLDER_TREE_DO_NOT_LEAK_8a4f2`를 추가. 이 변경은 *문서 수준*이며 기능 회귀 위험 0. 다만 CLAUDE.md는 모든 step에 자동 주입되므로, 나중에 새 phase에서 같은 canary 검증이 SSOT로 작동.

```diff
-canary(`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`)
+canary(`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, `FOLDER_TREE_DO_NOT_LEAK_8a4f2`)
```

### 6. 사용자 액션 블록

CHANGELOG/TODO 마감 직후, 명확한 "사용자 액션" 블록을 step의 최종 summary에 포함시킨다. 사용자가 본인 vault 환경에서 다음을 *직접* 해야 함:

```bash
# 1. 본인 vault에서 v0.3 dogfood
git checkout feat-step10-v03-sidebar-redesign
pnpm install
pnpm --filter blog dev   # 시각 검증

# 2. 스크린샷 캡처 후 docs/screenshots/dogfood-v0.3-{light,dark}.png 추가

# 3. avatar/nickname 사용 시
# apps/blog/public/avatar.png 추가, obsidian-blog.config.ts에 site.avatar/nickname 입력

# 4. 태그 + 배포
git tag -a v0.3.0 -m "v0.3.0 — sidebar + folder routing + home rails"
git push origin v0.3.0
pnpm --filter blog build
wrangler pages deploy apps/blog/dist
```

이 4단계 중 어떤 것도 본 step에서 *대신 실행하지 않는다*. 본 step은 보고만.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm obpub audit

# 3종 canary 모두 dist에 0회 (triple canary check)
test "$(grep -rc 'DO_NOT_LEAK_BANANA_6f3c1'      apps/blog/dist | awk -F: '{print $2}' | sort -u)" = "0"
test "$(grep -rc 'CLAUDE_COMMENT_LEAK_77b'       apps/blog/dist | awk -F: '{print $2}' | sort -u)" = "0"
test "$(grep -rc 'FOLDER_TREE_DO_NOT_LEAK_8a4f2' apps/blog/dist | awk -F: '{print $2}' | sort -u)" = "0"

# step8 ops 회귀 가드 — 모든 페이지의 canonical/og:url/alias-refresh url이 / 로 끝남
# (step 6 AC의 node 스크립트 재실행 — 단순화 grep도 충분)

# CHANGELOG/README/TODO 마감 sanity
grep -c '## v0.3.0' CHANGELOG.md   # ≥ 1
grep -c 'avatar'    README.md       # ≥ 1
! grep -E '^- \[ \] Step [0-9]+: .*v0\.3' TODO.md   # v0.3 미체크 항목 0
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 단계 통과.
2. 릴리스 체크리스트:
   - CHANGELOG `## v0.3.0` 섹션이 Added/Changed/Privacy/Docs 4 카테고리로 작성?
   - README에 avatar/nickname 사용법 + trailingSlash 마이그레이션 노트?
   - TODO.md v0.3 11개 sub-step 모두 `[x]`?
   - CLAUDE.md canary 목록 갱신 (선택)?
3. 사용자 액션 블록이 step summary에 포함됨?
4. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 10을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "v0.3.0 릴리스 마감 — typecheck/lint/test/build/audit 5단 그린, 3종 canary dist 0/0/0, CHANGELOG v0.3.0(Added/Changed/Privacy/Docs) + README avatar/nickname/trailingSlash 노트 + TODO v0.3 11/11, CLAUDE.md canary 목록 갱신. 사용자 액션: dogfood 스크린샷 + git tag v0.3.0 push + wrangler pages deploy."`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- `git tag`나 `git push origin v0.3.0`을 실행하지 마라. 이유: 사용자 본인 명의 + 사용자 vault dogfood 검증 후가 적절한 타이밍 — 자동 태그는 본인 명의 위반.
- `wrangler pages deploy`나 어떤 형태의 배포 명령도 실행하지 마라. 이유: 배포는 사용자 환경(wrangler 인증 + Cloudflare 계정)이 필요하고 외부 visible 행동.
- 스크린샷이 *자동 캡처*된 척 보고하지 마라. 이유: 본인 vault에 public 노트가 충분히 있어야 의미 있는 스크린샷이 됨 — fixture vault만으로는 v0.3 시각 효과(폴더 트리 깊이/카테고리 accent/Recent/Featured 레일)를 보여줄 수 없다.
- 3종 canary grep 어서션 중 하나라도 누락하지 마라. 이유: triple canary check는 v0.3의 privacy 회귀 최후 가드.
- step8 ops 회귀(canonical/og/alias-refresh trailing slash) 검증을 누락하지 마라. 이유: trailingSlash 전환의 cascading 영향이 step6에서 잡혀야 하지만, step10은 *최후 보루*다.
- `packages/core/src/privacy/**`을 수정하지 마라.
