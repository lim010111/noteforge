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

머지 전 로컬에서 다음을 모두 통과시키세요:

```bash
pnpm -r typecheck && pnpm lint && pnpm test && pnpm --filter blog build
```

## TDD 원칙

- 새 기능은 **실패 테스트 작성 → 통과 구현** 순서로 진행합니다.
- privacy 로직(`packages/core/src/privacy/**`)은 특히 엄격하게 다룹니다 — 회귀가 발생하면 사용자 vault가 그대로 누출될 위험이 있습니다.
- privacy 관련 PR은 `packages/core/tests/fixtures/vault-mixed/` fixture에서 다음 canary가 빌드 산출물에 노출되지 않는지 반드시 검증해야 합니다:
  - `DO_NOT_LEAK_BANANA_6f3c1` — private 노트 본문 canary
  - `CLAUDE_COMMENT_LEAK_77b` — `%%...%%` 코멘트 canary

두 canary 모두 렌더된 HTML(및 `graph.json`, sitemap, RSS 등 모든 산출물)에 **0회** 등장해야 합니다.

## 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/)를 사용합니다:

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
- [ ] CLAUDE.md의 CRITICAL 규칙(공개 판정은 `packages/core/src/privacy/`에 집중, `private/**` tripwire, `%%...%%` 제거, frontmatter allowlist) 위반 없음
- [ ] 커밋 메시지가 Conventional Commits 형식

## PR 분리 가이드

- `packages/core/src/privacy/**`를 건드리는 PR은 **별도 PR**로 분리해주세요. 리뷰 집중도가 높아지고 이력 추적이 쉬워집니다.
- 작은 PR을 선호합니다. 한 PR에 무관한 변경을 섞지 마세요.

## 이슈 리포팅

- 일반 버그/기능 요청: [GitHub Issues](https://github.com/lim010111/noteforge/issues)에 등록해주세요.
- **프라이버시 누출 가능성**이 의심되는 케이스는 공개 이슈가 아니라 [`SECURITY.md`](./SECURITY.md)에 안내된 비공개 채널로 보고해주세요. 합성 fixture로 재현 가능한 케이스만 본문에 포함하고, 실제 vault 데이터는 절대 첨부하지 마세요.

## 행동 강령

본 프로젝트는 Contributor Covenant v2.1을 행동 강령으로 채택합니다. 자세한 내용과 보고 절차는 [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)를 참고해주세요.

## 라이선스

기여하신 코드는 [MIT](./LICENSE) 라이선스로 배포됩니다.
