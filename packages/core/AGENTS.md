# @noteforge/core

## 책임 (Owns)
프레임워크 독립 privacy-first 파이프라인. Phase A→C: walk → parse → classify → filter → render. 다른 모든 워크스페이스 패키지가 이 모듈에 의존하는 단일 결정 지점.

## 핵심 파일
- src/index.ts — 패키지 진입점 (config / pipeline / privacy 재export)
- src/pipeline.ts — `runCorePipeline`. discover → privacy filter → render
- src/config.ts — `ObpubConfig` 스키마 + classify 룰 빌드
- src/privacy/classify.ts — public/private 단일 판정 지점
- src/privacy/frontmatterFilter.ts — allowlist 필드만 통과

## 외부 의존 (Depends on)
없음. 다른 워크스페이스 패키지(`@noteforge/astro`, `@noteforge/cli`, `@noteforge/theme-default`)가 이 모듈에 의존.

## 테스트
```bash
pnpm --filter @noteforge/core test
```

## 변경 패턴 (Common modification patterns)
- 새 frontmatter 필드 허용 → src/privacy/frontmatterFilter.ts allowlist 변경 + fixture canary 가 누설 0회인지 검증
- 새 publish 트리거(예: 신규 태그 규칙) → src/privacy/classify.ts + src/privacy/publishable.ts 동시 갱신
- 새 링크 / transclude 패턴 → src/privacy/linkRewriter.ts 또는 src/privacy/transclude.ts + classify 재유도 금지

## Non-obvious
- **반드시**: 공개/비공개 결정은 src/privacy/classify.ts 단 한 곳에서만. 다른 모듈에서 재구현 금지 (루트 CRITICAL).
- **주의**: `private/` 폴더는 frontmatter `public: true` 가 있어도 차단 (tripwire). 우회는 `unsafeAllowPrivateFolder: true` 필요.
- **Why:** allowlist 외 frontmatter 노출은 한 번만 새도 누출 — 변경은 src/privacy/frontmatterFilter.ts 한 곳.
- transclude (`![[...]]`) 의 private 타겟은 AST 에서 완전 제거. public 타겟은 동일 파이프라인을 재귀 적용 (src/privacy/transclude.ts).
- Obsidian `%%...%%` 코멘트는 Phase A(discover) 직후 즉시 제거 (src/privacy/commentStrip.ts).

## 관련 (Related)
- 의존자: [@noteforge/astro](../astro-integration/CLAUDE.md), [@noteforge/cli](../cli/CLAUDE.md), [@noteforge/theme-default](../theme-default/CLAUDE.md)
- 결정 기록: [adr/0001-privacy-first-opt-in.md](../../docs/adr/0001-privacy-first-opt-in.md), [adr/0002-allowlist-frontmatter.md](../../docs/adr/0002-allowlist-frontmatter.md), [adr/0005-tdd-for-privacy.md](../../docs/adr/0005-tdd-for-privacy.md)
