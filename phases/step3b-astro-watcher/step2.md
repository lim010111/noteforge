# Step 2: integration-wiring

## 목표

Step 1의 `createWatcher`를 Astro 개발 서버 수명주기에 연결한다: `astro:server:setup`에서 기동, `astro:server:done`에서 정리, debounced 이벤트마다 Vite에 **full-reload** 신호를 보낸다. vitest 레벨 통합 테스트로 "파일 이벤트 → 서버로 full-reload 전송" 경로가 관통되는지 검증한다.

이 step이 step3b의 최종 단계다. **브라우저 레벨 Playwright smoke는 여기서 수행하지 않는다** — 실 vault + `apps/blog`가 준비되는 Step 6에서 수행한다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "Dev 시간 watcher가 `reverseDependencies`를 in-memory로 유지. invalidate()로 HMR 트리거"
- `/home/shine/.claude/plans/public-fizzy-patterson.md` — "Watcher debounce 200ms + 의존 노트 invalidation" 섹션 전체
- `/packages/astro-integration/src/integration.ts` — 현재 `obpub` factory (config:setup/build:done 훅만 있음). 이 파일을 **수정**한다.
- `/packages/astro-integration/src/watcher.ts` — Step 1 산출물. 이 step의 유일한 신규 의존.
- `/packages/astro-integration/src/index.ts` — 현재 export surface
- `/packages/astro-integration/tests/integration.test.ts` — 기존 5 assert. 여기 스타일을 따라 assert를 추가하거나 별도 파일 작성 가능.

## 작업

### (1) Integration hook 추가

파일: `packages/astro-integration/src/integration.ts` (기존 파일 수정)

추가할 훅: `astro:server:setup`, `astro:server:done`.

설계:

```ts
import type { AstroIntegration } from 'astro';
import type { ObpubConfig } from '@obpub/core/config';
import { remarkWikilink, type RemarkWikilinkOptions } from './remarkWikilink.ts';
import { createWatcher, type Watcher } from './watcher.ts';

export interface ObpubIntegrationOptions {
  /** 테스트용 주입: Vite dev server에 full-reload 신호를 보내는 함수 대신 주입 가능. */
  onDevInvalidate?: (events: { kind: string; slug: string }[]) => void;
  /** 테스트용 주입: createWatcher factory 대체. */
  createWatcherImpl?: typeof createWatcher;
}

export function obpub(
  config: ObpubConfig,
  opts: ObpubIntegrationOptions = {},
): AstroIntegration {
  let watcher: Watcher | undefined;
  // ... 기존 config:setup 로직 유지 ...

  return {
    name: '@obpub/astro',
    hooks: {
      'astro:config:setup': /* 기존 그대로 */,

      'astro:server:setup': async ({ server, logger }) => {
        if (watcher !== undefined) return; // idempotent

        const factory = opts.createWatcherImpl ?? createWatcher;
        const vault = config.vaults[0];
        if (vault === undefined) {
          logger.warn('obpub: watcher not started — config has no vault');
          return;
        }

        watcher = factory({
          vaultPath: vault.path,
          vaultId: vault.id,
          ignore: vault.ignore,
          config,
          onInvalidate: (events) => {
            if (opts.onDevInvalidate !== undefined) {
              opts.onDevInvalidate(
                events.map((e) => ({ kind: e.kind, slug: e.slug })),
              );
              return;
            }
            logger.info(
              `obpub: vault changed (${events.length} event${events.length === 1 ? '' : 's'}) — full reload`,
            );
            // Vite v5/v6: server.ws.send; 일부 버전은 server.hot.send. 호환 가드.
            const viteHot = (server as unknown as {
              ws?: { send: (payload: unknown) => void };
              hot?: { send: (payload: unknown) => void };
            });
            const sender = viteHot.ws?.send?.bind(viteHot.ws)
              ?? viteHot.hot?.send?.bind(viteHot.hot);
            sender?.({ type: 'full-reload' });
          },
          onWarning: (msg) => logger.warn(`obpub watcher: ${msg}`),
        });
        await watcher.start();
        logger.info(`obpub: watching vault at ${vault.path}`);
      },

      'astro:server:done': async () => {
        if (watcher === undefined) return;
        await watcher.stop();
        watcher = undefined;
      },

      'astro:build:done': /* 기존 그대로 */,
    },
  };
}
```

주의사항:

- 기존 `astro:config:setup` 훅(remarkPlugins updateConfig, stub resolver)은 **절대 변경하지 않는다**. 오직 새로운 훅 2개를 추가하고, 파일 상단에 `ObpubIntegrationOptions` 인터페이스를 정의.
- `obpub` 함수 시그니처를 두 번째 optional 파라미터로 **확장**하되 기본값은 `{}`이므로 기존 호출자(`obpub(config)`)는 **그대로 동작**한다. 기존 integration.test.ts의 5 assert가 깨지면 안 된다.
- 상위에서 사용하는 `full-reload` payload는 Vite의 `HotPayload` 타입을 그대로 흉내낸 `{ type: 'full-reload' }`. 그 이상의 Vite 심볼은 import하지 않는다.

### (2) Test file 추가/확장

파일: `packages/astro-integration/tests/integration.test.ts` (기존 파일에 **추가**)

추가 최소 4개 assert:

1. **server:setup이 watcher를 기동** — 가짜 `createWatcherImpl` 주입: `start()`/`stop()`이 vi.fn인 watcher 반환. `obpub(config, {createWatcherImpl: fakeFactory})`의 `astro:server:setup`을 fake `server`/`logger` 인자로 호출 → fakeFactory가 정확히 1회, `start()`가 정확히 1회 호출.
2. **server:setup은 idempotent** — 같은 integration 인스턴스에서 `astro:server:setup`을 두 번 호출 → fakeFactory는 여전히 1회만 호출됨.
3. **invalidate 시 full-reload 전송** — `createWatcherImpl` 안에서 `onInvalidate` 콜백을 캡처해 둔 fake를 반환. `astro:server:setup` 호출 후, 캡처된 콜백을 `[{kind:'update', slug:'a', affectedSlugs:new Set(['a'])}]`로 수동 호출 → `server.ws.send`가 `{type:'full-reload'}` 인자로 정확히 1회 호출되는지 spy로 확인. `server.ws`가 없고 `server.hot.send`만 있는 케이스도 별도 assert로 커버(호환 가드 검증).
4. **server:done은 watcher.stop을 await** — `astro:server:done` 호출 → `stop()` spy가 1회 호출되고 await이 완료된 뒤에만 promise가 resolve된다. 이후 `astro:server:setup`을 다시 호출하면 fakeFactory가 재호출된다(=정상 재기동 가능).

기존 5 assert는 그대로 두고, **변경 없이 통과**해야 한다. `obpub(config)`처럼 두 번째 인자 없이 호출하는 기존 케이스가 있다면 그대로 동작해야 한다.

### (3) 통합 테스트 — 파일 이벤트 → full-reload (end-to-end)

같은 테스트 파일에 **최소 1개** 추가 assert:

5. **실 watcher + fake chokidar로 관통** — Step 1에서 쓴 fake chokidar(EventEmitter) 주입 패턴 재사용. 실제 `createWatcher`를 통과시키되 `chokidarFactory`와 `readFile`을 주입한 watcher를 만들고, 이를 `createWatcherImpl`로 주입(=옵션을 래핑해 전달). 가짜 vault 스냅샷: `a.md`(본문 `[[B]]`), `b.md`. vi.useFakeTimers. `server:setup` → chokidar에 `a.md` change emit → 200ms advance → `server.ws.send`가 `{type:'full-reload'}`로 1회 호출. `events.length === 1` (coalesced, `a` slug). **브라우저/Playwright 미사용.**

### (4) README/package docs 변경 금지

이 step에서는 어떤 README나 docs 파일도 건드리지 않는다. 문서 갱신은 전체 v0.1 완성 후 Step 7에서 일괄 처리.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:

- 기존 `integration.test.ts` 5 assert 그대로 통과.
- 신규 5 assert(위 1~5) 전부 통과.
- `obpub(config)` 1-인자 호출이 여전히 유효한 `AstroIntegration`을 반환한다 (기존 호출자 호환).
- `packages/core/**`, `packages/astro-integration/src/depGraph.ts`, `packages/astro-integration/src/watcher.ts`, `packages/astro-integration/src/remarkWikilink.ts`, `packages/astro-integration/src/loader.ts` **수정 없음**. 수정 대상은 `integration.ts` + `index.ts`(필요 시 type export 추가) + 테스트 파일뿐.
- 기존 전체 테스트(core + astro-integration 기존 건) 단 하나도 깨지지 않는다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. **Mutation check** (로컬 수동, 커밋 금지):
   - `astro:server:setup`에서 `await watcher.start()`를 제거 → assert 1/5가 실패 재현 → 원복.
   - `onInvalidate` 콜백 안의 `sender?.({type:'full-reload'})` 호출을 주석 처리 → assert 3/5 실패 재현 → 원복.
   - `astro:server:setup`의 idempotency 가드(`if (watcher !== undefined) return`)를 제거 → assert 2 실패 재현 → 원복.
   결과를 `summary`에 "mutation check: start/full-reload/idempotent 3종 실패 재현 OK"로 기록.
3. 아키텍처 체크리스트:
   - Vite 내부 심볼을 `import`로 참조하지 않는다 (타입 호환만 duck-typing으로 처리 — `server.ws?.send`/`server.hot?.send`).
   - `config:setup` 훅과 `build:done` 훅의 기존 동작이 bit-level로 동일하게 유지된다 (diff로 확인).
   - integration 파일이 여전히 framework-thin(=Astro 훅 배선만 하고 로직은 watcher/remarkWikilink에 위임).
   - `obpub(config)` 시그니처의 2번째 optional 파라미터 추가가 기존 호출자(apps/blog 부트스트랩이 아직 없어 영향은 없지만) 호환인지 코드서치로 확인 — 현 repo에 `obpub(` 호출자는 테스트 외 0건이어야 한다.
4. 결과에 따라 `phases/step3b-astro-watcher/index.json`의 step 2 및 phase를 업데이트:
   - 성공 → step 2 `"status": "completed"` + `"summary": "integration wiring + 5 new asserts + full-reload path OK"`; phase `completed_at` 기록은 execute.py가 자동 수행.
   - 실패/블록 → 해당 status + message 기록 후 중단.

## 금지사항

- **Vite 내부 API(`server.moduleGraph.invalidateModule`, `server.reloadModule` 등)를 사용하지 마라.** 이유: 버전별로 이름이 갈리고 Astro가 언제든 bridge를 바꿀 수 있다. slug 단위 무효화는 향후 phase에서 Astro Content Layer API를 공식 경로로 쓰는 쪽이 안전하다. v0.1은 **full-reload로 단순하게**. (MVP는 단순함을 기능보다 우선한다.)
- **`runCorePipeline`이나 loader를 integration에서 직접 호출하지 마라.** 이유: loader는 Astro Content Layer의 load cycle에서만 실행되어야 한다. full-reload 신호를 보내면 Astro가 알아서 loader를 다시 돌린다.
- **Playwright/브라우저 레벨 HMR smoke를 여기서 쓰지 마라.** 이유: 실 vault + apps/blog가 없는 상태에서 브라우저 테스트는 설치 부담만 크고 의미 있는 signal을 주지 못한다. vitest 레벨 "이벤트 → full-reload 전송"까지면 이 phase의 책임이 끝난다.
- **`remarkWikilink`의 stub resolver(`resolved: false`)를 이 step에서 교체하지 마라.** 이유: 실 resolver 교체는 공유 vault 인덱스를 integration 또는 더 상위 레이어에서 관리하는 별도 설계 결정이 필요하며, 그 자체로 다음 phase 한 개를 소모할 가치가 있다. 이 phase의 scope 밖.
- **`packages/core/**`, `depGraph.ts`, `watcher.ts`, `loader.ts`, `remarkWikilink.ts`를 수정하지 마라.** 수정이 필요해 보이면 블록하고 사용자 결정을 받는다.
- 기존 테스트를 깨뜨리지 마라.
