# Step 1: astro-loader

## 목표

Astro 5 Content Layer `Loader`를 구현한다. `runCorePipeline(config)`를 호출해 **public 노트만** Content Layer store에 등록한다. private 슬러그는 **어떤 형태로도** store에 기록되지 않는다 — Content Layer는 dev/build 공통 인덱스이므로 여기에 올라가는 순간 2차 누출 벡터가 생긴다.

TDD 순서를 지킨다: **실패 테스트 먼저 → 구현으로 통과.**

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — Phase A→C 파이프라인 + Astro Content Layer loader 위치
- `/docs/ADR.md` — ADR-001 (Astro 5 Content Layer 선택 이유), ADR-002 (opt-in privacy 모델)
- `/packages/core/src/pipeline.ts` — `runCorePipeline(config)` 시그니처, `PipelineResult` 전체 필드
- `/packages/core/src/config.ts` — `ObpubConfig`, `defineConfig`
- `/packages/core/tests/fixtures/vault-mixed/` — step2c fixture (이 step의 입력으로 재사용)
- `/packages/core/tests/integration/vault-mixed.test.ts` — fixture 소비 패턴 참고 (config 구성 방식)
- 앞선 step 0 산출물: `/packages/astro-integration/src/remarkWikilink.ts` — `RemarkWikilinkOptions` 형태
- Astro 5 Content Layer API 레퍼런스 문서(외부, 필요시 조회): Astro 5의 `Loader` 타입은 `astro/loaders`에서 export된다 (`name`, `load(context)`, 선택적 `schema`). `context`는 `store` (`set`/`get`/`entries`/`keys`/`values`/`delete`/`clear`), `logger`, `parseData`, `meta`, `generateDigest`를 포함한다.

## 작업

### (1) 테스트 파일 선행

파일: `packages/astro-integration/tests/loader.test.ts`

Astro 모듈 자체를 import하지 않는다 — `Loader` 타입만 가져오고 `context`/`store`는 **테스트 로컬 shim**으로 주입한다. shim 최소 형태:

```ts
function makeStore() {
  const m = new Map<string, unknown>();
  return {
    set: (entry: { id: string }) => m.set(entry.id, entry),
    has: (id: string) => m.has(id),
    get: (id: string) => m.get(id),
    entries: () => m.entries(),
    keys: () => m.keys(),
    values: () => m.values(),
    delete: (id: string) => m.delete(id),
    clear: () => m.clear(),
  };
}
function makeLogger() {
  const warnings: string[] = [];
  const infos: string[] = [];
  return {
    warn: (m: string) => warnings.push(m),
    info: (m: string) => infos.push(m),
    error: () => {},
    debug: () => {},
    options: { dest: { write() {} }, level: 'info' },
    label: 'test',
    fork: () => makeLogger(),
    _warnings: warnings,
    _infos: infos,
  };
}
```

최소 6개 독립 assert (`it`/`test` 분리):

1. **7개 entry**: vault-mixed fixture로 config를 만들고 `loader.load({ store, logger, ... })` 호출 후 `store.keys()`가 정확히 `{public-note, another-public, public-with-image, public-with-embed, public-with-comment, public-with-extra-fm, public-with-secret-tag}` 7개 집합과 일치.
2. **private 미노출**: store keys에 `Private Secret`/`private/family-photos`/`private-secret`/`family-photos` 어느 문자열도 prefix/exact로 등장하지 않는다. 별도 assert로 `DO_NOT_LEAK_BANANA_6f3c1`이 `JSON.stringify([...store.values()])` 전체에 0회 등장.
3. **entry shape**: 임의 1개 entry를 샘플링해 `{ id: string, data: { title?, frontmatter, tags, backlinks }, rendered: { html, metadata? } }` 형태인지 확인. `data.frontmatter`는 core의 `publicFrontmatter` 맵 값(allowlist 통과분)과 일치. `data.tags`는 blocklist 필터된 배열.
4. **tripwire 로그**: `Private/family-photos.md`가 tripwire 대상이므로 `logger.warn` 호출 중 하나는 `TRIPWIRE_REJECTED` 또는 경로 `family-photos`를 포함해야 한다. 경고 카운트는 `>= 1`로 검증(구체 수치는 고정하지 말라 — 향후 경고 추가 여지).
5. **backlinks**: `another-public` entry의 `data.backlinks`에 `public-note`가 포함되고(링크 소유자), `public-with-embed`가 포함된다(public 임베드 = 그래프 edge). private source는 backlinks에 **절대** 등장하지 않는다.
6. **결정성**: 같은 config로 loader.load를 연속 2회 호출해도 store keys 집합과 각 entry의 `rendered.html`이 정확히 동일하다. 두 번째 호출 전 `store.clear()`를 호출해 누적 오염을 배제한다.

assert 메시지는 어떤 불변식이 깨졌는지 한 문장으로 명시한다.

### (2) 구현

파일: `packages/astro-integration/src/loader.ts`

정확한 export 시그니처:

```ts
import type { Loader } from 'astro/loaders';
import type { ObpubConfig } from '@obpub/core/config';

export function obpubLoader(config: ObpubConfig): Loader;
```

`load(context)` 내부 흐름:

1. `runCorePipeline(config)` 호출 (`@obpub/core`에서 import).
2. `context.store.clear()`로 기존 상태 초기화 (결정성 보장).
3. `result.warnings`를 반복하며 `code === 'TRIPWIRE_REJECTED'`는 `context.logger.warn`, 그 외는 `context.logger.info`로 전달. 메시지는 `${code}: ${message} (${file ?? 'unknown'})`.
4. `result.publicSlugs`를 돌며 각 slug에 대해 entry 생성:
   - `id`: slug
   - `data`:
     - `title`: `publicFrontmatter.get(slug)?.title` (string일 때만; 그 외에는 필드 생략)
     - `frontmatter`: `publicFrontmatter.get(slug) ?? {}`
     - `tags`: `publicTags.get(slug) ?? []`
     - `backlinks`: `publicGraph.edges.filter(e => e.to === slug).map(e => e.from)` (중복 제거, 안정 정렬)
   - `rendered`:
     - `html`: `renderedHtml.get(slug) ?? ''`
     - `metadata`: `{}` (확장 여지)
   - `context.store.set(entry)` 호출. private slug은 **이 루프에 도달하지 않으므로** 별도 가드 불필요하지만, 방어적으로 `result.publicSlugs.has(slug)` 재확인 후 set.
5. 리턴값 없음 (`Promise<void>`).

`name: '@obpub/astro/loader'` 또는 유사한 식별자 부여.

**`schema`**는 MVP 범위상 생략해도 된다 — 단, schema를 추가할 경우 `frontmatter` 필드 shape만 정의하고 `rendered`는 Astro 기본 타입을 신뢰한다. 추가 시 Zod 스키마는 core의 `frontmatterAllowlist`와 반드시 동기화되도록 주석으로 링크를 남긴다.

### (3) Export

`packages/astro-integration/src/index.ts`에 추가:

```ts
export { obpubLoader } from './loader.ts';
```

### (4) 의존성

- `astro`는 이미 `peerDependencies`에 선언됨. `astro/loaders` 타입만 사용하므로 추가 런타임 dep 없음.
- 테스트에서 `@obpub/core`의 type export(`ObpubConfig`)가 필요하면 workspace dep로 이미 연결되어 있다.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:

- `packages/astro-integration/tests/loader.test.ts`의 6 assert 전부 통과.
- `packages/astro-integration/src/loader.ts`가 `Loader` 타입을 정확히 충족 (typecheck 통과가 증거).
- vault-mixed fixture 입력 시 store keys에 private 슬러그가 0개.
- `pnpm-lock.yaml` diff는 없거나 minimal (새 런타임 dep 추가 없음).
- 기존 unit/integration 테스트 단 하나도 깨지지 않는다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. **Mutation check** (로컬 수동, 커밋 금지):
   - loader에서 `result.publicSlugs` 대신 `result.notes.map(n => slugByRelPath)`를 쓰도록 잠깐 바꿔 private까지 방출 → assert 2가 **실제로** 실패하는지 확인 → 원복.
   - `context.store.clear()` 호출을 제거하고 두 번째 `load()` 호출에서 entry가 누적되는지 → assert 6이 실패 재현 → 원복.
   결과를 `summary`에 "mutation check: public-only/결정성 실패 재현 OK"로 기록.
3. 아키텍처 체크리스트:
   - loader는 `@obpub/core`의 **공개 API**(`runCorePipeline`, `ObpubConfig`)만 import. `@obpub/core/src/privacy/**` 내부 경로 직접 import 금지.
   - loader 안에서 `isPublic` 판정을 재구현하지 않는다 (CLAUDE.md CRITICAL).
   - store에 넣는 entry의 `data`는 core 파이프라인 산출물을 **그대로** 전달. loader 안에서 frontmatter/tags를 추가 가공하지 않는다 (추가 가공은 또 다른 allowlist 위반 경로).
4. 결과에 따라 `phases/step3a-astro-loader/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "obpubLoader + 6 assert + private 0 노출 + 결정성"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (예: Astro 5 `Loader` 타입 breaking change) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **private 슬러그를 `context.store.set`에 전달하지 마라.** 이유: Astro Content Layer는 dev 서버 cache/index에서 id로 조회 가능한 shape — id 하나만 누출돼도 "그런 노트가 있다"는 신호를 내보낸다.
- **`loader.load` 안에서 `isPublic`을 재계산하지 마라.** 이유: 결정은 한 곳(`privacy/classify`). 재계산은 공개 규칙 분기의 갈라짐을 만든다.
- **`rendered.html`에 mdast/graph JSON을 섞지 마라.** 이유: 저자가 의도하지 않은 구조 누출 경로. `metadata`는 비워 두거나 public 값만 사용.
- **Astro 5 이전 API (`defineCollection({ type: 'content' })`)에 맞추지 마라.** 이유: 본 프로젝트는 Astro 5 Content Layer 전용. 하위 호환 시도는 타입 혼란만 부른다.
- **core의 `packages/core/src/**`를 이 step에서 수정하지 마라.** 필요가 생기면 블록하고 사용자에게 확인.
- 기존 테스트를 깨뜨리지 마라.
