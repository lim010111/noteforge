# Step 0: cli-tsup-build

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/TODO.md` (Step 7 항목)
- `/packages/cli/package.json` — 현재 `bin: "./src/bin.ts"`, `--experimental-strip-types` 의존
- `/packages/cli/src/bin.ts` — shebang 포함 entry
- `/packages/cli/src/commands/*.ts`, `/packages/cli/src/lib/loadConfig.ts` — `@obpub/core/*` subpath import 위치
- `/packages/core/package.json` — `exports`가 모두 `./src/*.ts` (이게 번들링 결정의 핵심)
- `/.github/workflows/ci.yml` — 현재 install/typecheck/lint/test 4단계
- `/.nvmrc` — `22.11`
- `/eslint.config.mjs` — flat config, `dist/**` ignore 추가 필요 여부 확인
- `/.gitignore` — `dist/` 이미 포함됨

## 작업

`@obpub/cli`를 self-contained npm 발행 가능 형태로 빌드한다. consumer 환경의 `--experimental-strip-types` 의존을 완전히 제거한다. 다른 패키지(`core`, `astro-integration`, `theme-default`)는 건드리지 않는다.

### 1) `packages/cli/package.json` 수정

- `dependencies`:
  - `commander`만 남긴다 (consumer가 install 시점에 받아야 할 외부 런타임 deps).
  - `@obpub/core`는 **제거**. 이유: 아래 tsup 설정에서 번들될 것이므로 런타임 의존이 아님.
- `devDependencies` 추가:
  - `tsup`: `^8.3.0` (또는 현 시점 최신 8.x)
  - `@obpub/core`: `workspace:*` (빌드 시점 source 참조)
- `scripts`:
  - `build`: `"tsup"`
  - `obpub`: `"node ./dist/bin.js"` (기존 strip-types 버전 교체)
  - `obpub:dev`: `"node --experimental-strip-types ./src/bin.ts"` (개발 시 src 직접 실행, 선택적 보존)
  - `prepublishOnly`: `"pnpm typecheck && pnpm build"`
  - `typecheck`, `test`는 그대로.
- `bin`:
  ```json
  "bin": { "obpub": "./dist/bin.js" }
  ```
- `files`: `["dist", "README.md", "LICENSE"]`
- `engines`: `{ "node": ">=22.6.0" }` (루트와 정렬)
- `private: true`는 **유지** (실제 publish는 step7e 범위, 이번엔 파이프라인만 검증).

### 2) `packages/cli/tsup.config.ts` 신규 작성

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  noExternal: [
    '@obpub/core',
    'gray-matter',
    'hast-util-to-html',
    'mdast-util-from-markdown',
    'mdast-util-to-hast',
    'micromatch',
    'picomatch',
    'zod',
  ],
  banner: { js: '#!/usr/bin/env node' },
});
```

핵심 결정:
- `format: 'esm'` — `package.json type: module`과 정렬.
- `target: 'node22'` — `.nvmrc`(22.11)와 root engines(`>=22.6.0`)에 정렬.
- `noExternal`로 `@obpub/core`와 core의 transitive 런타임 deps를 모두 번들. 이유: core는 `.ts`를 직접 export하므로 external로 두면 consumer Node가 import 실패. 또한 consumer가 `gray-matter` 등을 별도 install하지 않아도 동작하도록 self-contained 바이너리화.
- `banner.js` shebang은 src에도 이미 있지만 이중 안전.

### 3) `.github/workflows/ci.yml` 보강

기존 `pnpm test` 단계 다음에 두 단계 추가:

```yaml
      - run: pnpm --filter @obpub/cli build
      - run: node packages/cli/dist/bin.js --help
```

첫 단계로 빌드 검증, 둘째 단계로 self-contained 실행 smoke 검증 (모듈 누락이 있으면 즉시 ERR_MODULE_NOT_FOUND로 실패).

### 4) ESLint 처리

- `eslint.config.mjs` 확인. `ignores`에 `**/dist/**`가 포함되어 있지 않으면 추가:
  ```js
  { ignores: ['**/node_modules/**', '**/dist/**', /* 기존 항목들 */] }
  ```
- 신규 `tsup.config.ts`는 strict TS 통과해야 함. `defineConfig`가 자체 타입을 제공하므로 별도 타입 작업 불필요.

### 5) 기타

- `pnpm install` 실행 후 `pnpm-lock.yaml` 변경 사항 (tsup + 그 transitive deps) 커밋에 포함.
- `dist/`는 절대 커밋하지 마라 (`.gitignore`로 이미 차단되어 있지만 강제 add 금지).
- 빌드 후 다음 grep으로 사고 방지 점검:
  - `! grep -q "DO_NOT_LEAK_BANANA_6f3c1" packages/cli/dist/bin.js`
  - `! grep -q "CLAUDE_COMMENT_LEAK_77b" packages/cli/dist/bin.js`
  fixture 캐너리가 번들에 빨려들어가면 안 됨. (정상적인 빌드라면 들어갈 일이 없으나, core import가 fixture를 참조하지 않는지 확인.)

### TDD 면제 (부트스트랩 step)

이 step에서는 단위 테스트를 새로 작성하지 않는다. 빌드 부트스트랩 성격이며, 검증은 아래 AC의 **빌드 + smoke run + 캐너리 grep**으로 갈음한다 (harness §4.8 부트스트랩 예외). 기존 379개 vitest 테스트는 전부 통과해야 한다 — CLI 테스트는 `src/`를 직접 import하므로 빌드 변경과 무관하게 그대로 작동한다.

## Acceptance Criteria

```bash
pnpm install
pnpm --filter @obpub/cli build
test -f packages/cli/dist/bin.js
node packages/cli/dist/bin.js --help
! grep -q "DO_NOT_LEAK_BANANA_6f3c1" packages/cli/dist/bin.js
! grep -q "CLAUDE_COMMENT_LEAK_77b" packages/cli/dist/bin.js
pnpm -r typecheck
pnpm lint
pnpm test
```

모든 명령이 `0` 종료 코드여야 한다. `--help` 출력에 `obpub` 서브커맨드 목록(`dev`, `build`, `audit`, `status`)이 보여야 한다.

## 검증 절차

1. 위 AC 커맨드 전부 실행 — 한 줄이라도 실패하면 미완.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md 디렉토리 구조 준수? (변경은 `packages/cli/` + `.github/workflows/` + 루트 lockfile에만)
   - ADR 기술 스택 범위 내? (tsup은 표준 빌드 도구, 신규 도입 정당화)
   - CLAUDE.md CRITICAL 규칙 위반 없음? (privacy 파일 무수정, frontmatter allowlist 무관, transclude/tripwire 무관)
3. 결과에 따라 `phases/step7b-cli-build-pipeline/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "tsup으로 packages/cli/dist/bin.js 자체 포함 ESM 빌드(Node 22 target). @obpub/core·gray-matter·zod 등 transitive deps inline. CI에 build + --help smoke 추가. --experimental-strip-types 런타임 의존 제거."`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `packages/core/`, `packages/astro-integration/`, `packages/theme-default/`, `apps/blog/` **어떤 파일도 수정하지 마라**. 이유: scope가 CLI 빌드 파이프라인 한 가지이며, 다른 패키지의 빌드 파이프라인은 별도 phase로 분리해야 작은 PR 원칙(CLAUDE.md 개발 프로세스)에 부합. 특히 core를 건드리면 별도 리뷰 트랙이 강제됨.
- `packages/cli/package.json`의 `name` 필드를 변경하지 마라. 이유: 프로젝트명/npm 네임스페이스 확정은 step7e의 책임이며 사용자 결정이 필요한 사안이다.
- `packages/cli/package.json`에서 `private: true`를 제거하지 마라. 이유: 이번 phase는 빌드 파이프라인 검증까지만 책임진다. 실제 npm publish 활성화는 step7e 범위.
- `--no-verify`, `--no-frozen-lockfile`, `--no-gpg-sign` 등 우회 플래그를 사용하지 마라. 이유: CI/lockfile 무결성 보장.
- privacy 파일(`packages/core/src/privacy/**`)의 import 경로를 변경하지 마라. 이유: 위 1번 금지(core 무수정)와 동일.
- 기존 379 vitest 테스트가 하나라도 깨지면 안 된다. 깨지면 root cause를 진단해 고쳐라 — 테스트를 무시하거나 skip하지 마라.
- `dist/` 디렉토리를 `git add`하지 마라.
- 다른 패키지에 tsup을 함께 도입하지 마라 (core/astro-integration/theme-default 빌드는 별도 phase).
