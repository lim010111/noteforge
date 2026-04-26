# Step 4: cloudflare-pages-ops

Cloudflare Pages Direct Upload 기반 배포 운영을 셋업하고, v0.1 마무리 메타데이터(README/CHANGELOG/TODO/site.url)를 갱신한다. 코드 변경 최소.

## 읽어야 할 파일

- `apps/blog/obsidian-blog.config.ts` — `site.url`이 현재 `https://example.com` placeholder.
- `apps/blog/astro.config.mjs:8` — `site` 필드 출처.
- `README.md` — "빠른 시작" 섹션 위치, 라인 1과 라인 37의 placeholder, "상태" 섹션.
- `CHANGELOG.md` — `[0.1.0]` 항목 + "Known limitations" 리스트 + 라인 41 placeholder.
- `TODO.md` — Step 6 마지막 항목, "미결정" 섹션.
- `.github/workflows/ci.yml` — 현재 CI 구성 (deploy job 추가하지 마라).
- `.gitignore` — 빌드 산출물 무시 규칙.

## 사용자 입력 (이 step 시작 시점에 반드시 읽기)

`phases/step8-deploy-prep/inputs.md` 를 먼저 읽어 다음 4개 항목의 값을 추출:

1. **Cloudflare Pages 프로젝트명** — `wrangler.toml`의 `name`, `obsidian-blog.config.ts`의 `site.url`(=`https://<project>.pages.dev`) 둘 다에 들어감.
2. **CHANGELOG 버전 라벨** — `0.2.0-alpha` (기본) 또는 `Unreleased`.
3. **GitHub repo URL placeholder 교체값** — `<owner>/<repo>` 형식. `SKIP`이면 placeholder 유지 + `## TODO` 섹션에 기록.
4. **추가 메모** — 빈 값일 수 있음.

`inputs.md` 의 어느 항목이라도 빈 값(또는 `값:` 우측이 공란)이면 즉시 `phases/step8-deploy-prep/index.json`의 step 4 status를 `blocked`로 설정하고 `blocked_reason: "inputs.md not filled"`로 기록 후 중단. 사용자가 inputs.md를 채운 뒤 `/harness resume`으로 재개한다.

`SKIP` 값은 정상 처리(빈 값과 다르다 — 의도적 보류).

값을 모두 받았으면 이하 작업 진행.

## 작업

### A. 신규 파일

#### `apps/blog/wrangler.toml`

```toml
name = "<프로젝트명>"
pages_build_output_dir = "dist"
compatibility_date = "2026-04-25"
```

#### `apps/blog/public/_headers`

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: interest-cohort=()
```

(들여쓰기는 2 spaces. Cloudflare Pages가 `dist/_headers`로 자동 인식 — Astro의 `public/`이 dist 루트로 복사되는 동작.)

#### `docs/DEPLOY.md`

다음 섹션을 한국어로 명확하게 작성:

1. **사전 준비** — `npm i -g wrangler`, `wrangler login` (브라우저 OAuth).
2. **로컬 빌드** — `pnpm install`, `pnpm --filter blog build`. 산출물 `apps/blog/dist/`.
3. **첫 배포** — `wrangler pages deploy apps/blog/dist --project-name=<프로젝트명>`. 첫 실행 시 프로젝트가 없으면 wrangler가 자동 생성(Wrangler v3+).
4. **누출 검증** — `node packages/cli/dist/bin.js audit apps/blog/dist`. fail이면 배포하지 마라.
5. **재배포** — 위 2~4번 반복.
6. **Custom domain** — Pages dashboard → 프로젝트 선택 → Custom domains → 도메인 추가 → Cloudflare DNS에 CNAME. 도메인이 활성화되면 `apps/blog/obsidian-blog.config.ts`의 `site.url`을 새 도메인으로 갱신하고 재빌드·재배포해야 canonical/og 메타가 일관됨.
7. **왜 GitHub Actions 자동 배포를 지원하지 않는가** — `obsidian-blog.config.ts`의 vault 절대 경로(예: `/mnt/c/Users/.../Obsidian`)는 GitHub Actions runner에서 접근 불가. OSS fork 사용자도 동일 패턴으로 자기 머신에서 빌드·배포해야 한다. fork 후 가장 먼저 편집할 파일은 `apps/blog/obsidian-blog.config.ts`의 `vaults[0].path`이다.
8. **CSP 미적용** — 현재 `_headers`는 CSP를 포함하지 않는다. Astro inline style/script 호환성 검증 후 v0.2에서 추가 예정.

### B. 기존 파일 수정

#### `apps/blog/obsidian-blog.config.ts`

라인 6 `url: 'https://example.com'` → `url: 'https://<프로젝트명>.pages.dev'`.

#### `README.md`

- 라인 1 placeholder 주석 + 본문의 `PLACEHOLDER_OWNER/PLACEHOLDER_REPO`를 사용자 답변으로 교체. 사용자가 모르면 그대로 두고 step.md에 후속 TODO로 명시.
- "빠른 시작" 섹션 끝 또는 직후에 "## 배포" 섹션 추가:
  - Cloudflare Pages를 정식 지원으로 명시 + `docs/DEPLOY.md` 링크.
  - `apps/blog/obsidian-blog.config.ts`의 `vaults[0].path`를 자기 vault로 바꿔야 한다는 점 강조.
  - Vercel/Netlify는 한 줄: "정적 출력이라 가능하지만 v0.1에서는 미문서화. v0.2 검토."
- "상태" 섹션의 도메인 미정 줄을 "Cloudflare Pages 도메인 사용 중" 또는 사용자 답변 기준으로 갱신.

#### `CHANGELOG.md`

새 entry를 `[0.1.0]` 위에 추가:

```markdown
## [0.2.0-alpha] - 2026-04-26

### Added
- alias frontmatter → 정적 redirect HTML 생성 (`buildAliasRedirects`, audit redirect 무결성 검증).
- canonical URL + 기본 OG meta(`og:url`, `og:type`, `og:title`, `og:description`, `og:site_name`).
- Cloudflare Pages 배포 가이드(`docs/DEPLOY.md`) + `_headers`(X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- `apps/blog/wrangler.toml`.

### Changed
- `apps/blog/obsidian-blog.config.ts`의 `site.url`을 placeholder에서 Cloudflare Pages 기본 도메인으로 교체.

### Removed (Known limitations)
- alias frontmatter → canonical URL 정적 redirect HTML 미생성 — 본 릴리스에서 구현됨.
```

라인 41의 `PLACEHOLDER_OWNER/PLACEHOLDER_REPO`도 사용자 답변에 따라 교체(또는 보류).

사용자가 라벨을 `[Unreleased]`로 선택했다면 위 헤더만 교체.

#### `TODO.md`

- "Step 6" 섹션의 마지막 미체크 항목(`[ ] Cloudflare Pages / Vercel 배포 (배포 도메인 미정 — v0.2 작업)`)을 체크 + 짧은 주석(`(step8에서 처리, docs/DEPLOY.md 참조)`).
- "미결정 / 사용자 확인 필요" 섹션의 "배포 도메인" 항목을 체크 + Cloudflare Pages 기본 도메인 사용 명시.
- 새 섹션 추가(선택): `## Step 8 — 배포 + alias redirect ✅` 아래 5개 step 체크 리스트(이번 phase 결과 반영).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

dist 검증(사용자 vault 빌드 후, alias가 있는 노트가 vault에 적어도 1개 있다는 전제):

```bash
test -f apps/blog/dist/_headers
grep -h "X-Content-Type-Options" apps/blog/dist/_headers
grep -r "DO_NOT_LEAK_BANANA_6f3c1" apps/blog/dist | wc -l   # 0
node packages/cli/dist/bin.js audit apps/blog/dist           # pass
grep -h '<link rel="canonical"' apps/blog/dist/index.html    # href 끝에 / 없음 (trailingSlash 'never')
grep -h 'og:url' apps/blog/dist/index.html                   # og:url 메타 존재
```

vault에 alias가 있는 노트가 없으면 alias 페이지 검증은 fixture 통합 테스트로 대체(이미 step 2에서 통과).

배포 자체(사용자 수동, 본 step의 git 커밋과 분리):

```bash
wrangler login
wrangler pages deploy apps/blog/dist --project-name=<프로젝트명>
```

## 검증 절차

1. AC 커맨드 실행.
2. 체크리스트:
   - `_headers`가 `dist/` 루트에 카피됨.
   - canonical/og:url이 모든 페이지 HTML에 등장(404 제외).
   - audit pass (alias redirect 무결성 + canary 0회).
3. `phases/step8-deploy-prep/index.json`의 step 4 갱신.
4. `phases/index.json`의 `step8-deploy-prep` entry status를 `completed`로 갱신(execute.py가 자동 처리).

## 금지사항

- **`.github/workflows/`에 deploy job을 추가하지 마라.** 이유: `obsidian-blog.config.ts`의 vault 절대 경로가 GitHub Actions runner에 없으므로 build 자체가 실패한다. CI는 현 상태(typecheck/lint/test/cli build)를 유지한다.
- **CSP 헤더를 추가하지 마라.** 이유: Astro inline style/script 호환성 미검증. v0.2 작업.
- **`obsidian-blog.config.ts`의 `vaults[0].path`를 변경하지 마라.** 이유: 이 step의 작업자가 사용자의 머신/vault 경로를 알지 못한다. `site.url`만 변경.
- **`wrangler` 로그인이나 실제 `wrangler pages deploy`를 step 작업 중 실행하지 마라.** 이유: OAuth/계정 권한이 필요하며 사용자가 직접 실행해야 한다. 본 step은 설정 파일 + 문서까지만.
- **`README.md`의 v0.1 약속(예: 빠른 시작 단계 5개)을 깨지 마라.** 이유: 회귀.
- 기존 테스트를 깨뜨리지 마라.
