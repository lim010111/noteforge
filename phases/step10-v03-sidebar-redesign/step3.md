# Step 3: folder-tree-data-model (TDD)

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `apps/blog/src/lib/viewModels.ts` (특히 `NoteEntry`, `AliasRedirectEntry`, `filterPublishable` 시그니처와 사용 패턴)
- `apps/blog/src/lib/tagAggregation.ts` (동일 레이어의 pure aggregation 헬퍼 — 같은 패턴을 따름)
- `apps/blog/src/content.config.ts` (collection 스키마 — `data.draft`, `data.title`, `id` 등 의존하는 필드 형태)
- `apps/blog/src/pages/[...slug].astro:1-40` (`NoteEntry`/`AliasRedirectEntry` 사용 예 + `filterPublishable` 호출 위치)
- `phases/step10-v03-sidebar-redesign/design/COMPONENTS.md` (FolderTree props 시그니처 — 본 step의 출력 타입은 그 컴포넌트의 입력이 됨)

## 작업

이 step은 **TDD 강제** — 실패 테스트 → 통과 구현 순서. 컴포넌트가 아니므로 내부 구현 자유도는 높지만 시그니처와 결정성은 박힌다.

### 1. 시그니처 정의 — 타입 위치는 `theme-default`, 함수는 `apps/blog`

monorepo 의존 방향상 `packages/theme-default`가 `apps/blog`를 import할 수 없다. 컴포넌트(step 4의 `FolderTree.astro`)가 `FolderNode`를 props로 소비하므로 **타입 SSOT는 `theme-default`에 둔다**. apps의 `folderAggregation.ts`(데이터 변환 함수)가 그 타입을 import해서 반환 타입으로 사용 — apps → packages 방향이라 정상.

신규 파일 1: `packages/theme-default/src/lib/folderTree.types.ts` (타입만):

```ts
/**
 * Folder tree node — produced by apps/blog/src/lib/folderAggregation.ts,
 * consumed by FolderTree.astro / FolderIndex.astro / Sidebar.astro.
 *
 * Type SSOT lives here in theme-default because the consumer is here, and
 * apps → packages import direction is the only one allowed by the workspace.
 */
export interface FolderNode {
  /** 폴더 이름. 루트는 빈 문자열 ''. 그 외는 해당 segment 자체(예: 'AI', 'Claude'). */
  name: string;
  /** 슬래시 구분 절대 경로. 루트는 ''. URL은 `/path/`(trailingSlash always는 step6 책임). */
  path: string;
  /** 자식 폴더(이름 alphabetical, 안정적). */
  children: FolderNode[];
  /** 이 폴더에 직접 속한 publishable 노트(슬러그 alphabetical, 안정적). */
  notes: { slug: string; title: string }[];
}
```

`packages/theme-default/src/index.ts`(barrel)에 `export type { FolderNode } from './lib/folderTree.types.ts';` 한 줄 추가 — 컴포넌트 step 4와 BaseLayout step 5가 `import type { FolderNode } from '@noteforge/theme-default'`로 받게.

신규 파일 2: `apps/blog/src/lib/folderAggregation.ts` (함수만):

```ts
import type { FolderNode } from '@noteforge/theme-default';
import type { NoteEntry } from './viewModels.ts';

export function buildFolderTree(entries: NoteEntry[]): FolderNode;
```

### 2. 동작 규칙

- 입력 `entries`는 `filterPublishable`을 이미 통과한 결과다. **이 함수는 privacy 판정을 하지 않는다** (no `isPublic` 호출). 입력에 private 노트가 들어오면 그건 호출자 책임.
- 폴더 segment 구분: `entry.id`를 슬래시로 split. 마지막 segment는 노트 슬러그(같은 이름의 폴더 segment가 아님).
- depth ≥ 3 지원. 깊이 제한 없음.
- 정렬:
  - 폴더-우선, 그 다음 노트(시각 컴포넌트 단계의 일관성).
  - 폴더 이름은 case-insensitive alphabetical, 동률 시 case-sensitive secondary로 안정.
  - 노트는 슬러그 case-insensitive alphabetical.
- alias-redirect 엔트리는 입력에 없을 것이라고 가정한다(`filterPublishable`이 노트만 통과시킴). 안전장치로, `'kind' in entry.data && entry.data.kind === 'alias-redirect'`인 엔트리가 들어오면 *조용히 무시*(throw 아님 — 이 함수는 데이터 변환 레이어이지 검증 레이어가 아님). 검증/throw는 step6 책임.
- 슬러그 충돌(폴더 이름과 같은 위치의 노트 슬러그)은 *데이터 레이어에선 모두 기록*한다. throw는 step6의 라우팅 단계에서 일어남.
- pure 함수: Astro 임포트 금지(`astro:content` 등). vault FS 접근 금지. 입력으로 들어온 데이터만 사용.

### 3. 테스트 (먼저 작성, 실패 확인 후 구현)

신규 파일 `apps/blog/src/lib/folderAggregation.test.ts`. 8 케이스 이상:

1. **빈 입력**: `buildFolderTree([])` → `{ name: '', path: '', children: [], notes: [] }`.
2. **루트 노트**: `id: 'about'` 1개 → 루트 `notes` 1개, `children` 0.
3. **단일 레벨 폴더**: `posts/foo`, `posts/bar` → 루트 `children` 1개(`posts`), 그 안 `notes` 2개(정렬 안정).
4. **3단 깊이**: `AI/Claude/agents` 노트 → 루트 → `AI` → `Claude` → `agents`.
5. **정렬 안정성**: 입력이 어떤 순서로 들어와도 같은 트리 출력. case-insensitive 비교(예: `Posts/a`와 `posts/b`가 같은 폴더로 합쳐지는지는 design 결정 — **본 구현은 case-sensitive로 다른 폴더 취급**, 슬러그도 그대로). `posts/Z`, `posts/a` → 알파벳 순 `a`, `Z` (대소문자 무시 정렬, 안정).
6. **draft 제외**: `filterPublishable`을 거친 입력이라 draft가 이미 빠진다는 가정 검증 — 입력에 draft가 *없을* 때 출력에도 없다(자명) + 만약 draft가 *있다면* 출력에 *그대로* 포함됨(이 함수는 필터링 안 함).
7. **alias-redirect 무시**: 입력에 `data.kind === 'alias-redirect'` 엔트리가 섞여 있어도 throw하지 않고 출력에서 제외.
8. **폴더-노트 슬러그 같은 이름**: 같은 부모 아래에 `posts` 노트(`id: 'posts'`)와 `posts/foo` 노트가 동시에 있을 때 — 트리는 `posts` 노트와 `posts/` 폴더 *둘 다 기록*(throw 안 함). 자식 폴더의 `name`/`path`와 노트의 `slug`가 충돌하는 건 호출자가 검출.
9. **(추가)** 깊이 안정성: `a/b/c/d/e/f` 같은 6단 nesting도 throw/스택오버플로 없이 처리.

### 4. 구현

테스트가 모두 실패하는 것을 확인한 뒤, 구현을 추가해 통과시킨다. 재귀 또는 반복문으로 트리 구축. 정렬은 마지막에 한 번 적용해 안정성 보장.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
# 신규 테스트 파일이 실제로 실행됐는지 확인
pnpm test apps/blog/src/lib/folderAggregation.test.ts
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 명령이 통과.
2. 데이터 모델 체크리스트:
   - `folderAggregation.ts`에 `astro:content` import가 *없는가*?
   - `isPublic`/`filterPublishable` 호출이 *없는가*?
   - vault FS 접근(`fs`/`path` 모듈로 디스크 읽기)이 *없는가*?
   - `FolderNode` 타입이 `packages/theme-default/src/lib/folderTree.types.ts`에 정의 + barrel export?
   - apps 함수가 `import type { FolderNode } from '@noteforge/theme-default'`로 import?
   - 8개 이상의 테스트 케이스가 모두 통과하는가?
3. canary 회귀: 빌드 산출물에 canary 0회 — `pnpm --filter blog build` 후 `grep -rc 'DO_NOT_LEAK_BANANA_6f3c1\|CLAUDE_COMMENT_LEAK_77b' apps/blog/dist/` == 0.
4. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 3을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "FolderNode 타입을 theme-default/src/lib/folderTree.types.ts(+barrel export)에, buildFolderTree pure 함수를 apps/blog/src/lib/folderAggregation.ts에 분리(monorepo 방향 준수) + 9 테스트(empty/single/depth3/sort/draft/alias-skip/slug-collision/deep-nesting/case-insensitive)"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- `folderAggregation.ts`에서 `astro:content`를 import하지 마라. 이유: pure 함수 → 단위 테스트가 Astro 런타임 없이 가능해야 한다(테스트 비용 + 결정성).
- 이 함수에서 `isPublic`이나 privacy 판정을 호출하지 마라. 이유: 결정은 `packages/core/src/privacy/`에서만 — CLAUDE.md CRITICAL 규칙. 호출자(`buildSidebarPayload`, step8)가 `filterPublishable`로 거른 결과를 넘긴다.
- 폴더-노트 슬러그 충돌에서 throw하지 마라. 이유: throw 시점은 *라우팅* 단계(step6)다. 데이터 레이어는 둘 다 기록만 한다 — 그래야 컴포넌트 단계에서 충돌 시각 처리 옵션도 살아남는다.
- 입력 정렬에 의존하지 마라(입력 순서가 어떻든 출력은 같아야 함). 이유: 결정성/스냅샷 안정성.
- vault FS를 읽지 마라. 이유: pure 함수 계약. 모든 데이터는 `entries` 인자로만.
