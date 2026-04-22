# Step 0: remark-wikilink

## 목표

`@obpub/astro`에서 Astro/Markdown의 remark 파이프라인과 `@obpub/core`의 `rewriteWikilinks`를 잇는 **얇은 브리지 remark plugin**을 구현한다. `.astro`/`.mdx`/Markdown 페이지 혹은 Content Layer가 Obsidian-style `[[Target]]` 위키링크를 포함할 때, core의 privacy-aware 재작성 규칙(`strip-to-text` 포함)을 재구현 없이 그대로 적용받도록 한다.

TDD 순서를 지킨다: **실패 테스트 먼저 → 구현으로 통과.**

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — Phase A→C 및 "Astro Content Layer loader → remark/MDX (+ remarkWikilink)" 다이어그램
- `/docs/ADR.md` — ADR-007 (자체 wikilink plugin, `remark-wiki-link` 미사용 원칙)
- `/packages/core/src/privacy/linkRewriter.ts` — `rewriteWikilinks(options)` 시그니처와 public/private/unresolved 3-분기 AST 의미론
- `/packages/core/src/resolve/wikilink.ts` — `parseWikilinkTarget` 반환 형태 (heading/alias 파싱)
- `/packages/astro-integration/src/index.ts` — 현재 비어 있는 export surface
- `/packages/astro-integration/package.json` — peerDep `astro`, dep `chokidar`, `@obpub/core`
- 참고용: `/packages/core/tests/linkRewriter.test.ts` — 기존 테스트 작성 스타일

## 작업

### (1) Test file 선행

파일: `packages/astro-integration/tests/remarkWikilink.test.ts`

이 테스트는 `unified` 파이프라인 또는 직접 mdast 트리 생성 방식 중 **하나**로 일관되게 작성한다. Astro 실물은 띄우지 않는다 — plugin은 순수 remark 수준에서 검증 가능해야 한다.

최소 7개 독립 assert (`it`/`test` 분리):

1. **public 타겟** — `[[AnotherPublic]]` 입력, `resolve`가 `{ resolved: true, targetId: 'another-public' }` 반환 + `isPublic` true → 결과 mdast에 `link` node가 생성되고 `url === hrefFor('another-public')` (예: `/another-public`).
2. **private 타겟** — `resolve`는 resolved지만 `isPublic` false → 결과 mdast에 `link` node가 **없고** plain text만 남는다. text 값은 alias가 있으면 alias, 없으면 target 문자열. 단 `targetId`/내부 경로는 절대 text에 등장하지 않는다 (`another-public` 문자열 0회 포함 검사).
3. **unresolved 타겟** — `resolve`가 `{ resolved: false }` → plain text 치환 + `onWarning`이 `{ raw: '...', sourceFile?, message }` 형태로 정확히 1회 호출된다.
4. **alias** — `[[Target|사용자표시]]` → resolved+public일 때 `link` node의 text는 `사용자표시`여야 한다. private일 때도 text는 `사용자표시`.
5. **heading** — `[[Target#Some Heading]]` → resolved+public일 때 href는 `hrefFor('target', 'Some Heading')`이 반환한 값이어야 한다. `hrefFor` 호출 인자로 두 번째 파라미터에 정확히 `'Some Heading'` 문자열이 전달되는지 spy로 확인.
6. **skip 대상 노드** — `inlineCode`/`code`/`html`/`yaml` 노드 안의 `[[...]]` 문자열은 **건드리지 않는다**. 본문 paragraph의 `[[...]]`만 재작성된다.
7. **embed는 무시** — `![[Target]]` 시퀀스는 이 plugin이 절대 건드리지 않는다 (transclude 책임). 입력 AST에 embed 노드/텍스트가 있으면 입출력이 동일해야 한다.

Assertion 메시지에는 어떤 불변식이 깨졌는지 한 문장으로 적는다. `JSON.stringify(tree)` 대신 해당 노드만 뽑아 비교해 실패 시 가독성을 유지.

### (2) 구현

파일: `packages/astro-integration/src/remarkWikilink.ts`

정확한 export 시그니처(타입 이름은 그대로 유지):

```ts
import type { Root } from 'mdast';

export interface RemarkWikilinkOptions {
  /** core의 resolveWikilink 래퍼. integration/loader가 vault 인덱스를 클로저로 주입. */
  resolve: (raw: string) => { resolved: boolean; targetId?: string };
  /** 결정은 `privacy/classify`에서 내린 값을 그대로 통과. plugin 내부 재계산 금지. */
  isPublic: (targetId: string) => boolean;
  /** `hrefFor(targetId)` → `/slug`, `hrefFor(targetId, heading)` → `/slug#anchor`. */
  hrefFor: (targetId: string, heading?: string) => string;
  /** 처리 중인 파일 식별자 (warning 메시지에 포함). */
  sourceFile?: string;
  /** unresolved-link warning을 Astro logger로 브리지하기 위한 콜백. */
  onWarning?: (warning: { sourceFile?: string; raw: string; message: string }) => void;
}

export function remarkWikilink(
  options: RemarkWikilinkOptions,
): (tree: Root) => void;
```

구현 방침:

- 내부적으로 `@obpub/core/privacy/linkRewriter`의 `rewriteWikilinks`를 호출한다. 동일 AST 변환 로직을 **복제하지 않는다**.
- `rewriteWikilinks`는 `onWarning` 훅을 제공하지 않을 수 있다 — 필요하면 core의 시그니처를 유지하고 이 plugin 쪽에서 tree 순회를 한 번 더 수행해 unresolved 탐지 시 콜백을 호출한다. 단 **AST 편집은 core에만 맡기고** plugin 쪽은 관측만 한다.
- `rewriteWikilinks`의 기존 contract (SKIP_TYPES: `inlineCode`/`code`/`html`/`yaml`, embed 미처리)를 그대로 신뢰한다. 이 plugin이 추가로 skip 규칙을 구현하지 않는다.

### (3) Export

`packages/astro-integration/src/index.ts`:

```ts
export { remarkWikilink } from './remarkWikilink.ts';
export type { RemarkWikilinkOptions } from './remarkWikilink.ts';
```

기존 `export {};`는 교체.

### (4) 의존성

- 테스트용으로 `unified`, `remark-parse`, `mdast-util-from-markdown` 중 하나가 필요하면 `packages/astro-integration/package.json`의 `devDependencies`에 추가. `mdast-util-from-markdown`은 core가 이미 사용 중이므로 동일 버전 범위로 정렬해 lockfile 충돌을 피한다.
- 런타임 dep 추가는 없다. `@obpub/core`는 workspace dep로 이미 연결.
- `pnpm -w install` 후 lockfile에 추가된 항목만 반영되었는지 확인.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:

- `packages/astro-integration/tests/remarkWikilink.test.ts`의 7개 assert 전부 통과.
- `packages/astro-integration/src/index.ts`가 `remarkWikilink`를 re-export.
- 새 의존성은 `packages/astro-integration/package.json`에만 추가 (루트·core 미변경).
- 기존 `packages/core/**` 테스트(184건) 단 하나도 깨지지 않는다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. **Mutation check** (로컬 수동, 커밋에 남기지 말 것):
   - `remarkWikilink` 내부에서 `isPublic` 분기를 부정(`!isPublic(targetId)`)으로 뒤집어 private 타겟이 `<a>`로 남도록 → assert 2가 **실제로** 실패하는지 확인 → 원복.
   - `rewriteWikilinks` 호출을 주석 처리 → assert 1·3이 실패 재현 → 원복.
   결과를 `summary`에 "mutation check: isPublic 반전/rewrite 생략 모두 실패 재현 OK"로 한 줄 기록.
3. 아키텍처 체크리스트:
   - plugin 내부에서 `isPublic` 판정을 재구현하지 않는다 (CLAUDE.md CRITICAL "결정은 한 곳").
   - plugin은 Astro 심볼을 import하지 않는다 (Astro 버전 업과 무관하게 유지).
   - core linkRewriter의 public API(`RewriteWikilinksOptions`)를 변경하지 않는다 — 변경이 필요하면 scope을 벗어났다는 신호이므로 **블록**하고 사용자 결정을 받는다.
4. 결과에 따라 `phases/step3a-astro-loader/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "remarkWikilink + 7 tests + core linkRewriter 재사용 OK"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`rewriteWikilinks`와 동등한 AST 로직을 새로 작성하지 마라.** 이유: CLAUDE.md의 "결정은 한 곳" 규칙. plugin과 core가 갈라지면 privacy 테스트가 한쪽에서만 깨지며 다른 쪽이 누출 벡터가 된다.
- **plugin 내부에 Astro 심볼(`astro`, `astro/loaders` 등)을 import하지 마라.** 이유: plugin은 remark/unified 세계만 알아야 Astro 버전 업에 무관하게 유지 가능.
- **embed 처리(`![[...]]`)를 건드리지 마라.** 이유: transclude 전용 책임. 중복 처리는 attachment closure와 HTML 일관성을 깬다.
- **core의 `packages/core/src/privacy/**` 파일을 이 step에서 수정하지 마라.** 이유: privacy 파일을 건드리는 변경은 **별도 PR로 분리**해야 한다(CLAUDE.md). 필요가 생기면 블록하고 사용자에게 확인.
- 기존 테스트를 깨뜨리지 마라.
