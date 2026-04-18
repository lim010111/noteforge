# Step 2: walk-vault

## 작업

`packages/core/src/discover/walk.ts` + 그 테스트를 **TDD**로 작성한다. vault 루트를 재귀 walk하며 `.md` 파일 경로를 yield하고, `ignore` glob과 심볼릭 링크 정책을 준수한다.

## 읽어야 할 파일

- `packages/core/src/types.ts` — 새 타입이 기존과 충돌하지 않도록.
- `packages/core/src/privacy/classify.ts` — `picomatch` 사용 패턴(이미 deps + 일관성 위해 동일 라이브러리 사용 권장).
- 이전 step: `packages/core/src/config.ts` — `ObpubConfig.vaults[].ignore`와 시그니처 호환. 이 step은 config를 직접 import하지 않지만 입력 형태를 맞춤.
- 이전 step: `packages/core/src/discover/parseNote.ts` — walker가 yield한 entry를 consumer가 받아 `parseNote()`로 넘긴다. walker는 content를 읽지 않는다.

## 공개 인터페이스

```ts
export interface WalkOptions {
  readonly root: string;                   // absolute vault path
  readonly ignore: readonly string[];      // glob patterns (POSIX), root-relative
  readonly followSymlinks?: boolean;       // default false
  readonly extensions?: readonly string[]; // default ['.md']
}

export interface WalkEntry {
  readonly path: string;          // absolute, OS-native separators
  readonly relativePath: string;  // POSIX, no leading slash
}

export async function* walkVault(options: WalkOptions): AsyncIterable<WalkEntry>;
```

Async generator. caller가 `for await (const entry of walkVault(...))` 패턴으로 스트리밍 소비.

## 동작 규칙

1. `fs.promises.readdir(dir, { withFileTypes: true })`로 재귀 탐색.
2. 각 child의 `relativePath`(root 기준 POSIX)가 `ignore` 패턴 매칭 → **서브트리 진입 자체를 스킵**(readdir 호출 안 함). 이유: 대용량 vault 성능.
3. `Dirent.isSymbolicLink()` true이고 `followSymlinks !== true` → 진입하지 않음(파일/디렉토리 모두).
4. Hidden 파일(이름이 `.`으로 시작)은 기본 스킵. `.obsidian/`, `.trash/`는 ignore에 이미 포함된 경우 그 규칙으로 처리(이중 차단 OK).
5. 확장자 필터: 기본 `.md`만 yield. 매칭은 **case-insensitive** (`.MD`도 포함).
6. `ENOENT`/`EACCES` 같은 일시 IO 오류 → 해당 entry 스킵 + `console.warn` (경로 포함). 전체 walk는 계속.
7. `relativePath`는 항상 POSIX 슬래시(`/`). Windows에서도 `path.posix` 또는 직접 replace로 정규화.
8. `path` 필드는 OS-native(보통 절대 경로 그대로). caller가 fs로 다시 읽을 때 사용.

## 테스트 (TDD)

`packages/core/tests/walk.test.ts`에 최소 9 케이스. `os.tmpdir()` 밑에 임시 vault를 만들고 `afterEach`/`afterAll`에서 cleanup.

1. 단일 `note.md` → 한 entry, `relativePath === 'note.md'`.
2. 중첩 `a/b/c.md` → `relativePath === 'a/b/c.md'`.
3. `ignore: ['private/**']` + `private/secret.md` 존재 → 결과에 없음.
4. `ignore: ['.obsidian/**']` + `.obsidian/config.json`, `.obsidian/cache/x.md` → 모두 결과에 없음(서브트리 통째로 스킵).
5. `.txt` 파일은 기본 확장자 정책에서 미포함.
6. `notes/Foo.MD` (대문자 확장자) → 포함됨.
7. `followSymlinks` 기본값(false)에서 심볼릭 링크 디렉토리 진입 안 함 — symlink 대상의 파일이 결과에 없음.
8. `followSymlinks: true`에서는 심볼릭 링크 디렉토리 진입 + 그 안의 `.md`가 결과에 있음. (테스트 환경에서 symlink 생성 권한 없으면 `it.skip`로 우회 가능.)
9. `root`가 존재하지 않는 경로 → async iterator가 빈 결과 + `console.warn` 한 번 호출.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

새 테스트 9개 통과 + 기존 회귀 0건.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - **CRITICAL**: `ignore` 패턴 매칭이 디렉토리 레벨에서 발생하면 그 안에서 `readdir`을 호출하지 않는다(테스트로 검증하기 어려우면 코드 리뷰로 확인).
   - `relativePath`에 `\\`(Windows 슬래시)가 등장하지 않는다.
   - walker가 file content를 읽지 않는다(`fs.readFile`/`readFileSync` import 0건; `readdir`/`stat`/`lstat`만 사용).
3. `phases/step2a-core-config-discover/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "discover/walk.ts + 9 tests + async generator + ignore subtree skip + symlink default off"`
   - 실패/차단 → error/blocked 기록.

## 금지사항

- **walker에서 file content를 읽지 마라.** 이유: discovery만 책임. 읽기는 `parseNote` consumer 책임. 섞으면 스트리밍/병렬화가 어려워지고 테스트 격리가 깨진다.
- **`ignore` 패턴을 walker가 강제로 추가하지 마라.** 이유: 강제 병합은 `config.ts`의 책임(이미 `private/**`, `.obsidian/**`, `.trash/**` merge됨). walker가 다시 추가하면 이중 로직 + tripwire 단일 출처 위반.
- **`followSymlinks` 기본값을 `true`로 하지 마라.** 이유: vault 밖 경로 탈출 위험. opt-in 필수.
- **fixture를 레포 안에 commit하지 마라.** 이유: 이 step의 테스트 fixture는 `os.tmpdir()`에 동적 생성. 레포에 들어갈 통합 fixture(`vault-mixed/`)는 다음 phase(C)의 책임.
- 기존 테스트를 깨뜨리지 마라.
