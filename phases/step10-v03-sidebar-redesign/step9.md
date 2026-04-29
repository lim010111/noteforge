# Step 9: privacy-tdd-and-fixtures

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `packages/core/tests/fixtures/vault-mixed/` 디렉토리 전체 — 기존 fixture 구조와 canary 위치
- `packages/core/src/privacy/classify.ts` (`isPublic` 판정 — *수정 금지, 읽기만*)
- `packages/core/src/privacy/graph.ts`, `linkRewriter.ts`, `transclude.ts`, `attachmentFilter.ts` — 기존 canary 검증 흐름 이해
- 기존 canary 사용 지점: `grep -r 'DO_NOT_LEAK_BANANA_6f3c1\|CLAUDE_COMMENT_LEAK_77b' packages/`
- `apps/blog/src/lib/folderAggregation.ts` (step 3)
- `apps/blog/src/pages/[...slug].astro` (step 6 — folder-index 분기)
- `phases/step10-v03-sidebar-redesign/refs/parent_page.png` (folder index 시각 — 트리에 누가 들어가야/들어가지 말아야 하는지 직관 확인)

## 작업

이 step은 v0.3 사이드바·폴더 라우팅 도입이 privacy 계약을 한 번도 깨뜨리지 않는다는 것을 fixture 수준에서 강제 검증한다. **`packages/core/src/privacy/**`은 한 줄도 수정하지 않는다.** 추가만 한다.

### 1. fixture 확장 — `packages/core/tests/fixtures/vault-mixed/`

다음 4가지 폴더 케이스를 추가:

#### Case (a) — 깊게 nested된 fully-public 브랜치
- `posts/AI/Claude/agents.md` — `public: true`, body에 `Public deep note`.
- 트리에서 `posts/AI/Claude/agents`가 보여야 함.

#### Case (b) — `private/` 브랜치 안 `public: true` 노트(tripwire)
- `private/secrets/diary.md` — `public: true`, title 안에 새 canary `FOLDER_TREE_DO_NOT_LEAK_8a4f2`, body에도 `FOLDER_TREE_DO_NOT_LEAK_8a4f2`.
- CLAUDE.md tripwire 규칙: `private/**` 노트는 `public: true`라도 공개 금지(`unsafeAllowPrivateFolder` 미설정 시).
- 트리에서 *부재해야 함*. canary가 빌드 산출물 어디에도 0회.
- **가드의 보호 대상 노트**: 현재 loader의 `forcedIgnore`가 `private/**`을 *디스크 단계에서* 제외하므로 case (b) 노트는 `getCollection('notes')` 결과에 부재 → 트리에 자연 부재. 이 case의 의도는 *forcedIgnore가 약화/우회되는* 미래 회귀 시 마지막 가드가 발동하도록 fixture에 미리 심어두는 것이다(현재 통과는 자명, 회귀 시 즉시 fail).

#### Case (c) — public 노트 + 같은 폴더의 draft
- `posts/mix/visible.md` — `public: true`, no draft.
- `posts/mix/wip.md` — `public: true`, `draft: true`. (또는 단순히 `public: true`가 없는 노트)
- 트리에서 `wip`는 *부재* (filterPublishable이 거름).

#### Case (d) — 폴더 이름과 노트 슬러그 충돌
- `apps/colliding/index.md` — 무관(`apps`라는 폴더가 트리에 등장).
- `apps.md` (루트의 `apps` 슬러그 노트) — collision.
- step 6의 build-time throw가 이 fixture로 검증되어야 함.

### 2. 새 canary 도입

문자열 `FOLDER_TREE_DO_NOT_LEAK_8a4f2`. case (b)의 노트 title + body에 1회씩 임베드.

검증 위치 추가(빌드/테스트 단계 전반):
- 단위 테스트 `packages/core/tests/integration/privacy.test.ts` (또는 동등) — 기존 canary 어서션과 동일 테이블에 새 canary 한 줄 추가.
- 빌드 산출물 grep 가드: `apps/blog/dist/` 전체에 0회.
- `pnpm obpub audit --strict` 통과 — audit이 dist를 검사하니 자동으로 잡힘. 이미 strict mode가 canary 검사 포함하면 추가 0; 아니면 audit 규칙에 추가.

CLAUDE.md의 canary 목록에 `FOLDER_TREE_DO_NOT_LEAK_8a4f2`를 추가할지 여부는 step 10(릴리스 마감) 책임 — 본 step은 fixture와 검증만.

### 3. 단위 테스트 — `apps/blog/src/lib/folderAggregation.test.ts` 보강

step 3에서 작성된 테스트 위에 추가:

8. **fixture-driven**: vault-mixed의 publishable set으로 `buildFolderTree`를 호출 → 다음을 검증:
   - case (a)의 deep public 노트가 트리 안에 존재.
   - case (b)의 private 브랜치 자체가 트리에서 부재 (filterPublishable이 거른 결과니 자명, 회귀 가드).
   - case (c)의 wip 노트가 부재.
   - case (d)는 호출 자체는 throw하지 않음 (throw는 라우팅 단계).

### 4. e2e collision throw — `apps/blog/`에서 검증

`vault-mixed`는 *core* 단위 테스트용 fixture로 `apps/blog`의 `getCollection`은 그것을 보지 않는다(다른 vault 경로를 가리킴). 따라서 case (d)의 collision throw 검증은 두 갈래로 나눈다:

1. **core 레벨**(vault-mixed): `buildFolderTree`에 `apps.md` 노트(루트 슬러그 `apps`)와 `apps/colliding/index.md` 노트를 같이 통과시키면 트리에 둘 다 *기록됨*(throw 안 함 — step 3 데이터 레이어 계약). 이건 fixture만으로 단위 테스트 가능.
2. **apps 레벨**(routing): `apps/blog/src/lib/folderAggregation.test.ts`에 별도 mini-fixture(in-memory `NoteEntry` 배열)를 만들어 step 6에서 추가된 collision-guard 함수(또는 `getStaticPaths` 헬퍼)를 직접 호출 → throw 검증. 메시지에 폴더 경로(`posts/`)와 파일 경로(`apps/blog/src/pages/[...slug].astro`) 포함.

vault-mixed fixture에는 case (d) 노트 두 개(`apps.md` + `apps/colliding/index.md`)를 *그대로 추가*해두되, build 자체가 fail하도록 만들지는 않는다 — vault-mixed가 build 입력으로 쓰이지 않아 영향 0.

### 5. 빌드 산출물 회귀 검사

`pnpm --filter blog build` 후 다음 grep이 모두 0:
- `DO_NOT_LEAK_BANANA_6f3c1`
- `CLAUDE_COMMENT_LEAK_77b`
- `FOLDER_TREE_DO_NOT_LEAK_8a4f2`

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm obpub audit --strict

# 3종 canary 모두 dist에 0회
test "$(grep -rc 'DO_NOT_LEAK_BANANA_6f3c1'   apps/blog/dist | grep -v ':0$' | wc -l)" = "0"
test "$(grep -rc 'CLAUDE_COMMENT_LEAK_77b'    apps/blog/dist | grep -v ':0$' | wc -l)" = "0"
test "$(grep -rc 'FOLDER_TREE_DO_NOT_LEAK_8a4f2' apps/blog/dist | grep -v ':0$' | wc -l)" = "0"
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 단계 통과.
2. fixture 체크리스트:
   - 4가지 케이스(a/b/c/d)가 vault-mixed에 모두 들어 있는가?
   - case (b)의 canary `FOLDER_TREE_DO_NOT_LEAK_8a4f2`가 fixture에 1회 이상 등장(아무것도 안 들어 있으면 가드의 의미가 없음)?
   - 빌드 산출물 grep으로 같은 canary 0회?
   - case (d)에서 build가 throw하고 메시지가 file:line 컨벤션을 따르는가?
3. privacy 레이어 *수정 0* 확인:
   - `git diff --stat -- packages/core/src/privacy/` 결과가 *empty* (변경 없음)?
4. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 9를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "vault-mixed에 폴더 케이스 4종(deep-public/private-tripwire/draft-mixed/folder-note-collision) + 새 canary FOLDER_TREE_DO_NOT_LEAK_8a4f2 도입, 3종 canary dist 0/0/0, audit --strict 통과, privacy 코어 수정 0"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- `packages/core/src/privacy/**`을 수정하지 마라. 이유: privacy 계약 잠금 — v0.3 어떤 step도 privacy 코드 변경 금지(CLAUDE.md "privacy 파일 별도 PR 분리" 규칙). fixture만 추가, 코드는 변경 0.
- 새 canary 문자열을 다른 형식(예: 길이 단축, 대소문자 변경)으로 만들지 마라. 이유: grep 가드의 결정성. `FOLDER_TREE_DO_NOT_LEAK_8a4f2` 그대로.
- 기존 canary(`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`) 검사 어서션을 약화/제거하지 마라. 이유: v0.1/v0.2의 누적 가드.
- case (b) tripwire 검증을 *생략*하지 마라(`unsafeAllowPrivateFolder` 옵션을 활성화하는 우회 검사). 이유: 그 옵션은 의도된 emergency escape이고 fixture default는 *반드시* 그 우회 없이 tripwire가 동작해야 함.
- fixture의 기존 노트를 삭제/이름 변경하지 마라. *추가*만. 이유: 기존 단위/통합 테스트가 fixture 모양에 의존.
