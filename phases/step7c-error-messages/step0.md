# Step 0: config-error-file-path

## 배경

`obpub` CLI 사용자가 잘못된 `obsidian-blog.config.ts`로 빌드하면, 현재는 다음과 같은 메시지를 본다.

```
obpub: vaults[0].path: 절대 경로여야 합니다
```

이 메시지에 **config 파일의 절대 경로**가 없어서 VS Code/Obsidian/Cursor 같은 에디터의 터미널에서 cmd-click(혹은 ctrl-click)으로 점프할 수 없다. plan 문서(`/home/shine/.claude/plans/public-fizzy-patterson.md`)의 "저자(Author) UX" 절에서도 명시한다:

> 에러 메시지에는 file:line 포함 — Obsidian / VS Code 터미널에서 바로 점프 가능.
> config 에러: Zod raw 에러 대신 감싸서 "vaults[0].path: 경로가 존재하지 않습니다 (/home/shine/wrong-path)" 같은 친절한 메시지.

이 step은 **config 관련 에러 메시지**에 한해 file:line 정보를 포함시키는 작업이다.

## 읽어야 할 파일

먼저 아래를 읽고 현재 구조를 파악하라:
- `/home/shine/projects/obsidian_blog/packages/core/src/config.ts` — `defineConfig`, `ObpubConfigError`, `wrapZodError`
- `/home/shine/projects/obsidian_blog/packages/cli/src/lib/loadConfig.ts` — `loadConfigWithPath`, `assertVaultPathsExist`, `importConfigFile`
- `/home/shine/projects/obsidian_blog/packages/core/tests/config.test.ts` — 기존 14개 테스트
- `/home/shine/projects/obsidian_blog/packages/cli/tests/loadConfig.test.ts` — 기존 테스트 (구조 파악용)
- `/home/shine/projects/obsidian_blog/packages/cli/src/bin.ts` — 최상위 catch에서 `obpub: <message>` 형태로 출력

## 작업

### 1. `ObpubConfigError`에 file:line 필드 추가

`packages/core/src/config.ts`의 `ObpubConfigError` 클래스를 다음 시그니처로 확장한다.

```ts
export interface ObpubConfigErrorOptions {
  readonly configPath?: string;   // 설정 파일 절대 경로 (있으면)
  readonly line?: number;         // 1-base. 추출 가능한 경우 (TS 신택스 에러 등)
  readonly column?: number;       // 1-base. line이 있을 때만 의미 있음
  readonly cause?: unknown;       // 원본 에러
}

export class ObpubConfigError extends Error {
  readonly configPath: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  readonly reason: string;
  // message는 다음 형식: 
  //   - configPath + line + column 있음: "<configPath>:<line>:<column>: <reason>"
  //   - configPath + line 있음: "<configPath>:<line>: <reason>"
  //   - configPath 있음: "<configPath>: <reason>"
  //   - 둘 다 없음: "<reason>"
  constructor(reason: string, opts?: ObpubConfigErrorOptions) { ... }
}
```

기존 호출자 `getClassifyRule`가 `new ObpubConfigError(reason, configPath)`로 두번째 인자를 string으로 넘기던 형태는 깨도 된다 — 호출 지점이 한 곳뿐이니 같은 PR에서 옵션 객체 형태로 고친다.

`wrapZodError`는 `defineConfig` 호출자가 `configPath`를 모르기 때문에 그대로 두고, 새 헬퍼 `wrapZodErrorWithPath(error, configPath)`를 추가하거나 `defineConfig`에 두번째 인자 `configPath?: string`를 받도록 확장한다. **권장**은 후자 — 호출 사이트가 적고 더 일관적이다:

```ts
export function defineConfig(input: ObpubConfigInput, opts?: { configPath?: string }): ObpubConfig
```

호출자가 `configPath`를 안 넘기면 기존 동작과 동일.

### 2. `loadConfig.ts`에서 config 파일 경로를 에러에 주입

`importConfigFile(absPath)`:
- `defineConfig(exported, { configPath: absPath })`를 호출하도록 수정.
- `import(url)` 자체가 throw할 때 (TS 신택스 에러, 모듈 import 실패 등) 잡아서 가능한 한 line:column을 추출해 `ObpubConfigError`로 rewrap한다. 추출 전략:
  - `err.message` 또는 `err.stack`에서 정규식으로 `<configPath>:<line>:<column>` 패턴 매칭. 일반적으로 V8/Node strip-types는 `at file:///.../obsidian-blog.config.ts:5:7` 같은 프레임을 stack에 남긴다.
  - 매칭 실패 시 line/column 없이 `configPath`만 붙여서 rewrap (cause 보존).
  - "no default export" 케이스도 `ObpubConfigError`로 rewrap한다 (configPath 포함).

`assertVaultPathsExist(config, opts?: { configPath?: string })`:
- 시그니처에 옵션 추가, vault 경로 부재/디렉터리 아님 케이스를 `ObpubConfigError`로 throw하고 `configPath`를 넘긴다.
- 호출자 `loadConfigWithPath`에서 `configPath`를 전달.

`resolveLoaded`의 fallback 경로 (`configPath: null`)는 그대로 두되, fallback에서 만든 default config가 `assertVaultPathsExist`로 실패하지 않도록 (cwd가 디렉터리이면 OK).

### 3. `bin.ts` 최상위 catch는 변경 최소화

`obpub: <err.message>` 형식을 유지한다 — `ObpubConfigError`의 `message`가 이미 `<configPath>:<line>:<col>: <reason>` 형태이므로 추가 가공 불필요. **단** `err.message` 가 이미 `obpub:` prefix를 포함할 수 있는 케이스 방어는 하지 않는다 (지금 코드 어디서도 그렇게 throw하지 않음).

## TDD 절차

`packages/core/tests/config.test.ts`에 다음 케이스를 **먼저 추가**하고 실패 확인 후 구현:

1. `defineConfig(invalid, { configPath: '/abs/cfg.ts' })`가 throw하는 `ObpubConfigError`의 `message`가 `'/abs/cfg.ts: vaults[0].path: 절대 경로여야 합니다'` 같은 형태로 `configPath` prefix를 포함한다.
2. `configPath` 없이 호출하면 기존과 동일한 메시지 (회귀 보호).
3. `ObpubConfigError`의 `configPath`/`line`/`column` 필드가 옵션대로 채워진다.
4. `line`만 주고 `column` 없으면 `<path>:<line>: <reason>` 형식.
5. `line` 없이 `column`만 주면 column 무시 (line이 우선 조건).

`packages/cli/tests/loadConfig.test.ts`에 다음 케이스 추가:

6. 존재하지 않는 vault path를 가진 config 파일을 로드하면 `ObpubConfigError`가 throw되고 `message`가 config 파일 절대 경로를 포함한다 (`configPath: <abs>` 검증).
7. 일부러 신택스가 깨진 임시 `*.mjs` config 파일을 만들어 import 실패를 유도하면 `ObpubConfigError`로 rewrap되며 `configPath`가 채워진다 (line/column은 best-effort — 둘 다 채워지면 통과, 아니면 적어도 configPath만 검증).
8. `defineConfig`가 export되지 않은 (default export 없음) config 파일은 `ObpubConfigError`로 rewrap되며 `configPath`가 채워진다 (현재는 plain `Error`).

기존 테스트가 깨질 수 있다 — `ObpubConfigError` 생성자 시그니처 변경으로 인한 컴파일 에러는 즉시 호출지점을 옵션 객체로 마이그레이션해서 해결한다. 동작이 바뀐 부분 (예: assertVaultPathsExist가 plain Error → ObpubConfigError)이 기존 테스트의 단언과 충돌하면 그 단언을 새 동작에 맞게 갱신한다 (단순히 메시지 substring 체크라면 그대로 통과해야 정상).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

세 명령 모두 0 exit. 신규/수정 테스트는 명시적으로 통과해야 하며, 기존 테스트 회귀 0건.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 수동 스모크 (옵션, 의심 시): 임시로 `apps/blog/obsidian-blog.config.ts`의 `vaults[0].path`를 존재하지 않는 경로로 바꾼 뒤 `pnpm --filter @obpub/cli build && node packages/cli/dist/bin.js status notes/foo.md` 시도. 출력에 config 파일 절대 경로가 포함되어 있는지 눈으로 확인. 끝나면 원복.
3. 아키텍처 체크리스트:
   - `packages/core/src/privacy/**`는 건드리지 않음 (CRITICAL: privacy 결정 로직 변경 금지).
   - `packages/core/src/config.ts`의 export 추가는 OK.
   - 신규 의존성 추가 없음 (Zod, Node built-in만 사용).
4. 결과에 따라 `phases/step7c-error-messages/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`packages/core/src/privacy/**`를 수정하지 마라.** 이유: privacy 결정 로직은 별도 PR에서만 다룬다 (CLAUDE.md CRITICAL). 본 step은 에러 포맷팅만이다.
- **`bin.ts`의 catch 형식을 크게 바꾸지 마라.** 이유: `obpub: <message>` 한 줄 출력은 사용자 학습된 UX. `ObpubConfigError.message`가 이미 file:line을 포함하므로 추가 분기 불필요.
- **새 third-party 라이브러리를 도입하지 마라.** 이유: 본 step은 1KB 미만 디프 범위에서 끝나야 한다. stack 파싱은 정규식이면 충분.
- **기존 테스트를 깨뜨리지 마라.** 시그니처 변경으로 인한 컴파일 에러는 즉시 호출지점을 마이그레이션. 의도적으로 동작이 바뀐 케이스만 단언을 갱신한다.
- **`ObpubConfigError` 외에 새 에러 클래스를 도입하지 마라.** 이유: status 입력 에러는 step 1에서 별도 처리. 본 step은 config 계열에만 집중.
