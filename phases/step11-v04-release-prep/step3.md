# Step 3: deploy-md-other-hosts

## 컨텍스트

`docs/DEPLOY.md`는 §1–8까지 Cloudflare Pages 절차만 다룬다. v0.4에서 `## 9. 다른 무료 호스트 (선택)` 섹션을 **append** 한다 (GitHub Pages / Vercel / Netlify). §1–8은 한 글자도 변경하지 않는다.

step2의 README 표가 이 §9를 cross-link하므로, 이 step이 완료되어야 README 링크가 의미를 갖는다.

## 읽어야 할 파일

- `/docs/DEPLOY.md` 전체 — 특히 §7(왜 GitHub Actions 자동 배포가 안 되는지) 본문, §8 마지막 위치 확인
- `/phases/step11-v04-release-prep/step2-output.json` — README가 §9를 어떻게 cross-link하는지 확인

## 작업

`/docs/DEPLOY.md` 끝(§8 마지막 줄 다음)에 빈 줄 1개를 두고 다음 섹션을 **append**한다.

```markdown
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
```

## Acceptance Criteria

```bash
test "$(grep -c '^## 9\. 다른 무료 호스트' docs/DEPLOY.md)" -eq 1
test "$(grep -c '^### 9\.[123]' docs/DEPLOY.md)" -eq 3
test "$(grep -c '^### 공통' docs/DEPLOY.md)" -eq 1
# §1–8 무수정 검증: 신규 추가 외 삭제 라인 0
git diff docs/DEPLOY.md | awk '/^-[^-]/' | wc -l | awk '{exit ($1==0)?0:1}'
pnpm -r typecheck
pnpm lint
```

조건:
- §9 H2 정확히 1개
- §9.1 / §9.2 / §9.3 H3 정확히 3개
- §공통 H3 정확히 1개
- diff에 `^-` (삭제) 라인 0
- typecheck / lint exit 0

## 검증 절차

1. AC 명령 실행. 삭제 라인 0이 핵심.
2. §9 코드 펜스 균형 확인: `grep -c '^\`\`\`' docs/DEPLOY.md` 결과가 짝수.
3. `### 9.1 GitHub Pages` 코드 블록 안에 `git worktree add /tmp/gh-pages -b gh-pages` 한 줄 정확히 등장.
4. README의 `docs/DEPLOY.md §9` 링크가 마크다운 anchor로 이 §9를 가리킴 (anchor 자동 생성 신뢰; 수동 anchor 추가는 안 함).
5. 결과 갱신 — `phases/step11-v04-release-prep/index.json` step 3:
   - 성공 → `"status": "completed"`, `"summary": "DEPLOY.md §9 부록 append: 9.1 GitHub Pages / 9.2 Vercel / 9.3 Netlify, §1–8 무수정"`
   - 실패 → `"status": "error"`, `"error_message": "구체"`

이 step 산출물을 별도 commit:

```bash
git add docs/DEPLOY.md
git commit -m "docs(deploy): §9 다른 무료 호스트 부록 (GitHub Pages/Vercel/Netlify)"
```

## 금지사항

- `## 1.` ~ `## 8.` 섹션을 한 글자도 수정하지 마라. 이유: 기존 절차 유효 + 회귀 위험.
- §9에 보안 권고 / CSP 등 §8 주제를 다시 적지 마라. 이유: 중복.
- 스크린샷 / badge / 외부 이미지를 추가하지 마라. 이유: docs 텍스트 SSOT.
- §9에 vault 경로 제약 외 새로운 privacy 약속을 추가하지 마라. 이유: 기존 SSOT(§7) 유지.
- 호스트별 토글을 위한 JS, 임베드 위젯 같은 것을 도입하지 마라. 이유: docs는 plain markdown.
- `Co-Authored-By: Claude` 트레일러를 커밋 메시지에 포함하지 마라. 이유: 전역 CLAUDE.md 규칙.
