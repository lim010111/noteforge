# 0003. pnpm Workspace Monorepo (4 Packages + 1 App)

## Status
Accepted · 2025-Q4

## Context
Privacy 엔진 / Astro 어댑터 / 테마 / CLI / 도그푸드 사이트를 한 레포에 둘 때 두 가지 옵션:

- **Single package**: 모두 한 `package.json`. 단순하지만 privacy 엔진을 재사용 가능한 라이브러리로 분리할 수 없음.
- **Monorepo**: 4 패키지 + 1 앱. 의존 경계가 강제되고 외부 사용자가 `@noteforge/core` 만 import 해서 자기 SSG 에 쓸 수 있는 가능성을 연다.

## Decision
**pnpm workspace** 채택. 구조:

```
packages/
├── core/                # @noteforge/core    — 프레임워크 독립 privacy 엔진
├── astro-integration/   # @noteforge/astro   — Astro Content Layer + watcher
├── cli/                 # @noteforge/cli     — obpub dev/build/audit/status
└── theme-default/       # @noteforge/theme-default — 레퍼런스 테마
apps/
└── blog/                # 도그푸드 사이트
```

- 의존 사슬: `core ← astro-integration ← theme-default ← apps/blog` + `core ← cli`.
- `scripts/` 는 워크스페이스 외부 자동화 (Python + Node, subprocess 호출).
- 각 패키지는 자체 `package.json` / 자체 `vitest.config` / 자체 typecheck.
- 빌드는 `tsup` (CLI 만 dist 필요), 다른 패키지는 source export.

## Consequences
- **+** 의존 그래프가 명시적이다. core 가 다른 패키지에 의존하지 않는다는 invariant 를 구조 자체로 강제.
- **+** 외부 fork 가 `@noteforge/core` 만 떼서 자기 어댑터를 쓸 수 있다.
- **−** 새 변경이 여러 패키지를 건드릴 가능성. PR 검토 시 의존 사슬 위→아래 순으로 보아야 한다.
- **−** pnpm 전용 — npm / yarn workspace 와 호환되지 않는다 (`packageManager` 강제).

## Related
- 모듈별 책임은 각 [packages/*/CLAUDE.md](../../packages/) 에.
- 의존 그래프 시각화는 [docs/ARCHITECTURE.md](../ARCHITECTURE.md).
