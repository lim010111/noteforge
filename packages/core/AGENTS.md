# @noteforge/core

## 책임 (Owns)
프레임워크 독립 privacy-first 파이프라인. Phase A→C: walk → parse → classify → filter → render. 다른 모든 워크스페이스 패키지가 이 모듈에 의존하는 단일 결정 지점.

## 핵심 파일
- src/index.ts — **패키지 공개 seam**. 외부(`@noteforge/astro`, `@noteforge/cli`, `@noteforge/theme-default`, `apps/blog`)는 반드시 이 진입점을 통과해야 한다. ESLint `no-restricted-imports` 규칙이 `@noteforge/core/<subpath>` 임포트를 차단.
- src/pipeline.ts — `runCorePipeline`. 얇은 오케스트레이터: VaultIndex → classify → linkRewriter pass → renderPublicNote 루프(RAW 산출) → cross-note ops (graph / closure / alias / audit set) → `applyAttachmentClosure` per public slug.
- src/vaultIndex/ — **VaultIndex** 두 어댑터. `buildVaultIndex` (one-shot, pipeline용) + `createIncrementalVaultIndex` (가변, dev watcher용). 같은 `VaultIndexSnapshot` shape. classify 미포함.
- src/render/parseMarkdown.ts — **마크다운 파싱 seam**. `parseMarkdownToMdast`: CommonMark + GFM(footnote·table·strikethrough·task list·autolink) + math 문법 + Obsidian post-parse transform(`==highlight==`, `^[inline footnote]`, 확장 체크박스). 위키링크/embed는 여기서 다루지 않고 text로 남겨 privacy 단계가 처리.
- src/render/transforms/ — post-parse mdast transform 3종. micromark 확장이 없거나(highlight) Obsidian 전용(inline footnote, 확장 체크박스)인 문법을 파싱 후 walk로 처리. 산출 노드는 반드시 표준 `children` 배열 보유 — privacy 워커가 구조적으로 재귀하므로.
- src/render/renderPublicNote.ts — **renderPublicNote** per-note privacy render unit. transclude + dangling-footnote drop + serialize + frontmatter/tag filter + **raw** image 추출 + attachment ref 수집을 한 함수에 응집. closure-naive — image/frontmatter 게이팅은 attachmentClosure가 책임.
- src/privacy/attachmentClosure.ts — **attachment closure 단일 owner**. `collectAttachmentRefs` (pre-closure 노트 스캔) + `buildAttachmentClosure` (cross-note 결정) + `applyAttachmentClosure` (post-closure 적용)의 세 export.
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
- 새 마크다운 문법 → micromark 확장이 있으면 src/render/parseMarkdown.ts 확장 추가, 없으면 src/render/transforms/ post-parse transform 추가. 새 비표준 노드는 src/render/htmlFromMdast.ts handler 등록 필요.

## Non-obvious
- **반드시**: 공개/비공개 결정은 src/privacy/classify.ts 단 한 곳에서만. 다른 모듈에서 재구현 금지 (루트 CRITICAL).
- **주의**: `private/` 폴더는 frontmatter `public: true` 가 있어도 차단 (tripwire). 우회는 `unsafeAllowPrivateFolder: true` 필요.
- **Why:** allowlist 외 frontmatter 노출은 한 번만 새도 누출 — 변경은 src/privacy/frontmatterFilter.ts 한 곳.
- transclude (`![[...]]`) 의 private 타겟은 AST 에서 완전 제거. public 타겟은 동일 파이프라인을 재귀 적용 (src/privacy/transclude.ts).
- Obsidian `%%...%%` 코멘트는 Phase A(discover) 직후 즉시 제거 (src/privacy/commentStrip.ts).

## 관련 (Related)
- 의존자: [@noteforge/astro](../astro-integration/CLAUDE.md), [@noteforge/cli](../cli/CLAUDE.md), [@noteforge/theme-default](../theme-default/CLAUDE.md)
- 결정 기록: [adr/0001-privacy-first-opt-in.md](../../docs/adr/0001-privacy-first-opt-in.md), [adr/0002-allowlist-frontmatter.md](../../docs/adr/0002-allowlist-frontmatter.md), [adr/0005-tdd-for-privacy.md](../../docs/adr/0005-tdd-for-privacy.md)
