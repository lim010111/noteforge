# Step 1: vault-watcher

## 목표

Obsidian vault의 `.md` 파일을 `chokidar`로 감시하고, **200ms debounce**로 변경을 합쳐, 영향 받는 슬러그 집합(`slug + dependentsOf(slug)`)을 상위에 콜백으로 전달하는 **dev-time watcher 모듈**을 구현한다. 상위(=Step 2의 Astro integration)가 그 이벤트로 Vite full-reload 등을 트리거한다.

이 step에서는 **Astro 측 연결은 하지 않는다** — 이 모듈은 프레임워크 독립적이고, 테스트는 `chokidar`를 **주입 가능한 팩토리**로 모킹한다.

TDD 순서를 지킨다: **실패 테스트 먼저 → 구현으로 통과.**

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "상태 관리 / Dev 시간: reverseDependencies ... invalidate()" 부분과 Phase A→C 파이프라인
- `/home/shine/.claude/plans/public-fizzy-patterson.md` — "Watcher debounce 200ms", "**의존 노트도 invalidate**", "리스크 2. 캐시 vs 링크 재작성"
- `/packages/core/src/discover/walk.ts` — 초기 스냅샷에 사용할 vault walker 시그니처
- `/packages/core/src/discover/parseNote.ts` — 이 watcher가 파일 이벤트 처리 시 재사용할 파서
- `/packages/core/src/resolve/wikilink.ts` — `buildWikilinkIndex`, `resolveWikilink`, `parseWikilinkTarget`
- `/packages/core/src/slug.ts` — `computeSlug` (relativePath + frontmatter → slug)
- `/packages/core/src/config.ts` — `ObpubConfig` 타입과 vault ignore/classify 설정 구조
- `/packages/core/src/pipeline.ts` — 참고용 (전체 파이프라인은 여기서 호출하지 않고, wikilink resolution 로직 차용만)
- Step 0 산출물: `packages/astro-integration/src/depGraph.ts` — 이 watcher의 유일한 로컬 의존

## 작업

### (1) Test file 선행

파일: `packages/astro-integration/tests/watcher.test.ts`

`vitest`의 `vi.useFakeTimers()`로 debounce를 제어하고, chokidar는 `EventEmitter` 기반 fake로 주입. 실제 파일 시스템 I/O는 `tmp` 디렉토리나 `memfs` 없이 **fs-mock**(=테스트가 고정한 파일 맵에서 읽기)으로 대체한다 — 간단히 `vi.mock('node:fs/promises', ...)` 또는 option으로 `readFile?: (p: string) => Promise<string>` 주입 훅을 허용해도 된다.

최소 9개 독립 assert (`it`/`test` 분리):

1. **초기 스냅샷** — `start()` 호출 후 `onInvalidate`가 즉시 호출되지는 **않는다**. 내부 상태에 두 노트(A→B 링크)가 등록되고, 이후 A에 change 이벤트가 오면 `affectedSlugs`에 `{A, B}`가 포함되는지(=dependentsOf 기반)로 간접 확인. (즉 assert 2에서 검증)
2. **add → onInvalidate 1회** — watcher가 start된 상태에서 `A.md` add 이벤트 발생 → 200ms 경과 후 정확히 1회 호출. `events === [{kind:'update', slug:'a', affectedSlugs: Set{a}}]` (A가 의존이 없고 의존자도 없을 때).
3. **change → 의존자 포함 전파** — 초기 vault에 B.md(본문 `[[A]]`), A.md가 있음. A change 이벤트 → flush 후 `events[0].affectedSlugs` 에 `{a, b}` 포함 (A 자신 + A에 의존하는 B). kind는 `update`.
4. **unlink** — A.md unlink → flush 후 `events[0] === {kind:'remove', slug:'a', affectedSlugs: ⊇ {a,b}}`. 이후 B change 이벤트에서 B의 새 deps는 **재파싱 결과에 따라** 갱신됨(테스트 세팅에서 B의 본문을 `[[A]]`로 유지해도 watcher는 stale forward 엔트리만 남기고 resolve 실패로 처리한다 — 추가 assert로 확인하지는 않고 4번에서는 remove만 검증).
5. **Debounce coalesce** — 150ms 사이에 A.md change 3번, B.md change 1번 → 200ms 경과 후 `onInvalidate` 1회 호출. `events`는 중복 없이 A, B 각각 최대 1개 엔트리(coalesce: 같은 slug에서 `update` 여러 개는 마지막 kind로 합침, `update` 이후 `remove`가 오면 `remove`가 이김).
6. **ignore 패턴 준수** — vault에 `.obsidian/workspace.json` change 이벤트(ignore 매칭) → flush 후 `onInvalidate` **미호출**. 파일 경로가 ignore된 경우 chokidar 레벨에서 차단되거나, watcher 내부에서 relativePath 매칭으로 한 번 더 가드 — **둘 중 어느 방식이든 결과가 빈 이벤트여야 한다**.
7. **non-.md 파일 change 무시** — `.md` 확장자가 아닌 파일 이벤트는 무시. 예: `note.png` change → flush에서 onInvalidate 호출 없음.
8. **파싱 실패 graceful** — A.md change 이벤트가 왔는데 파일 내용이 `---\n:::bad::\n---` 같이 gray-matter가 실패할 수 있는 형태일 때: `onWarning`이 최소 1회 호출되고, 프로세스는 crash 하지 않으며, `onInvalidate`는 해당 slug에 대해 호출되거나(=best-effort로 body만 전달된 상태) 호출 생략 둘 중 하나로 일관되게 동작해야 한다. 명시적으로 구현은 **`onInvalidate`를 생략**(=slug 상태 불확실하므로 skip)하고 warning만 emit하도록 한다. 테스트는 onWarning 호출 + onInvalidate 미호출을 assert.
9. **stop()은 이후 flush를 방지** — change 이벤트 emit 후 debounce 타이머가 돌고 있는 동안 `stop()` 호출 → 남아있던 타이머가 flush 되지 않아야 한다. 즉 `stop()` 뒤에 타이머를 advance 시켜도 onInvalidate는 호출되지 않는다. stop()은 chokidar의 `close()`도 호출해 리소스 해제.

모킹 규약(문서화용, 테스트 파일 주석 한 줄):
- `ChokidarLike`는 `on(ev, cb)`, `close(): Promise<void>`, (옵션) `add(paths)` 만 사용한다. 테스트 fake는 `EventEmitter`를 extends하면 된다.
- fs 읽기는 옵션 훅 `readFile`을 주입하거나 `vi.mock`으로 대체.

### (2) 구현

파일: `packages/astro-integration/src/watcher.ts`

정확한 export 시그니처:

```ts
import type { ObpubConfig } from '@obpub/core/config';

export type WatcherEventKind = 'update' | 'remove';

export interface WatcherEvent {
  readonly kind: WatcherEventKind;
  /** 변경된 노트의 slug. */
  readonly slug: string;
  /** slug ∪ (slug의 dependentsOf, pre-mutation 시점 기준). */
  readonly affectedSlugs: ReadonlySet<string>;
}

export interface ChokidarLike {
  on(event: 'add' | 'change' | 'unlink', listener: (p: string) => void): this;
  on(event: 'error', listener: (err: unknown) => void): this;
  close(): Promise<void>;
}

export interface WatcherOptions {
  /** 절대 경로. 이 경로 안의 .md 파일만 감시한다. */
  readonly vaultPath: string;
  /** config.vaults[0].id — parseNote에 넘겨줄 값. */
  readonly vaultId: string;
  /** 감시 대상 ignore 패턴 (이미 forced ignore가 merge된 상태의 배열). */
  readonly ignore: readonly string[];
  /** 전체 config — classify rule 조회에 사용. */
  readonly config: ObpubConfig;
  /** debounce ms. default 200. */
  readonly debounceMs?: number;
  /** flush 시 호출. 이벤트 배열은 coalesced. */
  readonly onInvalidate: (events: readonly WatcherEvent[]) => void;
  /** 경고 (파싱 실패, resolve 실패 등)를 상위에 전달. */
  readonly onWarning?: (message: string) => void;
  /** chokidar 주입 훅. production default: `chokidar.watch`. */
  readonly chokidarFactory?: (paths: string, opts: unknown) => ChokidarLike;
  /** fs.readFile 주입 훅 (테스트용). default: `node:fs/promises`의 `readFile`. */
  readonly readFile?: (absPath: string) => Promise<string>;
}

export interface Watcher {
  /** vault를 walk하여 초기 depGraph를 채우고, chokidar를 기동. */
  start(): Promise<void>;
  /** 남은 debounce 타이머 취소 + chokidar 종료. */
  stop(): Promise<void>;
}

export function createWatcher(options: WatcherOptions): Watcher;
```

구현 방침:

- **내부 상태**:
  - `depGraph`: Step 0의 `createDepGraph()` 인스턴스.
  - `slugByRelPath: Map<string, string>` — relativePath → slug. unlink 이벤트에서 slug 복원용.
  - `wikilinkIndex`: `@obpub/core/resolve/wikilink`의 `buildWikilinkIndex(indexedNotes)` 결과. 파일 이벤트마다 점진 갱신 가능 — 하지만 **단순성을 위해** 파일 변경이 발생할 때마다 `slugByRelPath`/`indexedNotes`를 업데이트한 뒤 index를 재구성(O(N))한다. v0.1 수준에서 vault N<5k면 수용 가능. 5k+ 경고는 `onWarning`으로.
  - `pending: Map<string, WatcherEventKind>` — debounce 중인 slug별 최종 kind.
  - `timer: NodeJS.Timeout | undefined`.
  - `chokidarInstance: ChokidarLike | undefined`.
  - `stopped: boolean`.
- **start()**:
  1. `walkVault`로 vault 전체를 walk(ignore 적용). 각 파일 readFile → `parseNote`. `computeSlug`로 slug 계산. `slugByRelPath`, indexedNotes 배열 구축.
  2. `buildWikilinkIndex`로 wikilinkIndex 구성.
  3. 각 노트의 `body`에서 wikilink/embed를 regex로 스캔(파이프라인의 `extractEdges` 방식 참고)하여 resolved target id 배열을 만들고 `depGraph.setDeps(slug, targets)`.
  4. `chokidarFactory(vaultPath, { ignored: [...ignore], ignoreInitial: true, persistent: true })`로 watcher 기동. `add`/`change`/`unlink` 리스너 부착.
- **이벤트 핸들러 (모두 공통 전처리)**:
  1. `absPath`를 `vaultPath` 기준 relativePath로 변환. POSIX 형태. `path.relative` + `replaceAll(path.sep, '/')`.
  2. 확장자가 `.md`/`.markdown`이 아니면 조기 반환.
  3. `ignore` 패턴과 매칭되면 조기 반환 (chokidar의 `ignored`를 신뢰하되 안전망으로 한 번 더 가드 — `picomatch` 사용).
  4. 각 핸들러별 분기 후 `pending` 맵에 기록 + 타이머 재설정.
- **add / change 핸들러**:
  1. `readFile` → `parseNote`.
  2. 파싱 실패 시 `onWarning`으로 로그 + 그 slug는 `pending`에 기록하지 않고 반환 (assert 8).
  3. slug 계산(`computeSlug`). 기존 relativePath의 slug가 다른 경우(rename 효과)에도 v0.1에서는 단순히 새 slug로 갱신.
  4. indexedNotes + slugByRelPath 업데이트 → wikilinkIndex 재구성.
  5. body에서 링크/임베드 target id 추출 → 해소된 것만 `depGraph.setDeps(slug, targets)`.
  6. `pending.set(slug, 'update')` (단, 같은 slug에 이미 `remove`가 있다면 `update`로 덮어씀 — 최신 이벤트 우선).
  7. 타이머 arm/reset.
- **unlink 핸들러**:
  1. `slugByRelPath.get(rel)` → slug (없으면 조용히 반환).
  2. `dependentsOf(slug)`를 **스냅샷**으로 먼저 수집(=affectedSlugs 계산 후 removeNote).
  3. `slugByRelPath.delete(rel)`, indexedNotes에서 제거, wikilinkIndex 재구성.
  4. `depGraph.removeNote(slug)`.
  5. `pending.set(slug, 'remove')` (update가 있었더라도 remove가 이김).
  6. 타이머 arm/reset.
- **타이머 arm/reset**:
  - `clearTimeout(timer)`; `timer = setTimeout(flush, debounceMs ?? 200)`.
- **flush()**:
  1. `stopped === true`이면 즉시 반환.
  2. `pending` 스냅샷 → 빈 맵으로 교체 → timer 해제.
  3. 각 `(slug, kind)`에 대해 **kind 시점의 dependentsOf(slug)**를 계산 — 하지만 unlink의 경우 이미 removeNote로 사라졌으므로 affectedSlugs는 **이벤트 발생 시점에 미리 계산**해서 pending 엔트리에 함께 저장해야 정확. 즉 `pending`의 값 타입은 `{kind, affectedSlugs: Set<string>}`. 같은 slug가 여러 번 들어오면 affectedSlugs는 union, kind는 위 규칙(remove > update). → **구현 시 이 점을 명확히**.
  4. `events: WatcherEvent[]` 구성 → `onInvalidate(events)` 1회 호출.
- **stop()**:
  - `stopped = true`; `clearTimeout(timer)`; `timer = undefined`; `pending.clear()`; `chokidarInstance?.close()` await.

**Affected slugs 계산 규칙 (중요)**:
- update 이벤트: `{slug} ∪ dependentsOf(slug)_AFTER_setDeps`. (이전에 의존자였던 노트는 reverse에 남아있고, 새로 의존자가 된 노트는 없으므로 AFTER-set 기준으로도 충분.)
  - 단, 만약 A가 이전에 B를 링크했는데 이번 change에서 더 이상 B를 링크하지 않는다면, B의 dependentsOf는 A를 잃는다 — 하지만 **B는 여전히 재렌더되어야 A의 과거 링크가 사라졌다는 것이 반영되는가?** NO — B 자체의 내용은 안 변했으므로 B는 affectedSlugs에 들어갈 필요 없다. B의 백링크 리스트에서 A가 사라지는 건 A의 재렌더 + 백링크 재계산이 처리한다.
- remove 이벤트: `{slug} ∪ dependentsOf(slug)_BEFORE_removeNote`. 이것은 기존에 slug를 링크했던 노트들이 이제 strip-to-text(unresolved)로 바뀌어야 함을 반영.

### (3) 의존성

- `chokidar`는 이미 `packages/astro-integration/package.json`의 `dependencies`에 있음 (v4.0.1).
- `picomatch`는 core가 쓰고 있으므로 peer로 재사용하거나 `packages/astro-integration/package.json`의 dep에 추가(이 경우 core와 동일 메이저 버전 사용).
- 런타임에는 core의 workspace 패키지 재사용 — 새 external dep 없음.
- 테스트는 devDependency 추가 없이 node `events`의 `EventEmitter`로 fake chokidar를 만들 수 있다.

### (4) Export

`packages/astro-integration/src/index.ts`에 추가 (기존 export 유지):

```ts
export { createWatcher } from './watcher.ts';
export type {
  Watcher,
  WatcherEvent,
  WatcherEventKind,
  WatcherOptions,
  ChokidarLike,
} from './watcher.ts';
```

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:

- `packages/astro-integration/tests/watcher.test.ts`의 9개 assert 전부 통과.
- `packages/astro-integration/src/index.ts`에 watcher 심볼 re-export 추가.
- `packages/core/**` 및 Step 0의 depGraph.ts **수정 없음** (읽기/호출만).
- 기존 테스트(depGraph 10 + remarkWikilink 7 + loader 6 + integration 5) 단 하나도 깨지지 않는다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. **Mutation check** (로컬 수동, 커밋 금지):
   - `flush`에서 coalesce 규칙을 "update > remove"로 뒤집어 → assert 4가 실패 재현(unlink 뒤 빈번 change 시) → 원복.
   - unlink 핸들러에서 `dependentsOf`를 `removeNote` **뒤**에 계산하도록 순서 바꿈 → assert 4의 affectedSlugs가 `{a}`만 남아 실패 재현 → 원복.
   - debounce를 제거하고 매 이벤트마다 onInvalidate 즉시 호출로 바꿈 → assert 5 실패 재현 → 원복.
   결과를 `summary`에 "mutation check: coalesce/pre-snapshot/debounce 3종 실패 재현 OK"로 기록.
3. 아키텍처 체크리스트:
   - classify/isPublic 재구현이 없다 (watcher는 depGraph만 다룬다 — public/private 판단은 loader의 `runCorePipeline` 책임).
   - wikilink 파싱/해석은 `@obpub/core/resolve/wikilink`를 그대로 호출한다 (결정은 한 곳 원칙).
   - Astro 심볼 import 없음 (`astro`, `astro/loaders` 등). Step 2에서만 접촉.
4. 결과에 따라 `phases/step3b-astro-watcher/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "watcher + 9 tests + debounce/coalesce/pre-snapshot OK"`
   - 실패 → `"status": "error"` + error_message.
   - 사용자 개입 필요 → `"status": "blocked"` + blocked_reason 후 중단.

## 금지사항

- **이 모듈에서 `isPublic`/classify를 다시 계산하지 마라.** 이유: public/private 판정은 `packages/core/src/privacy/classify.ts`의 단일 진실. watcher가 임의로 판단하면 로직이 두 곳으로 갈라져 누출 회귀의 온상이 된다. watcher는 "무엇이 변했고, 누가 그것에 의존하는가"만 안다.
- **이 모듈에서 `runCorePipeline`을 호출하지 마라.** 이유: 파일 이벤트 하나마다 전체 파이프라인을 돌리면 dev UX가 죽는다. 파이프라인 재실행은 loader의 책임이고, watcher는 invalidation 신호만 내보낸다.
- **chokidar를 직접 top-level import로 강하게 결합하지 마라.** production 경로에서는 `import('chokidar')`의 동적 import 또는 factory-with-default로 접근해서 테스트가 쉽게 대체할 수 있어야 한다.
- **Astro 심볼(`astro`, `astro/loaders`, Vite server)을 import하지 마라.** 이유: Astro 연결은 Step 2 전담. watcher를 프레임워크 독립으로 유지해야 추후 다른 어댑터(11ty/Next)에서도 재사용 가능.
- **`packages/core/**` 및 `packages/astro-integration/src/depGraph.ts`를 수정하지 마라.** 필요 시 블록.
- 기존 테스트를 깨뜨리지 마라.
