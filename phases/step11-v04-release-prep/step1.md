# Step 1: verify-build-test-audit

## 컨텍스트

step0에서 4커밋으로 분리된 v0.4 작업분이 머지 가능 상태인지 검증한다. typecheck / lint / test / build / audit + canary grep — 5단 그린이어야 step2 이후로 진행 가능.

이 단계는 read-only verification이며 코드를 수정하지 않는다 (실패 시 별도 fixup 커밋으로 처리).

오늘 날짜: **2026-04-29**.

## 읽어야 할 파일

- `/CLAUDE.md` — privacy CRITICAL 규칙 (canary 검증 의무)
- `/phases/step11-v04-release-prep/step0-output.json` — 직전 step 결과 (참고)

## 작업

루트에서 다음을 순서대로 실행. 어느 하나라도 비-zero exit이면 즉시 중단하고 step output에 stdout/stderr 기록.

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm --filter @noteforge/cli obpub audit \
  --config apps/blog/obsidian-blog.config.ts \
  --dist apps/blog/dist
```

이어서 canary grep:

```bash
grep -RIn "DO_NOT_LEAK_BANANA_6f3c1\|CLAUDE_COMMENT_LEAK_77b\|FOLDER_TREE_DO_NOT_LEAK_8a4f2" apps/blog/dist/ \
  || echo "CANARY_OK"
```

기대 출력: `CANARY_OK` 한 줄만. 어떤 파일에서든 hit이 발생하면 즉시 error로 분류.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm --filter @noteforge/cli obpub audit --config apps/blog/obsidian-blog.config.ts --dist apps/blog/dist
! grep -RIq "DO_NOT_LEAK_BANANA_6f3c1\|CLAUDE_COMMENT_LEAK_77b\|FOLDER_TREE_DO_NOT_LEAK_8a4f2" apps/blog/dist/
```

조건:
- 모든 명령 exit 0
- audit 출력에 `violations: 0` (또는 동등)
- 마지막 grep `! ... -q`이 exit 0 (= 어떤 파일에도 canary 없음)

## 검증 절차

1. AC 명령 모두 통과.
2. test 결과 614+ tests pass — step10 v0.3 완료 시점 602 + v0.4에서 추가된 ~12개 (config.test.ts +6, categoryOverviewPayload.test.ts +6).
3. audit 출력의 "files audited" ≥ 19 (v0.3은 17 + /categories /about = 19+).
4. 빌드 산출물 page count: `find apps/blog/dist -name '*.html' | wc -l` 결과 ≥ 19.
5. 결과 갱신 — `phases/step11-v04-release-prep/index.json` step 1:
   - 성공 → `"status": "completed"`, `"summary": "5단 그린: typecheck/lint/test(<count>)/build/audit(0 violations) + canary 0/0/0"`
   - 실패 → `"status": "error"`, `"error_message": "어느 명령(예: pnpm test)이 어떤 출력의 첫 30줄로 실패"`

## 금지사항

- 실패한 테스트를 `--skip` / `it.skip` / 주석 처리로 회피하지 마라. 이유: privacy / 회귀 가드.
- `apps/blog/dist/`를 손으로 수정하지 마라. 이유: build 출력은 reproducible.
- canary grep 결과를 무시하지 마라. 이유: 누설 = privacy 사고 (제품 핵심 약속 위반).
- step0의 4커밋을 amend / reorder / revert 하지 마라. 이유: 검증은 read-only. 수정 필요 시 fixup 커밋 별도 생성.
- node_modules / pnpm 캐시를 삭제하지 마라. 이유: scope 외 + 시간 낭비.
- `pnpm install --force`를 첫 시도로 사용하지 마라. 이유: 이미 lockfile이 안정 상태라야 step0이 통과한 것.
