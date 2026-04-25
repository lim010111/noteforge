# Step 3: add-contributing-md

## 컨텍스트

이제 컨트리뷰터 가이드를 작성한다. CLAUDE.md / docs / 기존 phase 패턴이 한국어 위주라 본 파일도 한국어로 작성한다 (영문 주석/명령어는 그대로). README와 톤 일치.

보안 리포팅 채널은 사용자 미정 → GitHub Issues로 통합하고 본 step.md 결과 summary에 메모.

## 읽어야 할 파일

- `/CLAUDE.md` — TDD 원칙, CRITICAL 규칙, 명령어 섹션
- `/docs/PRD.md`, `/docs/ARCHITECTURE.md` — 아키텍처 규칙 인용 출처
- `/README.md` — 톤/스타일 매칭
- `/package.json` — npm scripts 이름

## 작업

루트에 `CONTRIBUTING.md` 파일 생성. 다음 골격을 사용하되 표현은 자연스럽게:

```markdown
# Contributing

`noteforge`에 기여해주셔서 감사합니다. 아래는 개발 환경 셋업, 워크플로, PR 체크리스트입니다.

## 개발 환경

- Node.js **22.6+** (LTS 22.11 권장 — `.nvmrc` 참조)
- pnpm **10.x**
- Git

```bash
pnpm install
```

## 로컬 워크플로

| 명령 | 설명 |
|---|---|
| `pnpm --filter blog dev` | 도그푸드 사이트 dev 서버 (HMR) |
| `pnpm --filter blog build` | 정적 빌드 + post-build audit |
| `pnpm test` | 전체 워크스페이스 Vitest |
| `pnpm -r typecheck` | TypeScript strict 검사 |
| `pnpm lint` | ESLint |
| `pnpm obpub status <file>` | 특정 노트의 공개 판정 이유 |
| `pnpm obpub audit` | 빌드 산출물 독립 검증 |

## TDD 원칙

- 새 기능은 **실패 테스트 작성 → 통과 구현** 순서.
- privacy 로직(`packages/core/src/privacy/**`)은 특히 엄격 — 회귀 시 사용자 vault 누출 위험.
- privacy 관련 PR은 `packages/core/tests/fixtures/vault-mixed/` fixture에서 canary 검증 필수:
  - `DO_NOT_LEAK_BANANA_6f3c1` (private 노트 본문 canary)
  - `CLAUDE_COMMENT_LEAK_77b` (`%%...%%` 코멘트 canary)
- 두 canary가 렌더된 HTML에 **0회** 등장해야 합니다.

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 사용:

- `feat:` 새 기능
- `fix:` 버그 수정
- `docs:` 문서 변경
- `refactor:` 동작 변경 없는 리팩터
- `test:` 테스트 추가/수정
- `chore:` 빌드/툴/메타데이터
- `build:` 빌드 시스템 변경

예시:
```
feat(privacy): add tag blocklist enforcement
fix(loader): handle UTF-8 BOM in frontmatter
docs(README): add Dataview snippet
```

## PR 체크리스트

PR을 열기 전 다음을 확인하세요:

- [ ] `pnpm -r typecheck` 통과
- [ ] `pnpm lint` 통과
- [ ] `pnpm test` 통과
- [ ] `pnpm --filter blog build` 통과 (audit 포함)
- [ ] privacy 변경 시: 위 canary가 빌드 산출물에 0회 등장
- [ ] CLAUDE.md의 CRITICAL 규칙(공개 판정 위치, `private/**` tripwire, `%%...%%` 제거, frontmatter allowlist) 위반 없음
- [ ] 커밋 메시지가 Conventional Commits

## PR 분리 가이드

- `packages/core/src/privacy/**`를 변경하는 PR은 **별도 PR**로 분리하세요. 리뷰가 두꺼워지고 이력 추적이 쉬워집니다.
- 작은 PR을 선호합니다. 한 PR에 여러 무관한 변경을 섞지 마세요.

## 이슈 리포팅

- 일반 버그/기능 요청: [GitHub Issues](https://github.com/PLACEHOLDER_OWNER/PLACEHOLDER_REPO/issues).
- **프라이버시 누출 가능성**이 의심되는 케이스: GitHub Issues에 보고하되, 실제 vault 데이터가 노출될 수 있는 재현 자료는 첨부하지 마세요. 합성 fixture로 재현해주시거나, 비공개 채널이 마련될 때까지 메인테이너에게 직접 연락해주세요. (전용 보안 이메일은 추후 마련 예정.)

## 라이선스

기여하신 코드는 [MIT](./LICENSE) 라이선스로 배포됩니다.
```

PLACEHOLDER URL은 step 1과 동일한 placeholder로 둔다 (`<!-- TODO: confirm GitHub repo URL after repo rename -->` 코멘트는 README/CONTRIBUTING 모두 적용 가능하지만, CONTRIBUTING은 본문 표현이 자연스러우므로 placeholder URL만 두고 코멘트는 README에 한다).

## Acceptance Criteria

```bash
test -f CONTRIBUTING.md
pnpm lint
```

(`pnpm lint`는 md 파일 영향 없으나 형식상 통과 확인.)

## 검증 절차

1. 위 AC 통과.
2. CONTRIBUTING.md 본문에 다음 키 표현이 모두 포함:
   - `pnpm install`, `pnpm test`, `pnpm -r typecheck`, `pnpm lint`, `pnpm --filter blog build`
   - `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`
   - "Conventional Commits"
   - "MIT" 링크
3. 성공 → step.md `status: completed`, `summary: "CONTRIBUTING.md added (dev env, TDD with privacy canaries, conventional commits, PR checklist, security reporting via GitHub Issues — dedicated email TBD)"`.

## 이 step에서는 새 테스트를 작성하지 않는다

이유: 문서만 추가. 동작 변경 없음.

## 금지사항

- Code of Conduct(`CODE_OF_CONDUCT.md`) 별도 파일을 만들지 마라. 이유: v0.1 scope 외.
- DCO/CLA(서명 요구) 절차를 추가하지 마라. 이유: 채택 저해, MIT면 충분.
- 보안 이메일을 임의로 채우지 마라(`security@noteforge.io` 등). 이유: 도메인 미보유 + 사용자 미결정. GitHub Issues 통합으로 둔다.
- `.github/SECURITY.md` 별도 파일을 만들지 마라. 이유: CONTRIBUTING.md에 통합으로 v0.1은 충분.
