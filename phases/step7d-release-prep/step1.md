# Step 1: rename-monorepo-to-final-name

## 컨텍스트

step 0에서 npm 점유 확인 완료(`noteforge` + `@noteforge` 가용 가정). 이 step은 monorepo 전체에서 placeholder `obpub` / `obsidian-publish-oss`를 정식명으로 일괄 교체한다.

사용자 확정값:
- **npm scope**: `@obpub` → `@noteforge`
- **루트 패키지명**: `obsidian-publish-oss` → `noteforge`
- **CLI 바이너리 이름**: `obpub` (유지). `package.json`의 `bin` 키 값 그대로.
- **저작권자**: `woohyun`
- **GitHub repo URL**: placeholder. `repository`/`homepage`/`bugs` 메타필드는 일단 `https://github.com/PLACEHOLDER_OWNER/PLACEHOLDER_REPO` 형식으로 박아두고, README에 `<!-- TODO: confirm GitHub repo URL after repo rename -->` 코멘트 추가. step.md 본문에도 메모.

## 읽어야 할 파일

- `/CLAUDE.md` — `## 명령어` 섹션의 `pnpm obpub` CLI는 유지
- `/package.json`
- `/packages/core/package.json`
- `/packages/astro-integration/package.json`
- `/packages/theme-default/package.json`
- `/packages/cli/package.json`
- `/apps/blog/package.json`
- `/tsconfig.base.json`
- `/pnpm-workspace.yaml`
- `/README.md`
- `/docs/PRD.md`, `/docs/ARCHITECTURE.md`, `/docs/ADR.md`, `/docs/UI_GUIDE.md`
- `/apps/blog/obsidian-blog.config.ts`
- TS/Astro 소스 — `rg "@obpub" --type ts --type astro -l` 로 목록 확보

## 작업

### 1. 패키지명/의존성 갱신

| 파일 | 변경 |
|---|---|
| 루트 `package.json` | `"name": "obsidian-publish-oss"` → `"name": "noteforge"`. `description`에서 작업명 `obsidian-publish-oss` 단어를 제거 또는 자연스럽게 다듬기. |
| `packages/core/package.json` | `"name": "@obpub/core"` → `"@noteforge/core"`. `bin`/`scripts`는 그대로. |
| `packages/astro-integration/package.json` | `"name": "@obpub/astro"` → `"@noteforge/astro"`. dependencies 안에 `@obpub/core` 있으면 `@noteforge/core`로. |
| `packages/theme-default/package.json` | `"name": "@obpub/theme-default"` → `"@noteforge/theme-default"`. cross-deps 갱신. |
| `packages/cli/package.json` | `"name": "@obpub/cli"` → `"@noteforge/cli"`. `bin` 키는 `{ "obpub": "..." }` 그대로. cross-deps 갱신. |
| `apps/blog/package.json` | dependencies의 `@obpub/*` 4개를 `@noteforge/*`로. `private: true` 유지. |

각 publishable 패키지(`packages/*`)에 다음 메타필드 **추가** (없으면):
```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/PLACEHOLDER_OWNER/PLACEHOLDER_REPO.git",
  "directory": "packages/<name>"
},
"homepage": "https://github.com/PLACEHOLDER_OWNER/PLACEHOLDER_REPO#readme",
"bugs": { "url": "https://github.com/PLACEHOLDER_OWNER/PLACEHOLDER_REPO/issues" }
```
license 필드는 step 2에서 일괄 추가하므로 여기서는 건드리지 않는다.

### 2. tsconfig path mapping

`tsconfig.base.json`의 `compilerOptions.paths`에서 `@obpub/*` 키 모두 `@noteforge/*`로. value는 그대로 (`packages/*/src/*`).

### 3. 소스/문서 import 경로

`rg "@obpub" -l` 로 잡힌 모든 파일에서 `@obpub`을 `@noteforge`로 치환. 단어 경계로 안전하게:
```bash
rg -l '@obpub' | xargs sed -i 's|@obpub|@noteforge|g'
```
대상에서 **`phases/**` 는 명시적으로 제외**:
```bash
rg -l '@obpub' --glob '!phases/**' | xargs sed -i 's|@obpub|@noteforge|g'
```
변경 후 `git diff -- 'phases/**'`가 비어있는지 확인.

### 4. README 정리

- 라인 102 부근의 `[plan 파일](/.claude/plans/public-fizzy-patterson.md)` 링크 제거 또는 일반 표현으로 대체:
  - 권장: 해당 줄 자체를 삭제. 이유: 사용자 로컬 plan은 외부에 공개하지 않는다.
- README의 패키지 import 예시 (있다면) `@noteforge/*`로 갱신.
- README 상단/하단의 작업명 `obsidian-publish-oss` 표기 정리:
  - 1번째 H1은 그대로 두되 ("Obsidian → Astro 선택적 공개 블로그 SSG"), 그 외에 패키지명 컨텍스트면 `noteforge`로.

### 5. CLAUDE.md 갱신

- 패키지명 참조(`@obpub/core` 등)를 `@noteforge/*`로.
- `## 명령어` 섹션의 `pnpm obpub status` / `pnpm obpub audit`은 **그대로 유지** (CLI 바이너리는 obpub).
- 루트 `## Obsidian-Publish-OSS (작업명)` 헤더는 유지(작업명은 phase 명세상의 의미만 갖고, 실제 패키지명과는 별개).

### 6. docs/*.md

`@obpub` 토큰 일괄 치환은 위 sed로 이미 처리. 검증만:
- `docs/ADR.md`의 ADR-003 (pnpm workspaces) 본문이 패키지명 변경 후에도 의미 유지하는지 확인.
- `docs/ARCHITECTURE.md`의 monorepo 트리/import 예시 일관성.

### 7. lockfile 재생성

```bash
pnpm install
```
`pnpm-lock.yaml`이 갱신되면 한 commit에 함께 포함. lockfile 변경량이 크더라도 분리 commit하지 않는다.

### 8. 빌드/테스트 검증

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```
모두 통과.

## 검증 절차

1. 위 AC 5개 모두 통과.
2. `git grep '@obpub' -- ':!phases/**'` 결과 0건.
3. `git grep 'public-fizzy-patterson' -- ':!phases/**'` 결과 0건 (README 내부 링크 제거 확인).
4. CLAUDE.md `pnpm obpub status` 표기 잔존 확인 (CLI 이름 유지 의도 검증).
5. `apps/blog/obsidian-blog.config.ts`의 import가 `@noteforge/*`로 갱신.
6. `phases/**`는 변경 없음.
7. 성공 → step.md `status: completed`, `summary: "monorepo renamed @obpub → @noteforge (root: noteforge), all imports/configs/docs synced; CLI bin obpub retained; lockfile regenerated; AC pass"`.

## 이 step에서는 새 테스트를 작성하지 않는다

이유: rename + 메타데이터 변경. 동작 로직(특히 `packages/core/src/privacy/**`)은 import 경로 외에 건드리지 않는다. 회귀는 기존 테스트 스위트 + 빌드 AC로 확보.

## 금지사항

- privacy 로직(`packages/core/src/privacy/**`) 코드 자체를 수정하지 마라. 이유: 이 phase는 rename + docs only.
- 새 기능을 끼워넣지 마라(예: 새 export, 헬퍼). 이유: PR 분리 원칙.
- `phases/**`의 과거 step.md를 일괄 sed로 바꾸지 마라. 이유: 역사 보존.
- CLI 바이너리 이름을 `noteforge` 등으로 바꾸지 마라. 이유: 사용자 명시 결정 — `obpub` 유지.
- placeholder repo URL을 임의의 실제 URL로 채우지 마라. 이유: 사용자 미확정. `PLACEHOLDER_OWNER`/`PLACEHOLDER_REPO` 토큰 그대로 두고 README의 TODO 코멘트로 알린다.
