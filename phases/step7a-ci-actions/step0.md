# Step 0: ci-workflow-typecheck-lint-test

GitHub Actions로 PR/메인 push마다 `typecheck → lint → test`를 강제하는 최소 CI workflow를 도입한다. 도그푸드(`apps/blog`) 빌드는 사용자 머신의 절대 vault 경로(`/mnt/c/...`)에 의존하므로 **이 phase에서는 build/audit job을 추가하지 않는다** — 별도 후속 phase(vault path 환경변수화 + fixture 기반 빌드 스모크)에서 다룬다. 이 phase의 책임은 "vault에 의존하지 않는 모든 검증을 CI에서 강제한다"로 한정한다.

## 읽어야 할 파일

먼저 아래를 읽고 현재 빌드/테스트 표면을 파악하라:

- `/home/shine/projects/obsidian_blog/CLAUDE.md` — 명령어 섹션의 머지 전 체크 시퀀스 (`pnpm -r typecheck && pnpm lint && pnpm test`).
- `/home/shine/projects/obsidian_blog/package.json` — 루트 scripts(`typecheck`/`lint`/`test`), `packageManager: "pnpm@10.33.0"`, `engines.node: ">=22.6.0"`.
- `/home/shine/projects/obsidian_blog/.nvmrc` — 정확한 Node 버전(`22.11`).
- `/home/shine/projects/obsidian_blog/pnpm-workspace.yaml` — workspace 패턴.
- `/home/shine/projects/obsidian_blog/eslint.config.js` (또는 `.mjs`/`.cjs` 중 존재하는 것) — flat config가 루트에 있는지 확인.
- `/home/shine/projects/obsidian_blog/vitest.config.ts` (또는 동급) — root projects 구성.
- `/home/shine/projects/obsidian_blog/TODO.md` — Step 7 항목과 v0.1 미결정 사항 컨텍스트.
- `/home/shine/projects/obsidian_blog/phases/step6-apps-blog/index.json` — 직전 phase의 산출물 컨텍스트(이번 phase는 그 위에서 시작).

## 작업

### 1. `.github/workflows/ci.yml` 신설

루트에 `.github/workflows/ci.yml`을 생성한다. 다음 형태(시그니처 수준)를 따른다:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

# 동일 PR/branch에서 새 push가 들어오면 진행 중인 워크플로우를 취소.
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      # pnpm을 먼저 설치해야 setup-node의 cache: 'pnpm'이 동작.
      # 버전은 package.json의 packageManager 필드를 그대로 따른다 (별도 명시 금지 — 단일 진실 원천).
      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm -r typecheck
      - run: pnpm lint
      - run: pnpm test
```

핵심 규칙:
- **단일 job, 단일 OS, 단일 Node 버전.** matrix 빌드는 v0.1 스코프 외 — 확장은 v0.2 후속.
- **`pnpm/action-setup@v4`는 인자 없이 호출**한다. 인자 없이 호출하면 `package.json`의 `packageManager: pnpm@10.33.0`을 자동 인식한다. `version: '10'` 같은 별도 핀 금지(이중 진실 원천 방지).
- **`actions/setup-node@v4`는 반드시 pnpm 설치 *이후*에 와야** `cache: 'pnpm'`이 동작한다(setup-node가 pnpm 바이너리를 찾아 lockfile hash 기반 캐시 키를 만들기 때문). 순서를 바꾸면 캐시 미스 + 경고.
- **`pnpm install --frozen-lockfile`** 강제 — lockfile 동기화 누락 PR을 CI에서 즉시 실패시킨다.
- **`concurrency.cancel-in-progress`**로 같은 PR에 여러 push가 쌓일 때 이전 run을 취소.
- **`permissions: contents: read`** 최소권한 — workflow는 readonly로 충분(코멘트/릴리스 작성 권한 없음).
- **timeout-minutes: 15**로 무한 hang 방지.
- **build/audit step을 추가하지 마라.** 이유: `apps/blog`는 사용자 vault 절대경로에 의존하며, CI 환경에는 그 경로가 없다. 별도 phase에서 vault path를 환경변수로 받게 만들거나 fixture vault로 빌드하도록 정비한 뒤 추가한다. 이 phase에서 무리하게 추가하면 빨간 CI를 그대로 머지하는 패턴이 생긴다.

### 2. (선택) `.github/workflows/README.md` 생성

`.github/workflows/`가 처음 만들어지는 디렉토리이므로, 이 폴더의 의도를 한 줄로 적어두는 작은 README가 있으면 미래 작업이 편하다. **단, 없어도 AC에는 영향 없음**. 시간이 부족하면 생략해도 된다. 다른 새 마크다운 문서는 만들지 마라(LICENSE/CONTRIBUTING/README 보완은 후속 phase).

### 3. 다른 파일을 건드리지 마라

이 step에서는 `.github/workflows/ci.yml`(필요 시 `.github/workflows/README.md`) **만** 생성한다. `package.json` 스크립트 수정, ESLint/Vitest 설정 변경, 의존성 추가 모두 금지.

### 4. 테스트 정책

이 step에서는 **새 테스트를 작성하지 않는다**. 이유: CI workflow는 단위 테스트 대상이 아니며(YAML 메타파일), 검증은 PR을 푸시했을 때 GitHub가 직접 수행한다. 기존 vitest 스위트가 그대로 통과하는지만 확인한다.

## Acceptance Criteria

```bash
# 1. workflow YAML 정합성 — actionlint가 있으면 사용, 없으면 yamllint 또는 Python yaml.safe_load로 파싱만 확인.
#    프로젝트에 추가 의존성을 도입하지 말 것 — 아래는 "있으면 사용" 원칙.
command -v actionlint >/dev/null 2>&1 && actionlint .github/workflows/ci.yml || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"

# 2. workflow가 호출하는 모든 명령이 로컬에서 통과해야 한다.
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm lint
pnpm test
```

위 4개 명령이 전부 0 exit이어야 step 완료. 특히 `--frozen-lockfile`은 lockfile drift가 없는지 검증하는 핵심이다 — 만약 실패한다면 "왜 lockfile이 어긋나는지"를 먼저 진단하라(보통 누군가 `pnpm install` 후 lockfile commit을 빠뜨린 경우).

## 검증 절차

1. 위 AC 커맨드 실행. `--frozen-lockfile` 실패 시 **lockfile을 무단 갱신하지 말고** error로 보고하라(루트 원인이 다른 phase의 누락일 수 있음).
2. 아키텍처 체크리스트:
   - workflow에 `apps/blog` build / audit step이 들어가 있지 않은가? (의도적 제외, 추가 시 깨짐)
   - pnpm 버전이 `package.json` 외에 별도로 핀되어 있지 않은가? (단일 진실 원천)
   - Node 버전이 `.nvmrc` 외에 별도로 핀되어 있지 않은가? (`node-version-file: .nvmrc` 사용)
   - `permissions:`가 `contents: read`로 좁혀져 있는가?
   - workflow 외 파일 수정이 없는가?
3. 결과에 따라 `phases/step7a-ci-actions/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "한 줄 요약(작성된 workflow의 jobs/steps + 통과한 검증 명령)"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`apps/blog` build나 `pnpm obpub audit`을 workflow에 추가하지 마라.** 이유: 이들은 사용자 머신의 절대 vault 경로(`/mnt/c/Users/shine/Documents/Obsidian`)에 의존하며 CI 환경에 그 경로가 존재하지 않는다. 추가하면 main의 CI가 항상 빨간색이 된다. vault path 환경변수화는 후속 phase의 책임.
- **pnpm 버전을 workflow에 별도로 핀하지 마라.** 이유: `package.json#packageManager`가 단일 진실 원천이며, 두 곳에서 핀하면 업그레이드 시 drift가 발생한다. `pnpm/action-setup@v4`는 인자 없이 호출.
- **Node 버전을 workflow에 직접 명시하지 마라.** 이유: `.nvmrc`(현재 `22.11`)가 단일 진실 원천. `node-version-file: .nvmrc` 사용.
- **lockfile을 임의로 갱신하지 마라.** 이유: `--frozen-lockfile`이 깨지는 것은 다른 곳의 누락 신호. 무단 갱신은 그 누락을 은폐한다. error로 올려라.
- **OS/Node matrix를 추가하지 마라.** 이유: v0.1 스코프 외(plan에 명시). 단일 ubuntu-latest + Node 22.11로 충분.
- **CodeQL/Dependabot/release workflow를 함께 추가하지 마라.** 이유: 별도 phase(릴리스 준비)의 책임. 한 PR에 한 가지 관심사.
- **기존 테스트를 깨뜨리지 마라.**
- **TODO.md를 임의로 갱신하지 마라.** Step 7 전체 완료 시점에 일괄 정리한다.
