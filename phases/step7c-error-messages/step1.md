# Step 1: status-input-error-file-path

## 배경

`obpub status <file>`은 저자가 "이 노트가 진짜 공개되나?"를 확인하는 핵심 도구다 (plan 문서 "저자 UX" 절). 입력 파일이 vault 밖이거나 `.md`가 아니거나 파일이 존재하지 않으면 현재는 plain `Error`가 throw되고 `bin.ts`가 `obpub: <message>` 한 줄로 출력한다. 메시지에 **대상 파일의 절대 경로**가 들어 있더라도 터미널이 그것을 클릭 가능한 link로 인식하려면 `<absPath>:<line>` 패턴이 필요하다.

이 step은 status 명령의 입력 검증 에러에 file:line 포맷을 적용하고, bin.ts 최상위 catch에서 `ObpubError` 계열을 일관되게 출력한다.

## 선행 조건 (전 step 산출물)

- step 0에서 `packages/core/src/config.ts`에 `ObpubConfigError` (옵션 객체 시그니처)가 도입되어 있다.
- step 0에서 `loadConfig.ts`가 모든 config 계열 에러를 `ObpubConfigError`로 throw하도록 정리되어 있다.

## 읽어야 할 파일

먼저 아래를 읽고 현재 구조를 파악하라:
- `/home/shine/projects/obsidian_blog/packages/cli/src/commands/status.ts` — 현재 plain `Error` 3종 throw
- `/home/shine/projects/obsidian_blog/packages/cli/src/bin.ts` — 최상위 catch (`process.stderr.write('obpub: ...')`)
- `/home/shine/projects/obsidian_blog/packages/cli/tests/status.test.ts` — 입력 검증 테스트가 이미 일부 있을 가능성. 메시지 substring 단언 형태 확인.
- step 0에서 갱신된 `packages/core/src/config.ts` (`ObpubConfigError` 시그니처)

## 작업

### 1. `ObpubInputError` 클래스 도입

`packages/cli/src/lib/errors.ts` (신규 파일)에 다음을 정의한다:

```ts
export interface ObpubInputErrorOptions {
  readonly filePath?: string;  // 사용자 입력 파일 절대 경로
  readonly line?: number;
  readonly column?: number;
  readonly cause?: unknown;
}

export class ObpubInputError extends Error {
  readonly filePath: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  readonly reason: string;
  // message: 
  //   - filePath + line + column: "<filePath>:<line>:<column>: <reason>"
  //   - filePath + line:        "<filePath>:<line>: <reason>"
  //   - filePath only:          "<filePath>: <reason>"
  //   - 없음:                   "<reason>"
  constructor(reason: string, opts?: ObpubInputErrorOptions) { ... }
}
```

`ObpubConfigError`와 거의 동일한 포맷팅 규칙. 두 클래스의 공통 포맷팅 로직은 같은 파일 내 private 함수로 추출해도 OK이지만 core ↔ cli 의존 방향을 깨면 안 되므로 core의 형태를 cli가 import해서 재사용하지는 마라 (단순 복붙이 의존 위험보다 낫다).

### 2. `status.ts`의 plain `Error` 3종 교체

기존 throw 위치:
- `'config has no vaults; cannot resolve note path'` — 이건 사실 config 문제이므로 step 0의 `ObpubConfigError`로 throw (filePath 없이 reason만).
- `'file is outside vault root: ...'` — `ObpubInputError`로 throw, `filePath: absPath`, `line: 1`.
- `'only .md files can be classified, got: ...'` — `ObpubInputError`로 throw, `filePath: absPath`, `line: 1`.
- 추가: `fs.readFile`이 ENOENT면 `ObpubInputError(`file not found`, { filePath: absPath, line: 1, cause: err })`로 rewrap.
- `parseNote`가 throw하지는 않지만 (현재 YAML 실패는 console.warn 후 빈 frontmatter로 처리) 만일 향후 throw하게 되면 그 위치에서도 file:line으로 rewrap. 본 step에서는 ENOENT까지만 처리.

`line: 1` 컨벤션을 쓰는 이유: 입력 파일에 라인 정보가 없는 검증 실패라도 `:1`을 붙여 줘야 VS Code/Cursor 터미널의 자동 링크 인식 정규식 (`<path>:<line>`)이 매칭된다. 이는 사실상의 표준이다.

### 3. `bin.ts` 최상위 catch 정리

현재:
```ts
process.stderr.write(`obpub: ${err instanceof Error ? err.message : String(err)}\n`);
```

변경: `ObpubConfigError`/`ObpubInputError`이면 그대로 message 출력 (이미 file:line 포함), 그 외 Error는 기존대로. 즉 분기 자체는 필요 없고, 두 커스텀 에러의 `message`가 이미 올바르게 포맷되어 있으므로 **bin.ts 변경 없음**이 정상이다. 다만 import 사이클이 안 생기는지만 확인해라.

### 4. 기타 명령 (`audit`, `build`, `dev`)

`audit`/`build`는 `loadConfigWithPath`만 호출하고 자체 입력 파라미터에서 파일 경로 검증은 하지 않는다 — 추가 작업 없음. 단 `--dist <path>`가 존재하지 않는 디렉터리를 가리키면 `runAudit`이 어떻게 실패하는지 확인하라. 본 step에서 그것까지 다루진 말고, plain Error로 두라 (range out of scope).

`dev`도 마찬가지로 추가 작업 없음.

## TDD 절차

`packages/cli/tests/status.test.ts`에 다음 케이스를 **먼저 추가**하고 실패 확인 후 구현:

1. vault 밖 경로를 status로 호출하면 `ObpubInputError`가 throw되고 `message`가 `<absPath>:1: ` prefix를 포함한다.
2. `.txt` 같은 비-md 확장자로 호출하면 `ObpubInputError`가 throw되고 `message`가 `<absPath>:1: ` prefix를 포함한다.
3. vault 안의 존재하지 않는 `.md` 경로로 호출하면 `ObpubInputError`가 throw되고 `message`가 `<absPath>:1: ` prefix를 포함한다 (ENOENT rewrap).
4. `ObpubInputError`의 `filePath`/`line`/`column` 필드가 노출된다 (`instanceof`/필드 직접 단언).
5. 정상 케이스 (PUBLIC/PRIVATE 판정)는 회귀 없이 통과 (기존 테스트가 그대로 살아 있어야 함).

기존 테스트가 메시지 substring을 단언하고 있다면 새 prefix 추가로 인해 깨질 수 있다. 그런 경우 단언을 새 형식에 맞게 갱신한다 (예: `expect(msg).toContain('outside vault root')` → 그대로 통과해야 정상).

추가로 `packages/cli/tests/` 어딘가에 (`bin.test.ts` 신규 또는 `status.test.ts`에 묻어서) **bin 통합 스모크**:

6. 자식 프로세스로 `node packages/cli/dist/bin.js status <bad-path>`를 spawn해 stderr가 `obpub: <absPath>:1: ` prefix를 포함하고 exit code가 1인지 확인. (build 산출물을 사용해야 하면 step7b의 결과물에 의존 — 이미 dist/bin.js가 존재하지 않는 환경에서는 skip 처리. **권장**: spawn 대신 `runStatus`를 직접 호출해 `ObpubInputError`를 잡는 단위 테스트로 끝낸다. spawn은 CI 흐름에서 깨지기 쉽다.)

→ 6번은 **단위 테스트로** 처리해라. spawn은 도입하지 마라.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

세 명령 모두 0 exit. 신규/수정 테스트 통과. 기존 테스트 회귀 0건.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `packages/core/src/privacy/**`는 건드리지 않음.
   - `packages/cli/src/lib/errors.ts`는 framework-독립 (cli 패키지 안에 머문다).
   - `bin.ts`는 가능하면 변경 0줄. 변경이 생겼으면 그 이유를 step의 `summary`에 명시.
   - 신규 third-party 의존성 0건.
3. CRITICAL 규칙:
   - 공개/비공개 판정 로직 (`packages/core/src/privacy/**`) 미수정.
   - `private/**` 탬프와이어, `%%...%%` 처리, frontmatter allowlist, transclusion 규칙 어느 것도 건드리지 않는다.
4. 결과에 따라 `phases/step7c-error-messages/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`ObpubInputError`를 `@obpub/core`에 두지 마라.** 이유: status 명령은 CLI 전유 영역이고, core는 framework-독립이어야 한다. 클래스 정의는 `packages/cli/src/lib/errors.ts`에 둔다.
- **`packages/core/src/privacy/**`를 건드리지 마라.** 이유: privacy 결정 로직은 별도 PR. 본 step은 CLI 입력 검증만이다.
- **child_process spawn 기반 통합 테스트를 도입하지 마라.** 이유: CI에서 dist 의존 + 환경 노이즈로 flaky. `runStatus`를 직접 호출하는 단위 테스트로 충분히 cover 가능.
- **새 third-party 라이브러리를 도입하지 마라.** 이유: 정규식 + Node built-in으로 충분.
- **기존 테스트를 깨뜨리지 마라.** 메시지 substring 단언이 새 prefix와 양립하지 않으면 새 형식에 맞게 단언을 갱신하되, 동작 단언 (PUBLIC/PRIVATE 판정 결과 등) 은 절대 약화하지 마라.
- **`bin.ts`의 1줄 출력 컨벤션을 깨지 마라.** `obpub: <message>` 한 줄. message가 이미 file:line을 포함하므로 추가 가공 불필요.
