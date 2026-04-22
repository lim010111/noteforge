# Step 3: transclude

## 작업

`packages/core/src/privacy/transclude.ts` + 그 테스트를 **TDD**로 작성한다. mdast 트리에서 Obsidian 임베드 `![[Target]]` / `![[Target#heading]]` 을 처리:

- **public 타겟 노트 임베드** → 해당 노트 본문의 mdast를 **재귀 확장**하여 임베드 위치에 삽입. 확장된 본문도 동일한 privacy 파이프라인(링크 재작성, 코멘트 스트리핑 등)을 **이미 거친 상태**가 입력으로 들어온다(caller 책임). 이 모듈은 **AST 머지**와 **싸이클/깊이 제한**만 담당.
- **private 타겟 임베드** → mdast에서 **완전 제거**(부모의 children에서 해당 노드 삭제, strip-to-text 아님 — 임베드 자리를 비움). 경고 없음(정상 동작).
- **unresolved 임베드** → 완전 제거 + 경고.
- **첨부 임베드 `![[image.png]]`** → 이미지 파일 참조. 이 step에서는 **markdown `image` 노드로 변환만** 하고(프라이버시 판정은 `attachmentFilter` step이 이후에 처리), 실제 파일 존재/public 여부는 확인하지 않는다. 단, `attachmentResolve` 콜백으로 url만 받아 이미지 노드 생성.

### 싸이클 / 깊이

- 방문 노드 집합을 유지. A → B → A 같은 재귀 → 두 번째 재진입 시 **해당 임베드 제거 + 경고**.
- 최대 깊이 `maxDepth = 5` (상수). 초과 시 제거 + 경고.

## 읽어야 할 파일

- 이전 step: `packages/core/src/privacy/linkRewriter.ts` — 링크 재작성 패턴(mdast 순회/치환) 참고. 이 step은 같은 패턴이되 **block-level 치환**이 추가(임베드는 block일 수도, inline일 수도 있음 — Obsidian 규칙상 대부분 paragraph 안 inline).
- `packages/core/src/resolve/wikilink.ts` — 임베드 대상 해석도 동일 함수(`parseWikilinkTarget`, `resolveWikilink`). 재사용 필수.
- CLAUDE.md의 CRITICAL: "`![[Note]]` transclusion은 링크와 동일하게 공개 판정을 거치고, private 타겟은 AST에서 **완전 제거**. public 타겟은 재귀적으로 동일 파이프라인 적용."
- plan 파일 Phase C §4 "Transclusion `![[Note]]` 처리" 섹션.

## 공개 인터페이스 (시그니처 고정)

```ts
import type { Root } from 'mdast';

export type TranscludeStatus =
  | 'expanded-public'
  | 'removed-private'
  | 'removed-unresolved'
  | 'removed-cycle'
  | 'removed-depth'
  | 'attachment';

export interface TransclusionRecord {
  readonly raw: string;
  readonly status: TranscludeStatus;
  readonly targetId?: string;
}

export interface ExpandTransclusionsOptions {
  readonly tree: Root;
  readonly sourceId: string;                 // 현재 노트의 id (싸이클 감지 기준점)
  readonly sourceFile?: string;              // warn 메시지용
  readonly resolve: (raw: string) => {
    readonly resolved: boolean;
    readonly targetId?: string;
    readonly kind: 'note' | 'attachment';    // 확장자 기반 또는 caller 판단
  };
  readonly isPublic: (targetId: string) => boolean;
  /** public 노트의 이미 privacy-처리된 mdast 트리를 반환. 재귀 깊이는 이 모듈이 관리. */
  readonly mdastFor: (targetId: string) => Root;
  /** 첨부 임베드의 dist-상대 URL. attachment privacy 판정은 이 단계가 아님. */
  readonly attachmentUrlFor: (targetId: string) => string;
  /** 기본 5. 테스트에서 주입 가능. */
  readonly maxDepth?: number;
}

export interface ExpandTransclusionsResult {
  readonly transclusions: readonly TransclusionRecord[];
}

/**
 * `![[...]]` 임베드만 처리. `[[...]]` 링크는 건드리지 않는다(linkRewriter 책임).
 * 트리는 in-place mutate.
 */
export function expandTransclusions(
  options: ExpandTransclusionsOptions,
): ExpandTransclusionsResult;
```

## 상세 규칙

1. **탐지**: text 노드 스캔 중 `![[...]]` 를 찾되 `[[...]]` 는 건드리지 않는다(linkRewriter가 이미 처리했을 수도, 혹은 아직일 수도 — 어느 쪽이든 이 모듈은 invariant로 "![[ 로 시작" 만 본다).
2. **inlineCode/code 블록 안**은 건드리지 않음(linkRewriter와 동일).
3. **Note 임베드 (public)**:
   - `mdastFor(targetId)`로 타겟의 mdast를 받아온다.
   - 임베드가 paragraph 내 inline 위치면: **임베드를 포함하던 paragraph를 split** → 앞 paragraph + embed 확장(children) + 뒤 paragraph. 확장 children이 block 노드들이면 원 paragraph를 분해하여 상위 parent.children에 합류.
   - 임베드가 자체 문단을 단독으로 차지하면(paragraph의 유일 inline child), paragraph 자체를 확장 children으로 교체.
   - 확장된 children은 caller가 이미 privacy 처리한 결과라고 가정(이 모듈이 재처리하지 않음).
   - `![[Target#heading]]`: 타겟 mdast에서 해당 heading의 section만 slice(heading 노드 ~ 다음 same-or-higher level heading 직전). slice 유틸은 이 모듈 내부 함수로 구현.
4. **Note 임베드 (private/unresolved)**: 임베드 노드 자체를 해당 위치에서 삭제(부모 children에서 제거). 주변 paragraph가 이후 "빈" 상태가 돼도 유지.
5. **첨부 임베드 (kind === 'attachment')**: mdast `image` 노드로 변환 — `{ type: 'image', url: attachmentUrlFor(targetId), alt: alias ?? basename }`. `![[image.png|300]]` 같은 width 파라미터는 **alt 뒤 무시**(v0.1 스코프 밖 — 경고 없음).
6. **싸이클 / 깊이**:
   - 입력 `sourceId`를 방문 set 초기값으로. 재귀 확장 시 이 set을 전달하며 누적.
   - `expandTransclusions`는 현재 노트 수준만 처리하고, caller가 public 타겟의 `mdastFor`를 호출하기 **전에** set을 전달하지 않는다 → 대신 `mdastFor` 구현부에서 caller가 재귀 관리 가능. **이 모듈은 첫 수준 감지**만: 같은 `sourceId`가 `mdastFor(targetId)`를 재호출하는 경로는 caller가 `mdastFor`에서 감지해야 한다. 이 모듈은 자체적으로 **이미 방문한 targetId 집합**을 유지해 동일 노트가 같은 트리 내에서 2회 이상 참조되면 2회째부터 cycle로 간주하고 제거.
   - 재귀 깊이: 각 expand 호출 시 내부 depth 카운터를 증가(children이 block 수준에서 또 `![[...]]`를 포함할 수 있음 — 실전에선 이미 caller가 평탄화한 상태가 오지만, 방어용으로 limit). `depth > maxDepth` → 제거 + 경고.
7. **결정적 순서**: `transclusions` 기록은 mdast 트리 순서대로 append.

## 테스트 (TDD)

`packages/core/tests/transclude.test.ts`에 최소 12 케이스. `mdast-util-from-markdown`로 markdown → mdast.

1. public 노트 임베드 → `mdastFor` 반환 내용이 임베드 자리에 삽입. 기록 `expanded-public`.
2. private 노트 임베드 → 노드 제거, 원 paragraph에서 해당 위치만 빈다. 기록 `removed-private`.
3. unresolved 임베드 → 제거 + warn. 기록 `removed-unresolved`.
4. 첨부 임베드 `![[image.png]]` → mdast `image` 노드로 변환, url은 `attachmentUrlFor` 결과. 기록 `attachment`.
5. 첨부 alias `![[image.png|Logo]]` → image alt = `Logo`.
6. `![[Target#Intro]]` public → 타겟 mdast에서 Intro heading section만 slice 후 삽입. 다른 section의 문구가 결과 트리에 0회 등장.
7. inline code `` `![[X]]` `` → 그대로 유지.
8. code block 안의 `![[X]]` → 그대로 유지.
9. 싸이클 감지: 같은 트리 내에서 동일 `targetId`가 **두 번** 임베드 → 두 번째는 제거 + `removed-cycle` 경고.
10. 깊이 초과: `maxDepth: 1`에서 **public 확장 결과 children이 또 다른 `![[...]]`를 포함**한 경우 → 2차 임베드는 제거 + `removed-depth`. (caller가 `mdastFor` 반환물에 미리 `![[...]]`를 남겨둔 시나리오.)
11. `[[PublicA]]` 링크(임베드 아님)는 건드리지 않음 — outgoing에 포함 안 됨.
12. 치환 후 트리 JSON stringify에 private target의 relativePath/canary 문자열이 0회 — 단언으로 고정.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

새 테스트 12개 통과, 기존 회귀 0건.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - `[[...]]` 링크는 손대지 않는다(테스트 11).
   - code/inlineCode 안은 손대지 않는다(테스트 7, 8).
   - private 임베드가 남긴 흔적 0건(테스트 12 canary 단언).
   - `maxDepth` 기본 5, 상수는 파일 상단에 `const MAX_DEPTH_DEFAULT = 5`로 고정.
   - `as any` 금지.
3. `phases/step2b-core-privacy-modules/index.json`의 step 3 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "privacy/transclude.ts + 12 tests + public expand / private remove / attachment to image / cycle+depth guards"`.
   - 실패/차단 → error/blocked.

## 금지사항

- **private 임베드를 strip-to-text로 처리하지 마라.** 이유: 링크와 다르다. `![[Secret Note]]` 에서 저자는 본문 삽입을 의도했을 뿐 "Secret Note"라는 문구를 쓰려 한 게 아니다. 남기면 누수. 완전 제거만이 올바른 기본값.
- **`mdastFor` 반환물을 이 모듈이 privacy 재처리하지 마라.** 이유: caller는 이미 각 노트별로 파이프라인(코멘트 제거, 링크 재작성 등)을 돌린 상태다. 여기서 또 돌리면 이중 처리 + 성능 악화 + 예측 불가능한 트리 구조 변형.
- **첨부 공개/비공개 판정을 이 step에서 하지 마라.** 이유: `attachmentFilter` step이 전담. 이 step은 mdast image 노드로 변환하고 URL만 붙인다. filter는 후속 `dist/` 복사 단계에서 따로 자른다.
- **싸이클 감지를 depth 카운터만으로 대체하지 마라.** 이유: depth 5 이하에서도 A↔B 순환은 가능. `visited: Set<targetId>`를 반드시 유지. depth는 별개 안전망.
- **`![[Note#^block-id]]` 블록 참조를 지원하지 마라.** 이유: v0.1 스코프 밖. 블록 id가 있으면 unresolved로 처리(제거 + 경고).
- 기존 테스트를 깨뜨리지 마라.
