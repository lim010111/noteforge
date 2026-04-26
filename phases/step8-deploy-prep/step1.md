# Step 1: alias-pipeline-integration

Step 0의 `buildAliasRedirects`를 `packages/core`의 pipeline에 연결하고, `@noteforge/astro` Content Layer loader가 alias entry를 노트 entry와 함께 노출하도록 만든다. **fixture·라우트·audit는 step 2.**

## 읽어야 할 파일

- `packages/core/src/aliases/buildAliasMap.ts` (step 0 산출).
- `packages/core/src/pipeline.ts` — 현재 vault 전체 처리 함수가 publishable IndexedNote 배열을 어디에서 만드는지(검색 키: `IndexedNote`, `buildWikilinkIndex`).
- `packages/astro-integration/src/loader.ts` — Content Layer loader가 entry를 어떻게 store에 push하는지.
- `apps/blog/src/lib/viewModels.ts` — `filterPublishable`, `entryToNoteViewModel` 패턴.

## 작업

### A. core pipeline에 alias 결과 합치기

`packages/core/src/pipeline.ts`:

1. publishable IndexedNote 배열이 만들어진 직후 `buildAliasRedirects(publishable)` 호출.
2. pipeline 반환 객체에 `aliasRedirects: readonly AliasRedirect[]` 필드 추가(타입은 `packages/core/src/types.ts` 또는 `aliases/buildAliasMap.ts`에서 export). 기존 필드는 절대 제거/이름 변경 금지.
3. `warnings`(또는 동등한 수집 채널)에 `AliasMapResult.warnings`를 합쳐 빌드 로그로 흘려보낸다. 이미 pipeline이 warning을 수집하는 패턴이 있다면 그대로 따른다(없으면 console.warn으로 직접 출력하지 말고 반환 객체에 `warnings` 배열 추가).

### B. astro-integration loader에 alias entry 노출

`packages/astro-integration/src/loader.ts`:

각 alias redirect를 Content Layer entry로 store에 push한다. **두 entry kind를 하나의 collection에서 구분.**

엔트리 데이터 스키마(타입 단계에서 합치):

```ts
type NotesEntryData =
  | { kind: 'note'; /* 기존 필드 그대로 */ ... }
  | { kind: 'alias-redirect'; to: string /* canonical slug, leading slash 없음 */ };
```

- `kind`는 새로 추가하는 필드. 기존 노트 entry에는 `kind: 'note'`를 명시(undefined이면 'note'로 fallback 가능하지만 명시 추천).
- alias entry id는 `from` slug(예: `'old-name'`). 기존 노트 entry id와 충돌하면 step 0 충돌 검증으로 이미 걸러져 있어야 하지만, loader에서 한 번 더 안전망으로 검사 후 충돌 시 throw(메시지에 두 entry 출처 포함).
- alias entry는 `body`/`rendered`를 채우지 않음(라우트가 redirect HTML만 생성).

### C. apps/blog view model 분기

`apps/blog/src/lib/viewModels.ts`:

- `filterPublishable`을 `kind: 'note'`만 통과시키도록 좁힌다. 기존 호출부(index/graph/tags 등)는 alias entry를 listing에 넣지 않는다.
- 새 함수 추가:

  ```ts
  export function entryToAliasRedirectViewModel(
    entry: NotesEntry,
    canonicalUrl: string,
  ): { from: string; to: string; canonicalUrl: string };
  ```

  `to`는 leading slash 추가해 absolute path로 반환(예: `'/note-with-alias'`). `canonicalUrl`은 호출자(Astro page)에서 `new URL(to, Astro.site).toString()`으로 만든다.

### D. 단위/통합 테스트

- `packages/core/tests/integration/aliasPipeline.test.ts`(또는 기존 통합 테스트 파일에 추가): vault-mixed fixture는 step 2에서 alias 케이스가 추가되므로, 본 step에서는 인라인 fixture(작은 ParsedNote 배열)로 pipeline → aliasRedirects 흐름을 검증. 검증 항목:
  - publishable 노트의 alias가 결과에 등장.
  - private 노트의 alias 문자열이 결과에 0회 등장.
- `packages/astro-integration/tests/`에 loader가 alias entry를 push하는지 확인하는 테스트(기존 loader 테스트 패턴 따름).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

타입 체크에서 `kind` discriminator로 인한 컴파일 에러가 호출 측에서 모두 처리되었는지 확인(특히 `apps/blog`의 listing/route 코드).

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - alias 노출 채널이 Content Layer entry **하나**인가? (별도 virtual module/collection 추가 안 함.)
   - pipeline 반환 객체의 기존 필드는 그대로?
   - private 노트의 alias가 어느 단계에서도 결과에 흘러들어가지 않는가? (publishable 필터 → buildAliasRedirects 입력 단일 경로.)
3. 결과에 따라 `phases/step8-deploy-prep/index.json`의 step 1을 갱신.

## 금지사항

- **별도 Astro virtual module / 별도 collection을 만들지 마라.** 이유: Content Layer가 이미 entry 단위 재계산/HMR을 책임진다. 같은 채널을 유지해야 watcher 의존 그래프가 깨지지 않는다.
- **alias entry에 노트 본문/제목/태그를 채우지 마라.** 이유: alias는 URL 보존만이 의미이며, 라우트가 노트 메타를 끌고 와선 안 된다(Step 2 라우트 step의 금지사항도 같은 맥락).
- **`filterPublishable`의 시그니처를 깨지 마라.** 이유: apps/blog의 모든 listing 페이지가 의존. 반환 타입을 narrow(`kind: 'note'`)하는 정도까지만 변경.
- 기존 테스트를 깨뜨리지 마라.
