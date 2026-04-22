# Step 2: astro-integration

## 목표

사용자가 `astro.config.mjs`에서 호출하는 `obpub(config)` **AstroIntegration factory**를 구현한다. 이 factory는:

1. `astro:config:setup` 훅에서 `remarkWikilink` plugin을 `markdown.remarkPlugins`에 **append** (replace 금지) 한다.
2. `obpubLoader`를 export surface로 노출해 사용자가 `src/content.config.ts`에서 `defineCollection({ loader: obpubLoader(config) })`로 사용하도록 한다. (integration 훅에서 collection을 직접 등록하지 않는다 — Astro 5 Content Layer 관례: collection은 사용자 `content.config.ts`에서 선언.)
3. `astro:build:done` 훅을 **placeholder**로만 예약한다. 실제 audit 로직은 후속 phase(@obpub/cli + Phase D) 범위.

TDD 순서를 지킨다: **실패 테스트 먼저 → 구현으로 통과.**

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — Phase D (audit) 자리, `watcher.ts` 자리 (watcher는 step3b에서 다룸)
- `/docs/ADR.md` — ADR-001 (Astro 의존 격리 — `@obpub/astro`에 몰아넣기), ADR-007 (wikilink plugin)
- `/packages/core/src/config.ts` — `ObpubConfig` 구조, `defineConfig`
- `/packages/core/src/pipeline.ts` — 필요 시 `runCorePipeline` 조기 호출 여부 설계 결정용
- 앞선 step 산출물:
  - `/packages/astro-integration/src/remarkWikilink.ts` — `RemarkWikilinkOptions`
  - `/packages/astro-integration/src/loader.ts` — `obpubLoader`
  - `/packages/astro-integration/src/index.ts` — 현재 export surface
- Astro 5 Integration API: `AstroIntegration` 타입은 `astro`에서 export. `hooks['astro:config:setup']`는 `{ updateConfig, addWatchFile, logger, config, ... }` 를 받는다. `updateConfig({ markdown: { remarkPlugins } })`는 기존 배열에 **array-merge** (append) 된다.

## 작업

### (1) 테스트 파일 선행

파일: `packages/astro-integration/tests/integration.test.ts`

Astro 실 모듈을 구동하지 않는다 — `AstroIntegration`의 `hooks`를 꺼내 **직접 호출**하면서 `updateConfig`/`logger`를 spy로 주입한다.

최소 5개 독립 assert (`it`/`test` 분리):

1. **factory shape**: `obpub(validConfig)`가 `{ name: '@obpub/astro', hooks: { ... } }`를 반환하고 `name`은 패키지 식별자(예: `'@obpub/astro'` 고정)이다.
2. **`astro:config:setup` 호출 시 remarkWikilink append 1회**: mock `updateConfig` spy를 주입하고 훅 함수를 호출. `updateConfig`가 정확히 **1회** 호출되고, 호출 인자가 `{ markdown: { remarkPlugins: [entry] } }` 형태이며 entry는 `remarkWikilink` 참조(함수 동일성) 또는 `[remarkWikilink, options]` 튜플 형태다. 다른 훅을 `updateConfig`에 섞어 넣지 않는다 (예: integrations, vite 등은 건드리지 않는다).
3. **기존 remarkPlugins 보존**: `astro:config:setup`에 `config.markdown.remarkPlugins = [existingDummyPlugin]` 상태를 줘도, `updateConfig({ markdown: { remarkPlugins: [ourPlugin] } })`가 호출되는지 확인. (Astro의 deep-merge가 append 동작하므로 integration은 **자기 plugin만** 전달한다. 기존 plugin을 재기재해서 중복 등록 금지.) spy로 `updateConfig`의 인자 keys를 검사해 `markdown.remarkPlugins.length === 1`이며 `existingDummyPlugin`이 **포함되지 않았음**을 확인.
4. **`astro:build:done` placeholder**: 훅이 정의되어 있고, 호출 시 throw하지 않으며, `logger.info`가 정확히 1회 호출된다 (메시지에 `audit placeholder` 등 명시적 표식 포함). `dist/` 스캔·파일 I/O는 절대 수행하지 않는다.
5. **export surface**: `import * as pkg from '@obpub/astro'` 한 뒤 `pkg.obpub`, `pkg.obpubLoader`, `pkg.remarkWikilink` 세 심볼이 모두 함수(`typeof === 'function'`)로 존재한다. 이 테스트는 별도 `it` 블록으로 두되 동일 파일에 포함.

Astro 타입 가져올 때 실 Astro 런타임이 필요하지 않아야 한다 — `import type { AstroIntegration } from 'astro'`만 허용, 값 import 금지.

### (2) 구현

파일: `packages/astro-integration/src/integration.ts`

정확한 export 시그니처:

```ts
import type { AstroIntegration } from 'astro';
import type { ObpubConfig } from '@obpub/core/config';

export function obpub(config: ObpubConfig): AstroIntegration;
```

구현 골격:

```ts
export function obpub(config: ObpubConfig): AstroIntegration {
  return {
    name: '@obpub/astro',
    hooks: {
      'astro:config:setup': ({ updateConfig, logger }) => {
        // remarkWikilink는 runtime 호출이 돌아올 때 vault 인덱스에 접근해야 한다.
        // MVP: integration 시점에는 resolve/isPublic를 noop 대기 상태로 두고,
        //      loader가 실제로 실행되면 동일 config를 기반으로 인덱스를 재계산한다.
        //      (저자가 직접 작성한 .astro/.mdx 페이지의 wikilink는 MVP에서 지원 범위 밖 —
        //       vault 노트 content는 loader 경로로 이미 재작성된 HTML이 들어온다.)
        // 따라서 integration이 plugin에 주입하는 resolve는 "resolved: false"로 일관 반환하는
        // 보수적 stub이어도 된다. plugin은 그 경우 unresolved 분기를 타서 strip-to-text로 안전 처리.
        const resolveStub: RemarkWikilinkOptions['resolve'] = () => ({ resolved: false });
        const isPublicStub: RemarkWikilinkOptions['isPublic'] = () => false;
        const hrefForStub: RemarkWikilinkOptions['hrefFor'] = (id) => `/${id}`;

        updateConfig({
          markdown: {
            remarkPlugins: [
              [remarkWikilink, {
                resolve: resolveStub,
                isPublic: isPublicStub,
                hrefFor: hrefForStub,
                onWarning: (w) => logger.warn(`wikilink: ${w.raw}${w.message ? ' — ' + w.message : ''}`),
              } satisfies RemarkWikilinkOptions],
            ],
          },
        });
      },
      'astro:build:done': ({ logger }) => {
        logger.info('obpub: build done — audit placeholder (audit arrives in @obpub/cli phase)');
      },
    },
  };
}
```

위 주석 정책 (MVP stub resolver)을 코드 주석에 그대로 기록한다. 이는 설계 의도 — stub이므로 `.astro`/`.mdx`의 wikilink는 모두 strip-to-text로 빠지며, vault 본문 렌더링은 loader가 pre-rendered HTML로 제공. 이 정책은 step3b 또는 추후 phase에서 shared-state registry 또는 pipeline preload로 대체될 수 있다.

### (3) Export surface 정비

`packages/astro-integration/src/index.ts`:

```ts
export { obpub } from './integration.ts';
export { obpubLoader } from './loader.ts';
export { remarkWikilink } from './remarkWikilink.ts';
export type { RemarkWikilinkOptions } from './remarkWikilink.ts';
```

기본 export(default export)는 추가하지 않는다 — 명시적 named import만 허용해 사용자 혼동을 줄인다.

### (4) 의존성

- `astro`는 이미 `peerDependencies`. 추가 dep 없음.
- `@obpub/core/config` re-export 서브패스가 이미 열려 있으므로 그대로 사용.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:

- `packages/astro-integration/tests/integration.test.ts`의 5 assert 전부 통과.
- `packages/astro-integration/src/index.ts`에서 `obpub`, `obpubLoader`, `remarkWikilink` 3개 심볼 모두 re-export.
- `pnpm-lock.yaml` diff 없음 (새 dep 미추가).
- 기존 unit/integration 테스트 단 하나도 깨지지 않는다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. **Mutation check** (로컬 수동, 커밋 금지):
   - `astro:config:setup`에서 `updateConfig` 호출을 주석 처리 → assert 2가 **실제로** 실패하는지 확인 → 원복.
   - `astro:build:done` placeholder에서 `throw new Error('oops')` → assert 4가 실패 재현 → 원복.
   결과를 `summary`에 "mutation check: config:setup/build:done 모두 실패 재현 OK"로 기록.
3. 아키텍처 체크리스트:
   - `integration.ts`는 Astro API surface만 import. remark/unified 내부는 `remarkWikilink.ts`에 캡슐화.
   - `astro:config:setup`에서 **vault 파일 시스템 스캔을 절대 수행하지 않는다**. `runCorePipeline` 호출 금지 — 그것은 `loader.load` 경로의 책임이다. (dev 서버 기동 지연 방지.)
   - `astro:build:done`에서 실제 audit 구현을 넣지 않는다. `dist/` 스캔/파일 I/O 금지.
   - loader/plugin 내부 로직을 integration에서 재구현하지 않는다.
4. 결과에 따라 `phases/step3a-astro-loader/index.json`의 step 2를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "obpub integration + 5 assert + placeholder 훅 + export surface 정비"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`astro:config:setup`에서 vault 전체 스캔 / `runCorePipeline` 호출을 수행하지 마라.** 이유: dev 서버 기동이 O(vault) 시간만큼 지연된다. 파일 읽기는 `loader.load` 실행 시점으로 위임한다.
- **`updateConfig`에서 기존 사용자 `remarkPlugins`를 명시적으로 다시 넘겨 중복 등록하지 마라.** Astro는 deep-merge로 append하므로 자기 plugin만 넘긴다. 기존 plugins를 읽어다 다시 넣으면 merge 후 중복된다.
- **`astro:build:done`에서 실제 audit 구현을 넣지 마라.** 이유: audit은 @obpub/cli 및 Phase D 전용 범위. 여기는 hook 연결만 확보한다.
- **기본 export(default export) 금지.** 이유: named export 일관성 유지. 사용자 코드에서 `import obpub from '@obpub/astro'` 스타일 혼용 시 treeshake·리팩터링 리스크.
- **core(`packages/core/src/**`)를 이 step에서 수정하지 마라.** 필요 시 블록.
- 기존 테스트를 깨뜨리지 마라.
