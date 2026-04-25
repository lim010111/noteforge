# Step 0: cli-status-command

`@obpub/cli`의 첫 명령. 사용자가 노트 한 파일을 가리키면 그 노트가 PUBLIC인지 PRIVATE인지, **이유**(어떤 frontmatter 키, 어떤 태그, tripwire 여부)를 정확히 한 줄로 출력한다. CLI 진입점(commander)도 이 step에서 함께 셋업한다. 이 step의 결과로 `pnpm obpub status path/to/note.md`가 동작해야 한다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 "Phase A → D" 섹션에서 status가 본질적으로 Phase A+B만 돌리는 명령이라는 점.
- `/docs/ADR.md` — ADR-002 (opt-in privacy 모델), ADR-006 (frontmatter allowlist).
- `/docs/PRD.md` — `obpub status` 사용자 요구사항.
- `/packages/core/src/types.ts` — `ParsedNote`, `ClassifyRule`, `Classification` 타입.
- `/packages/core/src/privacy/classify.ts` — `classify(note, rule): Classification` 결과 형식 및 reason 문자열 컨벤션.
- `/packages/core/src/discover/parseNote.ts` — `parseNote(content, relativePath): ParsedNote` 시그니처.
- `/packages/core/src/config.ts` — `defineConfig`, `getClassifyRule`, `loadConfig` 가능 여부 확인.
- `/packages/core/package.json` — `exports` 필드(현재 `./config`, `./pipeline`, `./privacy/linkRewriter`만 노출됨).
- `/packages/cli/package.json` — bin 진입점 위치(`./src/bin.ts`), `commander` 의존 이미 추가됨.
- `/packages/cli/src/bin.ts` — 현재 빈 shim. 이 step에서 구현한다.

## 작업

### 1. core public API 확장 — 최소 추가

`@obpub/core`의 `package.json` `exports`에 다음을 **추가**한다 (기존 항목은 유지):

```jsonc
{
  "exports": {
    // 기존 항목 유지
    "./discover/parseNote": "./src/discover/parseNote.ts",
    "./privacy/classify": "./src/privacy/classify.ts"
  }
}
```

이유: status 명령은 vault 전체를 돌릴 필요가 없다. 단일 파일만 읽고 분류하면 충분하므로 `parseNote` + `classify`만 사용한다. 무거운 `runCorePipeline`을 호출하지 않는다.

### 2. CLI 패키지 구조

```
packages/cli/src/
├── bin.ts                       # commander 진입점
├── commands/
│   └── status.ts                # `obpub status <file>` 구현
├── lib/
│   └── loadConfig.ts            # obsidian-blog.config.ts 동적 로드 헬퍼 (없으면 default)
└── index.ts                     # (선택) 테스트용 re-export
packages/cli/tests/
└── status.test.ts
```

### 3. 인터페이스 시그니처

`packages/cli/src/commands/status.ts`:

```ts
import type { ObpubConfig } from '@obpub/core/config';

export interface StatusResult {
  /** 입력으로 받은 vault-relative 경로 (정규화 완료) */
  readonly relativePath: string;
  /** 분류 결과 */
  readonly verdict: 'PUBLIC' | 'PRIVATE';
  /** 사람이 읽는 한 줄 사유 (classify의 reason을 그대로 또는 보강) */
  readonly reason: string;
  /** tripwire가 발화했는지 */
  readonly tripwireFired: boolean;
}

/**
 * 단일 노트 파일을 읽고 분류한다.
 *
 * - filePath는 vault root 기준 상대경로 또는 절대경로 모두 허용.
 *   절대경로면 config.vaults[0].path를 기준으로 vault-relative로 변환한다.
 * - 파일이 vault 밖이면 throw.
 * - 파일이 .md 확장자가 아니면 throw.
 * - 파일이 없으면 throw (errno ENOENT 그대로).
 */
export async function runStatus(
  filePath: string,
  config: ObpubConfig,
): Promise<StatusResult>;
```

`packages/cli/src/lib/loadConfig.ts`:

```ts
import type { ObpubConfig } from '@obpub/core/config';

/**
 * cwd에서 위로 거슬러 올라가며 `obsidian-blog.config.ts` (또는 .mjs/.js)를 찾는다.
 * 발견하면 동적 import → default export를 검증된 ObpubConfig로 반환.
 *
 * 발견 못하면 `defineConfig({ vaults: [{ path: cwd }] })` 디폴트로 폴백한다.
 * 단, 호출자가 explicit path를 줄 때는 위 탐색을 건너뛸 수 있도록 인자 시그니처 제공.
 *
 * 디폴트 폴백 시 stderr에 "no config found, falling back to defaults at <cwd>"를 로그한다.
 */
export async function loadConfig(opts?: {
  cwd?: string;
  configPath?: string;
}): Promise<ObpubConfig>;
```

`packages/cli/src/bin.ts`:

```ts
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('obpub')
  .description('Obsidian-Publish-OSS CLI')
  .version('0.0.0');

program
  .command('status <file>')
  .description('Show whether a note is PUBLIC or PRIVATE and why')
  .option('-c, --config <path>', 'path to obsidian-blog.config.ts')
  .action(async (file: string, opts: { config?: string }) => {
    // 1. loadConfig({ configPath: opts.config }) 호출
    // 2. runStatus(file, config) 호출
    // 3. 결과를 한 줄로 stdout에 출력. 형식 예:
    //    "relative/path/note.md → PUBLIC (reason: frontmatter public: true)"
    //    "relative/path/note.md → PRIVATE (reason: no public marker)"
    //    "relative/path/note.md → PRIVATE (reason: tripwire — ...)"
    // 4. PUBLIC이면 exit 0, PRIVATE이면 exit 0 (status는 진단 도구이므로
    //    private이라고 비정상 종료하지 않는다). 에러는 exit 1.
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`obpub: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
```

### 4. TDD — 실패 테스트 먼저

`packages/cli/tests/status.test.ts`에 다음 케이스를 작성한다 (전부 실패하는 상태로 시작 → 구현 후 통과):

1. **frontmatter public: true** → `verdict: 'PUBLIC'`, `reason`에 `frontmatter public: true` 포함.
2. **`#public` 태그** → `verdict: 'PUBLIC'`, `reason`에 `tag #public` 포함.
3. **마커 없음** → `verdict: 'PRIVATE'`, `reason: 'no public marker'`.
4. **tripwire**: `private/secret.md`에 `public: true`가 있어도 `verdict: 'PRIVATE'`, `tripwireFired: true`.
5. **vault 밖 절대경로** → throw, 메시지에 vault root 포함.
6. **비-.md 확장자** → throw.
7. **존재하지 않는 파일** → throw (ENOENT).
8. **상대경로 입력** → vault root 기준으로 정상 분류.
9. **`unsafeAllowPrivateFolder: true`** 설정에서 `private/secret.md`의 `public: true`는 PUBLIC으로 인정 (tripwire 우회 옵션 동작 확인).

테스트 fixture는 임시 디렉토리(`os.tmpdir()` + `randomUUID()`)에 케이스마다 생성하고 `afterEach`에서 정리한다. 기존 `packages/core/tests/fixtures/vault-mixed`는 **건드리지 않는다** (privacy 회귀 테스트가 의존).

bin.ts의 stdout 형식 검증은 별도로 `packages/cli/tests/bin.test.ts` (선택)에서 child_process.execFile로 한 번만 smoke 테스트해도 좋다 — 단, 이 파일이 무거우면 omit 가능. 핵심은 `runStatus` 단위 테스트다.

### 5. package.json 스크립트 추가

루트 `package.json`은 건드리지 않는다 (`pnpm test`/`pnpm lint`는 루트만). `packages/cli/package.json`은 다음 항목 보강:

```jsonc
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@obpub/core": "workspace:*",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "vitest": "<루트와 동일한 버전>"
  }
}
```

`devDependencies`에 vitest를 추가하고 `pnpm install` 결과 lockfile이 변경되면 함께 커밋한다.

`packages/cli/tsconfig.json`을 확인하고 `tests/` 경로가 typecheck 대상이 되도록 `include`를 조정한다 (기존 패키지 패턴을 따른다).

### 6. 출력 형식 — 정확한 문자열

stdout(성공) 한 줄. 끝에 `\n` 필수.

```
{relativePath} → {VERDICT} (reason: {reason})
```

- `relativePath`는 vault root 기준 POSIX 슬래시.
- VERDICT는 `PUBLIC` 또는 `PRIVATE` 대문자.
- reason은 classify의 reason 그대로. tripwire가 발화하면 reason이 이미 `tripwire — ...`로 시작하므로 추가 가공 불필요.

이 형식을 `packages/cli/tests/status.test.ts`의 `formatStatusLine(result)` 단위 테스트에서도 검증한다 — `runStatus` + `formatStatusLine`을 분리해 두면 bin.ts에서 print만 한다.

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
```

추가로 cli 단독:

```bash
pnpm --filter @obpub/cli test
```

세 명령 모두 0 exit. 새로 추가한 status 테스트 9개 이상이 통과해야 한다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 임시 vault 만들어서 수동 smoke (선택):
   ```bash
   mkdir -p /tmp/obpub-status-smoke && \
     printf -- '---\npublic: true\n---\nhi\n' > /tmp/obpub-status-smoke/foo.md && \
     pnpm --filter @obpub/cli exec node --experimental-strip-types ./src/bin.ts \
       status /tmp/obpub-status-smoke/foo.md
   ```
   출력에 `→ PUBLIC (reason: frontmatter public: true)` 포함 확인.
3. 아키텍처 체크리스트:
   - 공개 판정 로직을 `packages/cli/`에 재구현하지 **않았는가**? (오직 core의 `classify`만 호출해야 함 — CLAUDE.md CRITICAL.)
   - frontmatter allowlist 외 필드를 stdout에 노출하지 않는가? (status는 reason 외에는 출력하지 않는다.)
   - core 새 export 경로가 ARCHITECTURE.md의 모듈 위치와 일치하는가?
4. 결과에 따라 `phases/step5-cli-commands/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "..."`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단

## 금지사항

- **공개 판정을 CLI에서 재구현하지 마라.** 이유: CLAUDE.md CRITICAL — 결정은 `packages/core/src/privacy/`에 한 곳. CLI는 `classify()`의 결과를 표시만 한다.
- **vault 외부 파일을 분류하지 마라.** 이유: tripwire 경로 매칭이 vault-relative 경로 전제라 외부 경로는 의미가 무너진다. 명시적 throw로 막는다.
- **이 step에서 `obpub dev`/`build`/`audit` 명령을 추가하지 마라.** 이유: 다음 step의 책임. scope 분리.
- **runCorePipeline을 호출하지 마라.** 이유: status는 단일 파일 진단이므로 vault 전체 walk는 과잉. 시동 시간이 사용자 체감 품질을 결정한다.
- **기존 테스트를 깨뜨리지 마라.** 특히 `packages/core/tests/integration/`의 canary(`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`) 검증이 여전히 0회로 통과해야 한다.
- **TODO.md를 임의로 갱신하지 마라.** 이유: phase 메타와 TODO.md 동기화는 별도 정리 작업. 이 step의 산출물은 코드 + phase index만.
