# @noteforge/cli

## 책임 (Owns)
`obpub` CLI. dev / build / audit / status 4개 커맨드로 core + astro 파이프라인을 명령행에 노출. audit 은 빌드 산출물(`dist/`)의 독립 검증으로 privacy 로직을 이중화한다.

## 핵심 파일
- src/bin.ts — commander 라우팅
- src/commands/dev.ts — Astro dev 위임
- src/commands/build.ts — 빌드 + 자동 audit
- src/commands/audit.ts — `dist/` 독립 검증 진입점
- src/commands/status.ts — 노트별 공개 판정 reason 출력
- src/lib/audit/checks.ts — 빌드 산출물 검증 룰

## 외부 의존 (Depends on)
- `@noteforge/core` — pipeline / config / classify / parseNote
- 빌드 도구: tsup → `dist/bin.js` (engines: node 22.6+)

## 테스트
```bash
pnpm --filter @noteforge/cli test
```

## 변경 패턴 (Common modification patterns)
- 새 subcommand → src/commands/<name>.ts + src/bin.ts 에 라우팅 등록
- 새 audit 룰 → src/lib/audit/checks.ts. core 와 독립 검증 룰만 추가, privacy 로직은 import 금지
- status 출력 포맷 변경 → src/commands/status.ts. classify 직접 호출 결과만 사람-가독 형식으로

## Non-obvious
- **반드시**: audit 은 core 와 독립적으로 `dist/` 만 검증. privacy 로직 재구현 금지 — 의도적 이중 검증이다.
- **주의**: dev / build 는 src/lib/astroRunner.ts 를 통해 자식 프로세스를 관리. Astro 직접 import 금지.
- **Note:** 빌드 산출물은 `dist/` 만 노출 (package.json `bin` / `files` 항목).

## 관련 (Related)
- 의존: [@noteforge/core](../core/CLAUDE.md)
- 결정 기록: [adr/0001-privacy-first-opt-in.md](../../docs/adr/0001-privacy-first-opt-in.md), [adr/0004-build-locally-not-ci.md](../../docs/adr/0004-build-locally-not-ci.md)
