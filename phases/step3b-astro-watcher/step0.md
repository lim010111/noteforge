# Step 0: dep-graph

## 목표

`@obpub/astro` watcher가 파일 변경 시 "누가 이 노트에 의존하는가?"를 O(1)로 조회할 수 있도록, **프레임워크 독립적인 양방향(forward/reverse) 의존 맵**을 구현한다. Step 1의 watcher가 이 모듈을 단독 의존성으로 사용한다.

TDD 순서를 지킨다: **실패 테스트 먼저 → 구현으로 통과.**

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 "상태 관리 — Dev 시간: `reverseDependencies: Map<noteId, Set<noteId>>`" 섹션
- `/home/shine/.claude/plans/public-fizzy-patterson.md` — "캐시 vs 링크 재작성. B가 private→public 바뀌면 B를 링크한 A의 캐시된 렌더도 무효화 필요" 리스크 설명
- `/packages/astro-integration/src/index.ts` — 현재 export surface (여기에 추가될 예정)
- `/packages/core/src/types.ts` — `ParsedNote` 타입 (의존 id의 출처)

## 작업

### (1) Test file 선행

파일: `packages/astro-integration/tests/depGraph.test.ts`

최소 10개 독립 assert (`it`/`test` 분리). vitest 기본 API만 사용.

1. **empty** — 갓 생성한 `DepGraph`에서 `depsOf('x')`, `dependentsOf('x')`, `has('x')` 모두 **빈 Set / false**. 예외 던지지 않는다.
2. **forward + reverse 동시 기록** — `setDeps('A', ['B','C'])` 후 `depsOf('A') === {B,C}`, `dependentsOf('B') === {A}`, `dependentsOf('C') === {A}`.
3. **setDeps 재호출은 이전 deps를 교체** — `setDeps('A',['B','C'])` → `setDeps('A',['B','D'])` 후 `dependentsOf('C')`는 A를 **포함하지 않아야** 한다 (stale reverse 엔트리 남으면 실패). `dependentsOf('D')`는 `{A}`, `dependentsOf('B')`는 여전히 `{A}`.
4. **중복 입력은 idempotent** — `setDeps('A', ['B','B','B'])` 후 `depsOf('A')` size === 1.
5. **removeNote — forward 제거** — `setDeps('A',['B'])` → `removeNote('A')` → `depsOf('A')` 빈 Set, `dependentsOf('B')` A 미포함.
6. **removeNote — 외부에서 들어오는 reverse 엔트리는 건드리지 않는다** — `setDeps('A',['B'])`, `setDeps('C',['B'])` → `removeNote('B')` → `depsOf('B')` 빈 Set. 단 `depsOf('A')`와 `depsOf('C')`는 **여전히 `{B}`**를 유지해야 한다 (A/C의 markdown은 아직 재파싱되지 않았으므로 stale forward 참조가 남아있어야 정답. 의미: "파일은 사라졌지만 다른 노트들은 여전히 B를 링크한다고 믿는 상태"). `dependentsOf('B')`는 `{A,C}` 그대로.
7. **self-loop** — `setDeps('A',['A'])` 후 `depsOf('A')` = `{A}`, `dependentsOf('A')` = `{A}`. `removeNote('A')` 시 양쪽 모두 비워진다.
8. **cycle** — `setDeps('A',['B'])`, `setDeps('B',['A'])` → `dependentsOf('A')` = `{B}`, `dependentsOf('B')` = `{A}`. `removeNote('A')` → `dependentsOf('B')`에서 A 제거, `depsOf('B')`는 `{A}` 유지(6번 규칙).
9. **반환된 Set은 외부에서 수정해도 내부 상태에 영향 없음** — `const s = g.dependentsOf('B'); (s as Set<string>).clear?.()` 호출 혹은 `Array.from(s)` 후 원본 보존 확인. 구체적으로는 `ReadonlySet`을 반환하고 내부 저장소와 다른 인스턴스여야 한다 (defensive copy or frozen).
10. **has()** — 노드 식별은 forward 또는 reverse 둘 중 하나라도 엔트리가 있으면 true. `setDeps('A',['B'])` 후 `has('A')`와 `has('B')` 모두 true. `removeNote('A')` 후 `has('A')` false, `has('B')` 여전히 true(1-out, 0-in). `removeNote('B')` 후 `has('B')` false.

테스트 assertion 메시지는 "깨진 불변식 한 문장"으로 작성해서 회귀 추적성을 유지한다.

### (2) 구현

파일: `packages/astro-integration/src/depGraph.ts`

정확한 export 시그니처:

```ts
export interface DepGraph {
  /** Replace `noteId`의 outgoing deps를 `dependsOn`으로. 이전 forward/reverse 엔트리는 정리. */
  setDeps(noteId: string, dependsOn: Iterable<string>): void;
  /** `noteId` 자체의 forward 엔트리를 지우고, `noteId → X` 방향의 reverse 엔트리들에서 `noteId`를 제거. 외부에서 들어오는 (`X → noteId`) 엔트리는 유지. */
  removeNote(noteId: string): void;
  /** `noteId`가 현재 의존한다고 기록된 노드들. 직접 조작 불가 (ReadonlySet). */
  depsOf(noteId: string): ReadonlySet<string>;
  /** `noteId`를 의존한다고 기록한 노드들(=noteId가 변경되면 재렌더 필요). 직접 조작 불가. */
  dependentsOf(noteId: string): ReadonlySet<string>;
  /** forward 또는 reverse 엔트리 중 하나라도 있으면 true. */
  has(noteId: string): boolean;
}

export function createDepGraph(): DepGraph;
```

구현 방침:

- 내부 저장은 두 개의 `Map<string, Set<string>>` (forward, reverse). 둘 다 값은 빈 Set이 되면 즉시 delete (empty-set leak 방지).
- `setDeps`:
  1. 기존 `forward.get(noteId)`가 있으면 그 안의 각 oldDep에 대해 `reverse[oldDep]`에서 `noteId`를 제거. 빈 set이면 delete.
  2. 새 deps를 유니크화(Set)하여 forward에 저장 (빈 set이면 forward에서 delete).
  3. 각 newDep에 대해 `reverse[newDep]`에 `noteId` 추가.
- `removeNote`:
  1. forward[noteId]의 각 d에 대해 reverse[d]에서 noteId 제거 (빈 set이면 delete).
  2. forward[noteId] delete.
  3. **reverse[noteId]는 그대로 유지** (외부 의존자의 stale 참조).
- `depsOf` / `dependentsOf`: 내부 Set을 **복사해서** 반환하거나 `new Set(internal)`로 방어적 복사. `ReadonlySet` 타입으로 반환.
- `has`: `forward.has(id) || reverse.has(id)`.

파일 안의 함수/설명 주석은 핵심만. 추가 헬퍼가 필요하면 `packages/astro-integration/src/depGraph.ts`에 같이 두고 export 하지 않는다.

### (3) Export

`packages/astro-integration/src/index.ts`에 **추가** (기존 export 유지):

```ts
export { createDepGraph } from './depGraph.ts';
export type { DepGraph } from './depGraph.ts';
```

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:

- `packages/astro-integration/tests/depGraph.test.ts`의 10개 assert 전부 통과.
- `packages/astro-integration/src/index.ts`가 `createDepGraph`/`DepGraph`를 re-export.
- 새 dep 추가 없음 (순수 TS만 사용).
- 기존 astro-integration 테스트 18건(remarkWikilink 7 + loader 6 + integration 5) 단 하나도 깨지지 않는다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. **Mutation check** (로컬 수동, 커밋 금지):
   - `setDeps`의 "이전 deps 제거" 블록을 주석 처리 → assert 3이 실제로 실패하는지 확인 → 원복.
   - `removeNote`가 reverse[noteId]까지 지우도록 바꿔 → assert 6이 실패 재현 → 원복.
   - `depsOf`/`dependentsOf`가 내부 Set을 그대로 반환하도록 바꿔 → assert 9가 실패 재현 → 원복.
   결과를 `summary`에 "mutation check: stale-reverse/ext-reverse/defensive-copy 모두 실패 재현 OK"로 한 줄 기록.
3. 아키텍처 체크리스트:
   - 이 모듈은 Astro/chokidar/node fs 심볼을 import하지 않는다 (순수 데이터 구조).
   - `packages/core/**` 는 수정하지 않는다.
4. 결과에 따라 `phases/step3b-astro-watcher/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "depGraph + 10 tests + defensive copy OK"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **외부 의존자의 reverse 엔트리까지 `removeNote`에서 지우지 마라.** 이유: 다른 노트의 markdown이 재파싱되기 전까지 "A는 B를 링크한다"는 사실은 여전히 관찰 가능해야 한다. 조기 정리는 watcher가 "B가 다시 생기면 A를 재빌드" 판단을 놓치게 만든다.
- **`depsOf`/`dependentsOf`가 내부 `Set` 인스턴스를 그대로 반환하지 마라.** 이유: 호출자가 `.add()`/`.delete()`로 내부 상태를 오염시키면 재현 불가능한 invalidation 버그로 이어진다. `ReadonlySet` 타입만으로는 런타임 보호가 안 되므로 새 Set 복사로 반환한다.
- **Astro/chokidar/node:fs에 의존하지 마라.** 이유: depGraph는 순수 데이터 구조여야 Step 1 watcher 테스트에서도 쉽게 조합 가능하고, 향후 SSR/다른 어댑터에서도 재사용 가능하다.
- **`packages/core/**`를 수정하지 마라.** 필요 시 블록.
- 기존 테스트를 깨뜨리지 마라.
