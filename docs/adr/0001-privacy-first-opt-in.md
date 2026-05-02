# 0001. Privacy-First Opt-In Publication Model

## Status
Accepted · 2025-Q4 (프로젝트 시작 시점부터 invariant)

## Context
Obsidian vault 를 정적 사이트로 발행하는 기존 도구들은 모두 **기본 공개(opt-out)** 모델이다:

- **Quartz**: 모든 마크다운이 기본으로 빌드된다. 새 노트 작성 시 frontmatter 에 명시적으로 `draft: true` 를 넣지 않으면 공개. 공개 노트가 private 노트를 링크하면 graph / backlinks 에 제목이 노출된다.
- **Digital Garden / Flowershow**: opt-in 옵션이 있으나 transclusion (`![[Note]]`) · `%%comment%%` · frontmatter 필드 · 태그 단위 누출까지 다루는 일관된 프라이버시 모델은 없다.

타깃 사용자는 "실수로 private 노트가 새는 게 불안해서 Quartz 사용을 그만둔" 사람이다. 이들에게는 *공개되지 않은 것은 존재 자체가 드러나지 않는다* 는 강한 약속이 필요하다.

## Decision
- **기본값 = 비공개**. 모든 노트는 발행되지 않는다.
- 발행 트리거: `frontmatter.public: true` **또는** 본문 어딘가에 `#public` 태그. 둘 중 하나만 있어도 공개. 둘 다 없으면 비공개.
- 모든 알려진 누출 경로(본문, 제목, 링크, transclusion, comment, frontmatter, 태그, 첨부파일, sitemap, RSS, graph)를 **명시적으로** 차단하고 post-build audit 으로 재검증한다.
- private 폴더 (`private/**`) 는 frontmatter `public: true` 가 있어도 차단 (tripwire). 우회는 `unsafeAllowPrivateFolder: true` 명시 필요.

## Consequences
- **+** 사용자가 실수해도 기본값이 안전하다. "공개하려면 명시적 행동 필요" 가 강한 default.
- **+** 누출 경로를 명시 적분 한다는 약속이 마케팅이 아닌 검증 가능한 규약으로 성립한다.
- **−** 사용자가 처음 사이트를 띄우면 노트 0개로 보인다. 빠른 시작 가이드에서 "frontmatter `public: true` 또는 `#public` 태그를 먼저 추가하라" 는 기대치 설명이 필요.
- **−** 모든 코드는 이 모델을 가정한다. 향후 "기본 공개 모드" 같은 옵션을 추가하려면 root CLAUDE.md CRITICAL 1번 위반 — 별도 ADR 필요.

## Related
- 단일 결정 지점: `packages/core/src/privacy/classify.ts`.
- canary 누출 검증: `packages/core/tests/fixtures/vault-mixed/`.
- [MEMORY.md](../../MEMORY.md) "다시 하지 말 것" 1번.
