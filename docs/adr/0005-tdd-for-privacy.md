# 0005. TDD + Canary Verification for Privacy Code

## Status
Accepted · 2025-Q4

## Context
Privacy 코드의 회귀는 다른 영역의 회귀와 결이 다르다 — 한 번 새는 순간 vault 콘텐츠가 인터넷에 영구 노출되며 git history / search engine cache / Wayback Machine 으로 흔적이 남는다. "다음 PR 에서 고치면 되지" 가 통하지 않는다.

일반 TDD 의 cost / benefit 는 영역마다 다르지만, privacy 영역에서는 이 비대칭이 TDD 채택을 압도적으로 정당화한다.

## Decision
- **새 privacy 기능은 실패 테스트 먼저, 통과 구현은 그 다음.** 단, 기존 코드 리팩터는 예외 (테스트는 이미 있음).
- **canary 검증은 모든 privacy PR 에서 강제.** fixture: `packages/core/tests/fixtures/vault-mixed/`. 핵심 canary 문자열:
  - `DO_NOT_LEAK_BANANA_6f3c1` — private 노트 본문 누출 감지
  - `CLAUDE_COMMENT_LEAK_77b` — `%%comment%%` 누출 감지
  - `FOLDER_TREE_DO_NOT_LEAK_8a4f2` — 폴더 트리에 private 폴더 노출 감지
- 위 canary 가 렌더 HTML 에 0회 등장함을 검증하는 통합 테스트가 머지 게이트.
- privacy 파일을 건드리는 PR (`packages/core/src/privacy/**`) 은 *별도 PR* 로 분리 — 다른 변경과 섞이지 않게.

## Consequences
- **+** privacy 회귀가 머지 시점에 자동으로 잡힌다.
- **+** PR review 가 "새 기능이 어떻게 동작하는가" 만 보면 되도록 단순화된다 — 기본 안전선은 canary 가 잡는다.
- **−** privacy 코드 변경의 cycle time 이 길어진다 (테스트 작성 시간). 의도된 비용.
- **−** canary 가 hardcode 되어 있어 fixture 가 깨지면 통합 테스트가 깨질 수 있다 — 변경 시 fixture / 테스트 동시 갱신.

## Related
- [adr/0001-privacy-first-opt-in.md](./0001-privacy-first-opt-in.md).
- root CLAUDE.md "개발 프로세스" 섹션.
- canary fixture: `packages/core/tests/fixtures/vault-mixed/public-with-secret-tag.md` 등.
