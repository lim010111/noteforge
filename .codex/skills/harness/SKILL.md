---
name: harness
description: Obsidian-Publish-OSS Harness 프레임워크 진입점. phase/step 상태를 자동 감지해 신규 phase 설계, 진행/재개, 에러·차단 복구, 상태 보고 중 적절한 행동을 수행한다. Claude Code 외 런타임(Codex CLI, opencode 등)에서 phase 작업을 시작하거나 재개할 때 사용.
---

# Harness

Obsidian-Publish-OSS의 phase 기반 작업 진행을 자동화하는 진입점 스킬.

## When to Use

- 새 phase를 설계하려 할 때 (TODO.md 또는 plan을 기반으로 첫 phase 후보를 잡고 step 파일을 생성).
- 작성한 phase의 실행을 재개하거나 진행 상태를 확인하려 할 때.
- step 실행이 `error`/`blocked` 상태에서 멈춰 복구가 필요할 때.
- 현재 phase 상태를 사용자에게 보고만 하고 싶을 때 (쓰기 금지 모드).

## Inputs

다음 중 하나의 인자를 입력으로 받는다:

- (빈 입력) — § 2의 상태 머신을 자동 분기.
- `new <name>` — 신규 phase 설계 흐름 강제. `<name>`은 kebab-case slug(`^[a-z0-9-]+$`). 누락 또는 위반 시 사용자에게 재입력을 묻는다.
- `resume` — 활성 phase의 `error`/`blocked` step에 진입(S5/S6).
- `status` — 컨텍스트 로드 + 상태 요약만. 어떤 파일도 쓰지 않으며 사용자에게 질문도 하지 않는다.
- `run` — 실행 대기/진행 중 phase의 요약 + 실행 명령 안내(실행은 사용자 몫).

이외 인자는 위 목록을 안내하고 중단한다.

## Workflow

### 1. 초기 컨텍스트 로드 (무조건 먼저 실행)

호출 즉시 다음을 병렬로 읽어 내부 상태를 구성한다.

필수 파일:
- `CLAUDE.md` (또는 `AGENTS.md`)
- `docs/*.md` 전체
- `README.md`, `TODO.md`
- 프로젝트 루트 문서에서 `정식 계획은 …plans/…` 형식으로 참조된 plan 파일(존재 시)
- `phases/index.json`(존재 시)
- 활성 phase 감지: `phases/index.json`의 첫 non-completed 항목 → 해당 `phases/{dir}/index.json`
- 활성 phase의 첫 non-completed step — `step{N}.md` + `step{N}-output.json`(있으면)

필수 셸 체크:
- 작업 트리가 git 저장소인지 확인
- git 저장소면 워킹 트리 변경/현재 브랜치 조회

상태 불일치 감지 (다음 중 하나라도 참이면 § 2의 S9로 분기):
- `phases/index.json` 또는 `phases/{dir}/index.json` 파싱 실패
- 필수 필드 누락 (`project`, `phase`, `steps[]` 등)
- `index.json`의 step 수와 실제 `step{N}.md` 파일 수 불일치

토큰 한계가 우려되면 큰 파일은 offset/limit으로 필요 부분만 읽는다.

### 2. 상태 머신 (자동 분기)

초기 로드 결과로 아래 조건을 위에서 아래로 평가해 첫 매치 상태를 선택하고 해당 행동을 수행한다.

| # | 감지 조건 | 상태 | 행동 |
|---|---|---|---|
| S0 | 작업 트리가 git 저장소가 아님 | git 미초기화 | 사용자에게 초기화 승인을 받은 뒤 `git init` → `git add -A` → `git commit -m "chore: initial commit"` → 상태 재감지 (대개 S1로 이어짐) |
| S9 | 초기 로드에서 상태 불일치 감지 | 복구 | 구체 불일치 사유를 보고 → 사용자에게 복구 옵션 제시(수동 편집 안내 / `index.json` 재생성 / 해당 phase 재설계). 사용자 확인 없이 자동 수정하지 않는다 |
| S1 | `phases/` 없음 또는 `phases/index.json` 없음 | 신규 | TODO.md·plan 기반 첫 phase 후보 제안 → 사용자에게 scope 확정 → § 4 설계 원칙 따라 step 초안 → § 5 템플릿으로 파일 생성 → § 6 실행 안내 |
| S2 | `phases/index.json`에 pending phase 존재하나 해당 `phases/{dir}/` step 파일 0개 | 설계 미완 | `phase/index.json`의 steps 배열을 기준으로 § 5 템플릿으로 `step{N}.md` 파일 생성 → § 6 실행 안내 |
| S3 | 모든 step 파일 작성 완료, 실행 시작 전 (전부 `pending` + `started_at` 없음) | 실행 대기 | phase 개요·step 목록 요약 + 실행 명령(`python3 scripts/execute.py <dir>`)만 제시. 스킬 내부에서 실행하지 않는다 |
| S4 | 일부 step `completed` + 다음 `pending` | 진행 중 | 완료 step의 `summary`를 요약 + 다음 pending step 미리보기 + 재개 명령 안내 |
| S5 | 첫 non-completed step이 `error` | 에러 | `step{N}.md`, `step{N}-output.json`의 stdout/stderr/exitCode 읽고 원인 진단 → 사용자에게 복구 옵션 제시(재시도 / step 지시 보강 / 수동 처리) → 선택 적용 후 재개 명령 안내 |
| S6 | 첫 non-completed step이 `blocked` | 차단 | `blocked_reason` 해석 후 사용자 액션 안내(API 키·외부 인증 등) → 조치 완료 확인 후 `status`를 `pending`으로 리셋 + `blocked_reason` 삭제 |
| S7 | 현재 phase 전부 completed + `phases/index.json`에 다음 pending 있음 | phase 전환 | 방금 완료 phase 요약 + 다음 phase 개요 + 실행 명령 안내 |
| S8 | 모든 phase `completed` | 올 완료 | TODO.md 대비 남은 항목 점검 → 새 phase 제안(S1 흐름) 또는 릴리스 준비 제안 |

멱등성: 이미 존재하는 파일은 덮어쓰지 않는다. S1에서 `phases/<name>/`가 이미 있으면 "이미 존재" 보고 후 실제 상태(S2~S4 등)로 재분류한다.

### 3. 인자 기반 분기 강제

위 Inputs 섹션의 인자별 동작을 그대로 적용한다.

### 4. 설계 원칙 (phase/step 초안 작성 시)

1. **Scope 최소화** — 하나의 step에서 하나의 레이어/모듈만 다룬다.
2. **자기완결성** — 각 step 파일은 독립된 에이전트 세션에서 실행된다. "이전 대화에서 논의한 바와 같이" 같은 외부 참조 금지. 필요한 정보는 전부 파일에 적는다.
3. **사전 준비 강제** — 관련 문서 경로와 이전 step에서 생성/수정된 파일 경로를 명시.
4. **시그니처 수준 지시** — 함수/클래스의 인터페이스만 제시하고 내부 구현은 에이전트 재량. 단, 핵심 규칙(멱등성·보안·데이터 무결성)은 반드시 명시.
5. **AC는 실행 가능한 커맨드** — `pnpm typecheck && pnpm lint && pnpm test` 같은 실제 검증 커맨드 포함. 이 프로젝트에서 `lint`/`test` 스크립트는 루트에만 존재하므로 `-r` 없이 호출한다.
6. **주의사항은 구체적으로** — "조심해라" 대신 "X를 하지 마라. 이유: Y" 형식.
7. **네이밍** — step name은 kebab-case slug.
8. **TDD 우선** — 구현 step 직전에 실패 테스트 step을 두거나, 한 step 내에서 실패 테스트 → 통과 구현을 함께 수행한다. 초기 부트스트랩(테스트 파일조차 만들 수 없는 경우)은 step 본문에 "이 step에서는 테스트를 작성하지 않는다"를 명시하고 AC는 빌드/타입체크만 포함한다.

phase 후보 선정: TODO.md를 위에서 아래로 읽어 첫 번째 미완료 블록(대제목 섹션)을 기본 후보로 제안. 사용자가 다른 scope를 원하면 조정.

### 5. 파일 생성 템플릿

#### D-1. `phases/index.json` (전체 현황, 없으면 생성)

```json
{
  "phases": [
    { "dir": "<phase-dir>", "status": "pending" }
  ]
}
```

- 존재하면 `phases` 배열에 항목 append.
- `status`: `"pending"` | `"completed"` | `"error"` | `"blocked"`. execute.py가 전이 시 자동 갱신.
- 타임스탬프는 execute.py가 자동 기록하므로 생성 시 넣지 않는다.

#### D-2. `phases/<dir>/index.json`

```json
{
  "project": "<프로젝트명>",
  "phase": "<phase-dir>",
  "steps": [
    { "step": 0, "name": "<kebab-slug>", "status": "pending" }
  ]
}
```

- `steps[].step`: 0부터 시작하는 순번.
- `status` 초기값은 모두 `"pending"`.
- `created_at`, `started_at`, `completed_at`, `failed_at`, `blocked_at`는 execute.py가 자동 기록.
- `summary`/`error_message`/`blocked_reason`은 step 수행 중 child 세션이 기록.

#### D-3. `phases/<dir>/step{N}.md`

```markdown
# Step {N}: {이름}

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- {이전 step에서 생성/수정된 파일 경로}

## 작업

{구체적인 구현 지시. 파일 경로, 클래스/함수 시그니처, 로직 설명. 코드는 시그니처 수준. 핵심 규칙(privacy·멱등성 등)은 명확히 박아넣는다.}

## Acceptance Criteria

\`\`\`bash
pnpm -r typecheck
pnpm lint
pnpm test
\`\`\`

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md 디렉토리 구조 준수?
   - ADR 기술 스택 범위 내?
   - 프로젝트 CRITICAL 규칙 위반 없음?
3. 결과에 따라 `phases/<dir>/index.json`의 해당 step 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- {이 step에서 하지 말아야 할 것. "X를 하지 마라. 이유: Y" 형식}
- 기존 테스트를 깨뜨리지 마라
```

### 6. 실행 안내

```bash
python3 scripts/execute.py <phase-dir>        # 순차 실행
python3 scripts/execute.py <phase-dir> --push # 완료 후 origin/feat-<phase-dir> 푸시
```

execute.py가 자동 처리:
- `feat-<phase-dir>` 브랜치 생성/checkout
- 가드레일 주입 — 프로젝트 문서(`CLAUDE.md`/`AGENTS.md`, `docs/*.md`)를 매 step 프롬프트에 포함
- 컨텍스트 누적 — 완료 step의 `summary`를 다음 step 프롬프트에 전달
- 자가 교정 — 실패 시 최대 3회 재시도, 이전 에러를 다음 프롬프트에 피드백
- 2단계 커밋 — 코드(`feat`)와 메타데이터(`chore`) 분리 커밋
- 타임스탬프 자동 기록

에러/차단 복구는 harness 스킬을 `resume` 인자로 다시 호출해 진입한다 (§ 2 S5/S6 처리).

### 7. 금지/주의

- 스킬 내부에서 execute.py를 자동 실행하지 않는다 (사용자가 터미널에서 직접 실행).
- `status` 인자일 때는 어떤 파일도 쓰지 않는다.
- 사용자 동의 없이 git history를 조작하지 않는다 (revert/reset/force push). S0의 `git init` + 첫 커밋은 사용자 승인 후에만.
- `error_message`/`blocked_reason`을 사용자 확인 없이 지우지 않는다.
- `phases/**`를 사용자가 수동 편집한 흔적이 있으면 그 편집을 덮어쓰지 않는다.
- Uncommitted 변경이 있는 상태에서 S1/S2 파일 생성 시, 먼저 사용자에게 stash/commit할지 묻는다.
- 최초 분석 결과를 장황하게 나열하지 말고, 지금 이 상태에서 사용자가 해야 할 한두 가지를 명확히 제시한다.

## Outputs

- `phases/index.json` — 전체 phase 현황 (S1에서 신규 생성).
- `phases/<phase-dir>/index.json` — phase별 step 메타데이터.
- `phases/<phase-dir>/step{N}.md` — 자기완결적 step 지시 파일.
- 실행/재개/상태 모드에서는 파일을 생성하지 않고 사용자 안내 텍스트만 출력.

## Next Steps

- step 파일 생성 후에는 `python3 scripts/execute.py <phase-dir>`로 사용자가 직접 실행한다.
- 실행 중 `error`/`blocked` 상태가 발생하면 harness 스킬을 `resume` 인자로 재호출한다.
- 모든 phase 완료 후에는 릴리스 준비 또는 새 phase 설계로 이어진다.
