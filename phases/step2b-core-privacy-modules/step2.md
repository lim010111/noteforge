# Step 2: link-rewriter

## 작업

`packages/core/src/privacy/linkRewriter.ts` + 그 테스트를 **TDD**로 작성한다. mdast 트리를 받아 **비임베드 wikilink `[[Target]]`/`[[Target|alias]]`/`[[Target#heading]]`** 을 재작성하는 순수 함수. 임베드(`![[...]]`)는 이 step의 책임이 **아님** — 다음 step(`transclude`)에서 처리. 이 함수는 `[[...]]` 만 다루고 `![[...]]`는 **그대로 둔다**(후속 step이 본다).

### 재작성 규칙

입력 mdast 트리의 모든 text 노드를 스캔:

- 패턴 `[[...]]` 를 발견(직전 문자가 `!`가 **아닌** 경우만).
- `parseWikilinkTarget`(이미 `resolve/wikilink.ts`에 있음)으로 해석.
- `resolveWikilink`(이미 있음)로 `WikilinkResolution` 획득.
- 결과에 따라 분기:
  - **resolved + target이 public** → **mdast `link` 노드**로 치환. `url = hrefFor(targetId, heading?)`, children은 text 노드 1개 (`alias ?? target`).
  - **resolved + target이 private** → **mdast `text` 노드**로 치환. 내용은 `alias ?? target`. `url`/`title`/`data-*` 어디에도 private 노트의 relativePath/basename/id가 등장하지 않아야 함. 경고 **없음**(정상 strip-to-text).
  - **unresolved** (`resolved: false`) → **mdast `text` 노드**로 치환. 내용은 `alias ?? target`. **경고 출력**(`file:line` 포함 — mdast node position에서).
- 치환 시 텍스트 노드의 `[[...]]` 앞뒤 문자는 보존. 필요 시 text 노드를 split하여 **text ... link/text ... text** 구조로 변환.
- code block/inline code 안의 `[[...]]`는 **건드리지 마라**. mdast에서 `inlineCode`/`code` 노드는 스캔 대상 아님.
- 링크 노드 내부, blockquote 내부, list item 내부 등 다른 AST 영역의 text 노드는 전부 스캔.

## 읽어야 할 파일

- `packages/core/src/resolve/wikilink.ts` — `WikilinkIndex`, `WikilinkResolution`, `parseWikilinkTarget`, `resolveWikilink`. **이 step에서 직접 사용**. 재구현 금지.
- `packages/core/src/types.ts` — `ParsedNote`(Note의 body는 markdown 텍스트). 실제 mdast 파싱은 consumer(`@obpub/astro`)가 하며, 이 step은 **이미 파싱된 mdast `Root`**를 입력으로 받는다.
- `packages/core/package.json` — 이 step에서 **새 devDependency 추가 필요**: `mdast-util-from-markdown`(테스트에서 markdown → mdast 생성용), `unist-util-visit` (또는 자체 재귀 visit). runtime deps에 `@types/mdast`는 이미 가능성 있음; 없으면 추가. 설치는 `pnpm add -D --filter @obpub/core <pkg>`.
- 이전 step: `packages/core/src/privacy/graph.ts` — 이 step은 graph를 import하지 않지만, 외부 caller는 graph에서 나온 public id set과 linkRewriter를 결합해 사용한다. 두 모듈의 "public id" 정의가 일치해야 함.
- CLAUDE.md의 privacy CRITICAL 규칙 (public/private 판정 단일 출처, strip-to-text 기본 동작).

## 공개 인터페이스 (시그니처 고정)

```ts
import type { Root } from 'mdast';

export type LinkStatus = 'resolved-public' | 'resolved-private' | 'unresolved';

export interface OutgoingLink {
  /** Original raw content between `[[` and `]]`. */
  readonly raw: string;
  readonly status: LinkStatus;
  /** Target note id when resolved (public or private). Undefined when unresolved. */
  readonly targetId?: string;
}

export interface RewriteWikilinksOptions {
  readonly tree: Root;
  readonly sourceFile?: string;                        // warn prefix용 (예: "projects/foo.md")
  readonly resolve: (raw: string) => { resolved: boolean; targetId?: string };
  readonly isPublic: (targetId: string) => boolean;
  readonly hrefFor: (targetId: string, heading?: string) => string;
}

export interface RewriteWikilinksResult {
  readonly outgoing: readonly OutgoingLink[];
}

/**
 * 순수 함수(트리는 in-place mutate). 리턴값은 이 노트의 outgoing link 메타데이터.
 * NOTE: `![[...]]` 임베드는 건드리지 않는다. transclude step이 담당.
 */
export function rewriteWikilinks(options: RewriteWikilinksOptions): RewriteWikilinksResult;
```

`resolve`/`isPublic`/`hrefFor`는 caller가 주입 — 이 모듈은 `WikilinkIndex`/graph에 직접 의존하지 않는다(결합도 최소).

## 치환 상세

- **public link 생성**:
  ```js
  { type: 'link', url: hrefFor(targetId, heading?), title: null,
    children: [{ type: 'text', value: displayText }] }
  ```
  `displayText = alias ?? target` (heading이 있으면 `target` 뒤에 `#heading`을 붙이지 **말고** alias/target만. heading은 url에 fragment로.).
- **private/unresolved**: 단일 `{ type: 'text', value: displayText }` 노드. **어떤 경우에도 `url`에 private id/relativePath가 들어가면 안 된다.**
- text 노드 split 시 순서 보존. `[[A]] 중간 [[B]]`처럼 여러 개 있을 때 개수만큼 올바르게 분리.

## 테스트 (TDD)

`packages/core/tests/linkRewriter.test.ts`에 최소 14 케이스. `mdast-util-from-markdown`으로 markdown → mdast 변환 후 `rewriteWikilinks` 호출 → 결과 트리를 다시 markdown(또는 mdast stringify)으로 확인하거나 노드 구조를 직접 비교.

1. 단독 `[[PublicA]]` + `isPublic('public-a')` true → `link` 노드, `url === '/notes/public-a'`(caller `hrefFor` 결과), children 텍스트 `PublicA`. outgoing 1개 `resolved-public`.
2. 단독 `[[PrivateA]]` + private → `text` 노드 값 `PrivateA`. URL/title/data 없음. outgoing 1개 `resolved-private`.
3. 단독 `[[DoesNotExist]]` → `text` 노드 값 `DoesNotExist`. `console.warn` 한 번 호출(sourceFile 포함 메시지). outgoing 1개 `unresolved`.
4. 별칭 `[[PublicA|다른 이름]]` public → link 텍스트는 `다른 이름`, url은 target 기반.
5. 별칭 `[[PrivateA|다른 이름]]` private → text `다른 이름`. **`PrivateA`(원 타겟 명)가 어디에도 남지 않음.**
6. 헤딩 `[[PublicA#Intro]]` public → link url이 `hrefFor('public-a', 'Intro')` 결과(예: `/notes/public-a#intro`), children 텍스트 `PublicA`.
7. 한 텍스트 노드 내 `앞 [[PublicA]] 중간 [[PrivateA]] 뒤` → 앞/뒤/중간 text 노드 + 2개 교체 노드가 올바른 순서로 삽입.
8. 임베드 `![[PublicA]]`는 **건드리지 않음** — 트리 내 원래 text 노드 그대로, outgoing 결과에 **포함되지 않음**.
9. inline code `` `[[PublicA]]` ``는 건드리지 않음 — `inlineCode` 노드 그대로. outgoing에 포함되지 않음.
10. code block(```` ``` ````) 안의 `[[X]]` 건드리지 않음.
11. 빈 타겟 `[[]]` → unresolved로 취급(경고 + text 노드 빈 문자열 대신 `''` 또는 원문 `[[]]` 중 하나로 안정적으로 결정 — 선택한 쪽을 테스트에 고정).
12. 2회 이상 같은 타겟을 링크 → outgoing 배열에 각각 한 항목씩(dedupe 하지 않음).
13. heading/alias 조합 `[[A#H|별칭]]` → public이면 url에 fragment `#h`(소문자화는 `hrefFor` 책임), display 텍스트는 `별칭`.
14. input 트리 mutation 확인: 동일 트리 객체가 그대로 반환(새 Root 할당 아님), 노드 배열만 수정.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

새 테스트 14개 통과, 기존 회귀 0건.

## 검증 절차

1. 위 AC 실행.
2. **CRITICAL 체크**: 테스트 중 하나에 private target의 relativePath/id를 unique 문자열로 심어두고, 재작성 후 트리 전체를 JSON stringify 하여 그 문자열이 0회 등장하는지 단언(attribute 누수 방지 확정).
3. 체크리스트:
   - 파일 위치: `packages/core/src/privacy/linkRewriter.ts`.
   - `![[...]]` 는 건드리지 않음(테스트 8).
   - code/inlineCode 안은 건드리지 않음(테스트 9, 10).
   - 외부 caller에게 `WikilinkIndex`/graph 의존을 강요하지 않음(`resolve`/`isPublic`/`hrefFor` injection).
   - `as any` 금지, `noUncheckedIndexedAccess` 준수.
4. `phases/step2b-core-privacy-modules/index.json`의 step 2 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "privacy/linkRewriter.ts + 14 tests + strip-to-text for private/unresolved + code/inlineCode skipped + embeds untouched"`.
   - 실패/차단 → error/blocked 기록.

## 금지사항

- **private target의 relativePath/basename/id를 URL/title/data 속성에 넣지 마라.** 이유: strip-to-text의 핵심 계약. 이 한 줄을 위해 이 모듈이 존재한다.
- **임베드(`![[...]]`)를 여기서 처리하지 마라.** 이유: 다음 step(transclude)의 책임. 재귀 확장과 싸이클 감지가 필요한 별도 문제라서 분리했다. 이 step에서 손대면 테스트 분리 불가 + 회귀 탐지 어려움.
- **mdast parser/serializer를 런타임 deps로 core에 넣지 마라.** 이유: core는 프레임워크 독립. parse/serialize는 consumer(`@obpub/astro`) 책임. 테스트에서만 `mdast-util-from-markdown`을 devDeps로 사용.
- **code/inlineCode 노드 내부 text 스캔하지 마라.** 이유: 저자가 코드 예시로 `[[X]]`를 일부러 쓴 것. 재작성하면 예시가 깨진다.
- **링크 노드 재작성 시 title 속성을 자동 채우지 마라.** 이유: 기본값이 private 노트의 제목일 가능성이 있고, 이는 누수. title이 필요하면 caller가 명시.
- 기존 테스트를 깨뜨리지 마라.
