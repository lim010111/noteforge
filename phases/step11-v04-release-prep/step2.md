# Step 2: readme-deploy-section

## 컨텍스트

`/README.md`의 "배포" 섹션이 v0.1 시점 표기(*"Vercel/Netlify는 정적 출력이라 가능하지만 v0.1에서는 미문서화. v0.2 검토."*)로 멈춰 있다. v0.4에서 **"빌드는 로컬, 호스트는 자유"** 정책을 명문화한다.

fork 사용자에게 무료 호스팅 2개를 표로 제시(권장 + 대안), Vercel/Netlify는 한 줄로 언급하고 자세한 명령은 `docs/DEPLOY.md` §9 참고로 cross-link.

**전제**: step0 commit 5에서 README 빠른 시작 §3 + 배포 섹션 fork 안내 1단락이 이미 `OBPUB_VAULT_PATH` 흐름으로 갱신되어 있다. 이 step에서는 그 갱신을 *보존*하면서, 그 아래 *낡은 v0.1 미문서화 한 줄*만 호스팅 표 블록으로 교체한다 (즉 fork 안내 단락은 손대지 않는다).

오늘 날짜: **2026-04-29**.

## 읽어야 할 파일

- `/README.md` 전체 — 특히 "배포" 섹션 (수정 대상). 라인 위치는 grep으로 찾을 것 (`grep -n '## 배포\|## Deployment' README.md`)
- `/docs/DEPLOY.md` 헤더만 — 다음 step에서 §9 부록이 추가될 예정 (이 step에서는 cross-link만 작성)

## 작업

`/README.md`의 "배포" (또는 영문 "Deployment") 섹션 본문 단락을 다음 블록으로 **교체**한다. 섹션 헤더(`## 배포` 또는 `## Deployment`)는 유지, 그 아래 본문만 교체.

```markdown
빌드는 항상 로컬, 호스트는 자유 — Cloudflare Pages를 권장 default로 두지만 다른 정적 호스트도 동일한 패턴으로 동작합니다.

| 호스트 | 무료 URL 패턴 | 업로드 명령 |
|---|---|---|
| Cloudflare Pages (권장) | `*.pages.dev` | `wrangler pages deploy apps/blog/dist --project-name=<my-blog>` |
| GitHub Pages (대안) | `<USER>.github.io/<REPO>` | `gh-pages` 브랜치에 `apps/blog/dist` 푸시 (자세히는 `docs/DEPLOY.md` §9) |

Vercel/Netlify도 동일한 패턴(`pnpm --filter blog build` 후 `dist/` 업로드)으로 동작합니다 — 자세한 명령은 [`docs/DEPLOY.md`](./docs/DEPLOY.md) §9 참고.

빌드는 사용자 머신에서 수행해야 합니다 — `apps/blog/obsidian-blog.config.ts`의 `vaults[0].path`가 사용자 로컬 절대 경로이기 때문입니다(CI runner에 그 경로가 없으므로 GitHub Actions 자동 빌드는 의도적으로 미지원). 자세한 단계는 [`docs/DEPLOY.md`](./docs/DEPLOY.md).
```

이 블록 외 다른 줄은 건드리지 않는다. 추가 라인 수는 약 12 (표 4행 + 빈 줄 + 단락 2개).

## Acceptance Criteria

```bash
test "$(grep -c '^| Cloudflare Pages (권장)' README.md)" -ge 1
test "$(grep -c '^| GitHub Pages (대안)' README.md)" -ge 1
test "$(grep -c 'docs/DEPLOY.md' README.md)" -ge 2
test "$(grep -c '빌드는 항상 로컬, 호스트는 자유' README.md)" -eq 1
pnpm -r typecheck
pnpm lint
```

조건:
- 표 행 2개 (Cloudflare 권장 + GitHub Pages 대안)
- `docs/DEPLOY.md` 링크 2개 이상
- 정책 한 줄 정확히 1번 등장
- typecheck / lint exit 0 (문서만 변경)

## 검증 절차

1. README "배포" 섹션을 사람 눈으로 1회 확인:
   - 정책 한 줄 (빌드는 로컬, 호스트는 자유)
   - 2행 표 (Cloudflare 권장 + GitHub Pages 대안)
   - Vercel/Netlify 1줄 + DEPLOY.md §9 cross-link
   - GitHub Actions 미지원 이유 1단락
2. README의 quick-start 섹션 (clone → install → config → build) 손상 없음 확인 (해당 섹션 라인 수 무변)
3. `git diff README.md` 살펴 추가/삭제 라인이 "배포" 섹션 범위 내인지.
4. 결과 갱신 — `phases/step11-v04-release-prep/index.json` step 2:
   - 성공 → `"status": "completed"`, `"summary": "README 배포 섹션 교체: 정책 한 줄 + 2행 표 + DEPLOY.md §9 cross-link, +<n>/-<m> 라인"`
   - 실패 → `"status": "error"`, `"error_message": "어느 AC가 어떤 출력으로 실패"`

이 step의 산출물(README diff)을 별도 commit으로 즉시 커밋:

```bash
git add README.md
git commit -m "docs(readme): 배포 섹션 갱신 — 무료 호스팅 2행 표 + DEPLOY.md §9 cross-link"
```

## 금지사항

- "Quick start", "환경 요구사항" 등 README 다른 섹션을 수정하지 마라. 이유: scope.
- v0.4-specific brand text (예: "noteforge")를 늘리거나 바꾸지 마라. 이유: brand 토큰화는 별도 PR.
- 표에 Vercel / Netlify 행을 추가하지 마라 (한 줄 언급만). 이유: 사용자 결정(2행만).
- 스크린샷 placeholder를 변경하지 마라. 이유: 사용자 직접 캡처.
- threat model / privacy 본문을 약화시키는 표현으로 교체하지 마라. 이유: 제품 핵심 약속.
- `Co-Authored-By: Claude` 트레일러를 커밋 메시지에 포함하지 마라. 이유: 전역 CLAUDE.md 규칙.
