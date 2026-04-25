# Step 2: cli-dev-build-commands

`obpub dev` / `obpub build`는 사용자가 매일 쓰는 두 명령. 둘 다 Astro CLI를 spawn으로 래핑하되, `build`는 완료 후 `audit`를 자동 실행하고 결과를 종료 리포트로 합친다. 비-zero exit 코드 전파를 정확히 구현한다 (audit fail이면 build도 fail).

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `@obpub/cli`가 "내부적으로 Astro CLI를 래핑"한다는 결정.
- `/docs/PRD.md` — `obpub dev`/`build` UX 요구사항.
- 이전 step 산출물:
  - `packages/cli/src/bin.ts` — commander 진입점.
  - `packages/cli/src/commands/status.ts` — 명령 모듈 패턴 참조.
  - `packages/cli/src/commands/audit.ts` — `runAudit` 호출자.
  - `packages/cli/src/lib/loadConfig.ts` — 설정 로더.
- `/apps/blog/` 디렉토리의 존재 여부와 `astro.config.mjs` 위치 (없을 수 있음 — 그 경우 명확한 에러 메시지로 안내).

## 작업

### 1. 패키지 구조 보강

```
packages/cli/src/
├── bin.ts                       # dev / build 명령 등록 추가
├── commands/
│   ├── status.ts                # (step 0 산출물)
│   ├── audit.ts                 # (step 1 산출물)
│   ├── dev.ts                   # `obpub dev`
│   └── build.ts                 # `obpub build`
└── lib/
    ├── loadConfig.ts            # (step 0 산출물)
    ├── audit/                   # (step 1 산출물)
    └── astroRunner.ts           # spawn + 표준 입출력 forwarding
packages/cli/tests/
├── astroRunner.test.ts          # spawn mock 기반 단위 테스트
├── build.test.ts                # build → audit 연동 단위 테스트
└── dev.test.ts                  # dev 명령의 인자 forwarding 검증
```

### 2. 인터페이스 시그니처

`packages/cli/src/lib/astroRunner.ts`:

```ts
import type { ChildProcess } from 'node:child_process';

export interface AstroRunResult {
  /** Astro 프로세스가 정상 종료된 exit code */
  readonly exitCode: number;
  /** 호출자가 spawn 시점부터 측정한 wall clock */
  readonly elapsedMs: number;
}

export interface AstroRunOptions {
  /** astro CLI를 실행할 cwd. 기본: apps/blog가 있으면 그 경로, 아니면 process.cwd() */
  readonly cwd: string;
  /** 'dev' | 'build' | 'preview' 등 — 알려진 서브커맨드 */
  readonly subcommand: 'dev' | 'build' | 'preview';
  /** 사용자가 추가로 전달한 인자 (예: --port, --host) */
  readonly extraArgs: readonly string[];
  /** 테스트용 주입점 — 기본은 child_process.spawn */
  readonly spawn?: typeof import('node:child_process').spawn;
  /** stdio. 기본 'inherit' — 사용자 터미널에 그대로 노출 */
  readonly stdio?: 'inherit' | 'pipe';
}

/**
 * Astro CLI를 spawn 한다.
 *
 * - astro 바이너리는 cwd의 node_modules/.bin/astro를 우선 사용.
 *   없으면 'astro' PATH 검색.
 *   없으면 즉시 throw.
 * - SIGINT(ctrl-c)를 부모에서 받으면 자식에 forward + 자식이 정리할 시간을 준다.
 * - exit code를 그대로 전달 (Astro가 1을 주면 1).
 */
export function runAstro(opts: AstroRunOptions): Promise<AstroRunResult>;
```

`packages/cli/src/commands/dev.ts`:

```ts
export interface DevOptions {
  readonly configPath?: string;
  readonly extraArgs: readonly string[];
}

/** loadConfig → resolve cwd (apps/blog if exists) → runAstro({ subcommand: 'dev' }) */
export async function runDev(opts: DevOptions): Promise<number /* exit code */>;
```

`packages/cli/src/commands/build.ts`:

```ts
import type { AuditOutcome } from './audit.ts';

export interface BuildOptions {
  readonly configPath?: string;
  readonly extraArgs: readonly string[];
  /** --no-audit이면 false. 기본 true. */
  readonly runAuditAfter: boolean;
  /** audit --strict와 동일 효과 */
  readonly strictAudit: boolean;
}

export interface BuildOutcome {
  readonly astroExitCode: number;
  readonly elapsedAstroMs: number;
  readonly audit?: AuditOutcome;
}

/**
 * 1. loadConfig.
 * 2. runAstro({ subcommand: 'build' }) — Astro가 0이 아니면 즉시 BuildOutcome 반환 (audit 생략).
 * 3. astroExit === 0이면 runAudit 호출.
 * 4. BuildOutcome 반환. 호출자(bin.ts)는:
 *    - astroExit !== 0 → exit astroExit
 *    - audit.violations.length > 0 → exit 1
 *    - 그 외 → exit 0
 */
export async function runBuild(opts: BuildOptions): Promise<BuildOutcome>;
```

### 3. bin.ts 명령 등록

```ts
program
  .command('dev')
  .description('Run Astro dev server with HMR')
  .option('-c, --config <path>', 'path to obsidian-blog.config.ts')
  .allowUnknownOption(true)               // astro 인자를 그대로 전달
  .action(async (opts: { config?: string }, cmd) => {
    const exitCode = await runDev({
      configPath: opts.config,
      extraArgs: cmd.args,                 // status 명령과 충돌하지 않도록 commander 인자 패턴 확인
    });
    process.exit(exitCode);
  });

program
  .command('build')
  .description('Build the static site and run privacy audit')
  .option('-c, --config <path>', 'path to obsidian-blog.config.ts')
  .option('--no-audit', 'skip post-build audit')
  .option('--strict', 'pass --strict to the audit step')
  .allowUnknownOption(true)
  .action(async (opts, cmd) => {
    const outcome = await runBuild({
      configPath: opts.config,
      extraArgs: cmd.args,
      runAuditAfter: opts.audit !== false,
      strictAudit: !!opts.strict,
    });
    if (outcome.astroExitCode !== 0) process.exit(outcome.astroExitCode);
    if (outcome.audit && outcome.audit.violations.length > 0) process.exit(1);
    process.exit(0);
  });
```

### 4. 종료 리포트 형식

`build` 성공:

```
[build] astro build OK — {elapsedAstroMs}ms
[audit] OK — 0 violations (checked {checkedFiles} files in {elapsedMs}ms)
[obpub] BUILD OK
```

`build` 실패 (audit fail):

```
[build] astro build OK — {elapsedAstroMs}ms
[audit] FAIL — {N} violations across {M} files
  ...위반 줄들...
[obpub] BUILD FAILED — privacy audit failed
```

`build` 실패 (astro fail):

```
[build] astro build FAILED — exit {exitCode}, {elapsedAstroMs}ms
[obpub] BUILD FAILED — astro exited non-zero
```

`dev`는 종료 시 단순히 자식 exit code를 그대로 전달한다 (사용자가 Ctrl-C로 종료하므로 exit 130).

### 5. TDD — 실패 테스트 먼저

`spawn` 의존을 직접 호출하면 단위 테스트가 어렵다. `runAstro`의 `opts.spawn` 주입점으로 mock spawn을 받아 다음을 검증한다.

`astroRunner.test.ts`:

1. cwd의 `node_modules/.bin/astro`가 존재하면 그 경로로 spawn 호출.
2. 존재하지 않으면 PATH의 `astro`로 spawn 호출.
3. PATH에도 없으면 throw.
4. `extraArgs`가 그대로 전달.
5. 자식이 exit 0 → result.exitCode === 0.
6. 자식이 exit 7 → result.exitCode === 7.
7. SIGINT 시뮬레이션: 부모가 SIGINT를 받으면 자식에 SIGINT forward.

`build.test.ts`:

1. astroExit === 0 + audit 위반 0건 → outcome.audit.violations.length === 0.
2. astroExit === 1 → audit 호출되지 않음 (`runAudit` mock이 호출 횟수 0).
3. astroExit === 0 + audit 위반 발생 → outcome.audit.violations.length > 0.
4. `runAuditAfter: false` → audit 미호출.

`dev.test.ts`:

1. extraArgs `['--port', '3000']`이 astro에 그대로 전달.
2. configPath 지정 시 loadConfig가 그 경로로 호출.

### 6. apps/blog 자동 감지

`runDev`/`runBuild`는 cwd 결정 로직을 공유한다.

```ts
// packages/cli/src/lib/resolveAstroCwd.ts
export function resolveAstroCwd(startDir: string): string {
  // 1. <startDir>/apps/blog/astro.config.{mjs,js,ts,mts}가 있으면 apps/blog 반환.
  // 2. <startDir>/astro.config.* 가 있으면 startDir 반환.
  // 3. 없으면 throw — "no astro project found at {paths-tried}".
}
```

이 함수에 대한 단위 테스트도 별도 추가 (4 케이스: apps/blog 있음 / startDir 자체 / 둘 다 / 둘 다 없음).

### 7. apps/blog가 아직 비어있을 때

현재 `apps/blog`는 스켈레톤만 있고 `astro.config.mjs`가 없을 가능성이 크다. **이 step에서 apps/blog를 채우지 않는다** — 그건 Step 6의 책임. 대신:

- `runDev`/`runBuild`는 `resolveAstroCwd`가 throw하면 친절한 에러 메시지로 종료한다 (`exit 1` + stderr 안내).
- 통합 smoke 테스트는 임시 디렉토리에 가짜 `apps/blog/astro.config.mjs`(빈 파일)를 만든 뒤 spawn mock으로 검증한다 — 실제 astro 바이너리는 호출하지 않는다.

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter @obpub/cli test
```

전부 0 exit. astroRunner/build/dev 단위 테스트 합 12개 이상 통과.

## 검증 절차

1. AC 커맨드 실행.
2. 수동 smoke (선택, apps/blog가 있을 때만):
   ```bash
   pnpm --filter @obpub/cli exec node --experimental-strip-types ./src/bin.ts build --no-audit
   ```
   astro CLI가 spawn되어 빌드 진행 출력이 보이는지 확인 (apps/blog가 비어 있으면 의도적으로 친절한 에러 메시지가 떠야 함).
3. 아키텍처 체크리스트:
   - dev/build 안에서 분류 로직을 다시 구현하지 않았는가?
   - astro 의존을 cli 패키지의 `dependencies`에 추가하지 않았는가? (astro는 apps/blog의 의존이지 cli의 의존이 아니다 — `peerDependencies`나 그냥 spawn으로 PATH 의존이 자연스럽다.)
   - SIGINT 핸들링이 자식 프로세스를 좀비로 남기지 않는가?
4. 결과에 따라 `phases/step5-cli-commands/index.json`의 step 2를 업데이트.

## 금지사항

- **astro를 require/import하지 마라.** 이유: spawn으로만 호출. CLI 패키지가 astro 버전에 묶이면 사용자가 astro를 업그레이드할 자유를 잃는다.
- **자식 프로세스 stdout/stderr를 그대로 buffer에 모으지 마라.** 이유: 빌드 로그가 길면 메모리 폭발. 기본 `stdio: 'inherit'`로 사용자 터미널에 직접 흘려 보낸다 (테스트는 mock spawn으로 검증).
- **build에서 audit이 실패해도 dist를 삭제하지 마라.** 이유: 사용자가 진단을 위해 산출물을 보고 싶을 수 있다. audit은 fail 신호만 준다.
- **dev에서 watcher를 직접 만들지 마라.** 이유: watcher는 `@obpub/astro`의 책임 (이미 step3b에서 구현됨). cli는 astro CLI를 띄우기만 한다.
- **process.exit를 commands/* 모듈 안에서 호출하지 마라.** 이유: 단위 테스트 가능성을 깬다. 종료는 bin.ts에서만.
- **기존 테스트를 깨뜨리지 마라.** 특히 `packages/core/tests/integration/`의 canary 검증.
