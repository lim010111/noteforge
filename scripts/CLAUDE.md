# scripts

## 책임 (Owns)
프로젝트 자동화 스크립트. `/harness` 슬래시 커맨드의 phase A/B/C 상태 머신, 정적 자산 self-host 벤더링, 컨텍스트 문서 path 검증.

## 핵심 파일
- execute.py — phase 디렉터리 읽기 / step 순차 실행 / 실패 시 git 자동 rollback
- test_execute.py — 하네스 단위·통합 테스트
- validate-context-paths.mjs — CLAUDE.md / AGENTS.md / README.md path 무결성 + 쌍 일치 검증
- vendor-fonts.mjs — 폰트 self-host 벤더링
- vendor-katex.mjs — KaTeX self-host 벤더링

## 외부 의존 (Depends on)
없음. Python 3 + Node 22 단독. CLI / core 호출은 subprocess.

## 테스트
```bash
python3 scripts/test_execute.py
node scripts/validate-context-paths.mjs
```

## 변경 패턴 (Common modification patterns)
- 새 phase step → execute.py step.json 형식 + idempotent 가정 + git rollback 동작 확인
- 정적 자산 추가 self-host → vendor-*.mjs + package.json `vendor:assets` 묶음 갱신
- 컨텍스트 검증 룰 추가 → validate-context-paths.mjs RE_PATH_REF 와 score.py 정규식 동기화 유지

## Non-obvious
- **반드시**: 각 phase step 은 원자적·idempotent 가정. step 도중 실패 시 git revert 로 자동 rollback.
- **주의**: validate-context-paths 는 CLAUDE.md / AGENTS.md 안의 markdown link 타겟 존재 여부와 두 파일 짝의 byte-identical 동기화를 강제하는 회귀 게이트.
- **Note:** `vendor:*` 스크립트는 `pnpm vendor:assets` 묶음에서 호출. apps/blog dev / build 가 prerun 으로 자동 실행.
- `/harness` 슬래시 커맨드는 execute.py 에 인자를 전달.

## 관련 (Related)
- evals placeholder: [evals/README.md](../evals/README.md)
- CI 게이트: [github actions ci workflow](../.github/workflows/ci.yml)
