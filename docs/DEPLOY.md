# 배포 가이드 — Cloudflare Pages (v0.2)

이 문서는 `apps/blog`를 Cloudflare Pages에 **Direct Upload** 방식으로 배포하는 절차를 설명한다. v0.2 정식 지원 호스팅은 Cloudflare Pages 단일이며, fork 사용자도 동일 절차를 따른다.

## 1. 사전 준비

1. Cloudflare 계정 생성: https://dash.cloudflare.com/sign-up (무료, 카드 등록 불필요).
2. wrangler CLI 설치:
   ```bash
   npm i -g wrangler
   wrangler --version   # v3.x 이상 권장
   ```
3. wrangler 로그인:
   ```bash
   wrangler login
   ```
   브라우저 OAuth 창이 열리고 인증 토큰이 `~/.wrangler/`에 저장된다.

## 2. 로컬 빌드

```bash
pnpm install
pnpm --filter blog build
```

산출물은 `apps/blog/dist/`에 생성된다. 빌드 과정에서 audit이 자동 실행되며, 누출이 감지되면 빌드가 실패한다.

## 3. 첫 배포

```bash
wrangler pages deploy apps/blog/dist --project-name=noteforge
```

- 첫 실행 시 동일 이름의 프로젝트가 Cloudflare 계정에 없으면 wrangler가 자동 생성한다 (Wrangler v3+).
- 이름 충돌이 발생하면 다른 이름으로 재시도하고, `apps/blog/wrangler.toml`의 `name`과 `apps/blog/obsidian-blog.config.ts`의 `site.url`을 함께 갱신한다.
- 배포 완료 후 출력되는 URL: `https://noteforge.pages.dev`.

## 4. 누출 검증

배포 직전 또는 직후에 독립 audit을 실행해 산출물에 누출이 없는지 검증한다.

```bash
pnpm --filter @noteforge/cli build   # 처음 한 번만
node packages/cli/dist/bin.js audit apps/blog/dist
```

`fail`이 출력되면 **배포하지 마라**. `dist/`를 통째로 폐기하고 vault의 노트 분류 / config를 점검한 뒤 다시 빌드한다.

## 5. 재배포

위 2~4번 절차를 동일하게 반복하면 된다. Cloudflare Pages는 Direct Upload 모드에서 새로운 배포를 누적 보관하며, 최신 배포가 production이 된다.

## 6. Custom domain

기본 도메인 `noteforge.pages.dev`는 v0.2의 canonical URL로 설정되어 있다. 자체 도메인으로 옮기려면:

1. Cloudflare Pages dashboard → 프로젝트 선택 → **Custom domains**.
2. 도메인 추가 → Cloudflare DNS에 안내된 CNAME 레코드 등록.
3. 도메인 활성화(SSL 발급 완료) 확인.
4. `apps/blog/obsidian-blog.config.ts`의 `site.url`을 새 도메인으로 갱신.
5. `pnpm --filter blog build && wrangler pages deploy apps/blog/dist --project-name=noteforge` 재실행.

이 단계를 거치지 않으면 canonical URL과 OG meta가 이전 도메인을 가리켜 일관성이 깨진다.

## 7. 왜 GitHub Actions 자동 배포를 지원하지 않는가

`apps/blog/obsidian-blog.config.ts`의 `vaults[0].path`는 사용자 머신의 절대 경로(예: `/mnt/c/Users/.../Obsidian`)다. GitHub Actions runner에는 이 경로가 존재하지 않으므로 빌드 자체가 실패한다.

OSS fork 사용자는 자기 머신에서 위 절차로 빌드·배포해야 하며, fork 직후 가장 먼저 편집할 파일은 `apps/blog/obsidian-blog.config.ts`의 `vaults[0].path`다.

CI(`.github/workflows/ci.yml`)는 typecheck / lint / test / CLI 빌드까지만 수행한다.

## 8. CSP 미적용

`apps/blog/public/_headers`는 다음 보안 헤더를 설정한다:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: interest-cohort=()`
- `/fonts/*`에 대해 1년 immutable 캐시 + CORS 허용

CSP(Content-Security-Policy)는 v0.2에 포함하지 않는다. Astro가 사용하는 inline style/script(테마 토글 FOUC 방지 IIFE 등) 호환성 검증이 끝나야 하며, `unsafe-inline` 없이 동작하는 nonce 또는 hash 전략이 필요하다. v0.3에서 도입 예정이다.

## 9. 다른 무료 호스트 (선택)

Cloudflare Pages가 권장 default이지만, 사용자가 원하면 동일한 `dist/` 산출물을 다른 정적 호스트에도 올릴 수 있습니다. 어느 경우든 빌드는 항상 로컬 (§7 참고: vault 경로 제약은 모든 호스트에 동일하게 적용).

### 9.1 GitHub Pages

```bash
pnpm --filter blog build

# 첫 배포에만 1회: gh-pages worktree 준비
git worktree add /tmp/gh-pages -b gh-pages
cp -R apps/blog/dist/. /tmp/gh-pages/
cd /tmp/gh-pages && git add -A && git commit -m "deploy" && git push -u origin gh-pages
```

이후부터는 빌드 → 동일 worktree에 dist 복사 → push만 반복하면 됩니다. 무료 URL은 `https://<USER>.github.io/<REPO>/` 형태.

### 9.2 Vercel

```bash
pnpm --filter blog build
vercel deploy --prebuilt --prod apps/blog/dist
```

`--prebuilt` 플래그가 핵심 — Vercel CI가 본인 경로에 vault가 없어 빌드 실패하는 것을 회피합니다.

### 9.3 Netlify

```bash
pnpm --filter blog build
netlify deploy --dir=apps/blog/dist --prod
```

### 공통

- 어느 호스트든 빌드 단계는 `pnpm --filter blog build`로 동일.
- 호스트 간 차이는 dist 업로드 경로뿐.
- §7의 *"GitHub Actions 자동 빌드는 vault 경로 제약상 불가"*는 모든 호스트에 동일 적용. CI는 typecheck/lint/test/CLI 빌드까지만.
