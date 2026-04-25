# Step 0: blog-scaffold-and-config

`apps/blog`의 부트스트랩. Astro 5 + Tailwind v4 + obpub integration을 묶고, `obsidian-blog.config.ts`에 실 vault 절대경로(`/mnt/c/Users/shine/Documents/Obsidian`)를 박는다. 라우트는 한 줄도 만들지 않는다 — content collection이 살아있고 `astro sync`가 통과하는 데까지만 간다. 이 step의 부산물로 WSL `/mnt/c` 환경에서 chokidar가 변경을 놓치지 않도록 watcher polling 옵션을 노출한다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — Phase A→D, 데이터 흐름, 프레임워크 경계.
- `/docs/ADR.md` — ADR-001(Astro 5), ADR-003(monorepo 분리), ADR-006(allowlist).
- `/docs/PRD.md` — apps/blog 도그푸드 사용자 요구.
- `/docs/UI_GUIDE.md` — 색상 토큰, 타이포 결정.
- `/CLAUDE.md` — CRITICAL 규칙(privacy 한 곳, allowlist, tripwire, comment strip, transclusion).
- `/packages/astro-integration/src/integration.ts` — 현재 `obpub()` 시그니처, `astro:server:setup` watcher 부팅 위치, `ObpubIntegrationOptions`.
- `/packages/astro-integration/src/watcher.ts` — `WatcherOptions`(특히 `chokidarFactory` 주입점), `defaultChokidarFactory`가 chokidar.watch에 넘기는 옵션 형태.
- `/packages/astro-integration/src/loader.ts` — `obpubLoader(config)` 사용법, 노출되는 `ObpubEntry` 형태.
- `/packages/core/src/config.ts` — `defineConfig`, `obpubConfigSchema`, 강제 ignore merge, `unsafeAllowPrivateFolder`.
- `/packages/core/src/pipeline.ts` — `runCorePipeline(config)` 시그니처와 `PipelineResult` 형태.
- `/packages/theme-default/src/index.ts` — 어떤 컴포넌트/타입이 export되는지.
- `/packages/theme-default/src/styles/{base,tokens}.css` — Tailwind 지시어 포함 여부 (없다면 apps/blog의 global.css에서 직접 `@import "tailwindcss"`).
- `/apps/blog/package.json` — 현재 의존성.
- `/apps/blog/tsconfig.json` — 기존 설정.

## 작업

### 1. apps/blog 의존성 보강

`apps/blog/package.json`에 다음을 추가하고 `pnpm install`로 lockfile 갱신:

```jsonc
{
  "dependencies": {
    "@obpub/astro": "workspace:*",
    "@obpub/core": "workspace:*",
    "@obpub/theme-default": "workspace:*",
    "astro": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4"
  }
}
```

추가 의존성을 새로 도입하지 마라(MDX, sitemap, OG, prettier-astro 등은 v0.2 이후). MDX는 명시적 비채택 — vault 노트는 loader가 사전 렌더 HTML을 store에 직접 넣으므로 불필요하다.

### 2. `apps/blog/astro.config.mjs`

```js
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { obpub } from '@obpub/astro';
import obpubConfig from './obsidian-blog.config.ts';

export default defineConfig({
  site: obpubConfig.site.url,
  trailingSlash: 'never',
  output: 'static',
  integrations: [
    obpub(obpubConfig, {
      // WSL `/mnt/c` 마운트 환경에서 chokidar inotify 이벤트가 누락되는 알려진 이슈 대응.
      // 본 옵션은 dev에서만 의미가 있다. CI/배포는 정상 fs이므로 영향 없음.
      watcher: { usePolling: true, pollInterval: 200 },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
```

### 3. `apps/blog/obsidian-blog.config.ts`

```ts
import { defineConfig } from '@obpub/core/config';

export default defineConfig({
  site: {
    title: 'shine notes',                      // 임시. 사용자 도그푸드용. v0.2에서 user-controllable.
    url: 'https://example.com',                // placeholder. 도메인 확정 시 교체. README에도 표시.
    author: 'shine',
  },
  vaults: [
    {
      id: 'shine',
      path: '/mnt/c/Users/shine/Documents/Obsidian',
      urlPrefix: '/',
      theme: '@obpub/theme-default',
      ignore: [
        'Templates/**',
        'Excalidraw/**',
        '.space/**',
        'Clippings/**',
        'attachments/**',
      ],
    },
  ],
  // private/**, .obsidian/**, .trash/** 는 core가 강제 merge — 명시적 재기재 금지.
  publishing: {
    requireExplicitOptIn: true,
    // tagBlocklist는 사용자가 도그푸드하면서 채운다. 빈 배열이 v0.1 디폴트.
  },
  privateLinkBehavior: 'strip-to-text',
});
```

주의: **vault 절대경로는 이 파일에서만 박힌다.** README/문서에 절대경로 노출 금지 (사용자 머신 정보).

### 4. `apps/blog/src/content.config.ts`

```ts
import { defineCollection, z } from 'astro:content';
import { obpubLoader } from '@obpub/astro';
import obpubConfig from '../obsidian-blog.config.ts';

const notes = defineCollection({
  loader: obpubLoader(obpubConfig),
  schema: z
    .object({
      title: z.string().optional(),
      frontmatter: z.record(z.unknown()),
      tags: z.array(z.string()),
      backlinks: z.array(z.string()),
    })
    .strict(),
});

export const collections = { notes };
```

스키마는 loader가 `store.set`에 넣는 `ObpubEntry.data`와 정확히 일치해야 한다 (`@obpub/astro/loader` 참조). 새 필드 추가는 금지 — allowlist 외 frontmatter를 컴포넌트에 흘리는 경로가 된다.

### 5. Tailwind v4 + theme tokens

`apps/blog/src/styles/global.css`:

```css
@import 'tailwindcss';
@import '@obpub/theme-default/styles/tokens.css';
@import '@obpub/theme-default/styles/base.css';
```

theme-default에서 `styles/{tokens,base}.css`가 export 가능한지 `packages/theme-default/package.json`을 확인하고, exports에 `"./styles/*": "./src/styles/*"`가 없으면 추가한다 (별도 코드 변경 없이 path subexport만).

이 step에서는 layout 파일을 만들지 않는다 (step 1의 책임). global.css는 라우트가 생기는 step 1부터 import된다.

### 6. `obpub()` integration에 watcher polling 옵션 추가

핵심 작은 패치 두 곳:

`packages/astro-integration/src/integration.ts`:

```ts
export interface ObpubIntegrationOptions {
  onDevInvalidate?: (events: { kind: string; slug: string }[]) => void;
  createWatcherImpl?: typeof createWatcher;
  /**
   * dev 서버 watcher의 chokidar 옵션을 얇게 노출.
   * usePolling은 WSL `/mnt/c` 같은 pseudo-fs에서 inotify가 실패할 때 필요.
   * 프로덕션 빌드는 watcher를 띄우지 않으므로 본 옵션은 dev에서만 의미.
   */
  watcher?: {
    usePolling?: boolean;
    pollInterval?: number;
  };
}
```

`astro:server:setup` 안에서 createWatcher 호출 시 새 옵션을 위로 흘린다 (createWatcher 시그니처에도 같은 형태로 한 키만 추가). 그리고 `defaultChokidarFactory`가 chokidar.watch에 넘기는 opts에 `usePolling`/`interval`을 합친다.

`packages/astro-integration/src/watcher.ts` — `WatcherOptions`에 다음 키 추가:

```ts
readonly chokidarOptions?: {
  usePolling?: boolean;
  pollInterval?: number;
};
```

start() 안에서 chokidarFactory에 넘기는 opts 객체에 `usePolling`과 `interval`(`pollInterval` 매핑)을 spread merge. 기존 `ignored`/`ignoreInitial`/`persistent`는 유지.

테스트는 작게 추가한다 (`packages/astro-integration/tests/watcher.options.test.ts` 신설, 또는 기존 watcher 테스트에 케이스 추가):

1. chokidarOptions 미지정 → factory에 넘긴 opts에 `usePolling` 키 부재.
2. `chokidarOptions: { usePolling: true, pollInterval: 200 }` → factory에 넘긴 opts에 `usePolling: true`, `interval: 200` 포함.
3. `usePolling: false` 명시 → factory에 넘긴 opts에 `usePolling: false`.

integration 테스트 (`packages/astro-integration/tests/integration.options.test.ts`)도 한 케이스: `obpub(config, { watcher: { usePolling: true } })`로 server:setup을 호출했을 때 `createWatcherImpl`이 `chokidarOptions: { usePolling: true }`로 호출됨.

기존 watcher/integration 테스트는 변경하지 마라.

### 7. apps/blog tsconfig 보강

`apps/blog/tsconfig.json`이 `astro/tsconfigs/strict`(또는 동급) 위에 얹혔는지 확인. `noUncheckedIndexedAccess: true`를 명시(루트 base에 이미 있다면 inherit, 없으면 추가). vault 경로 import(`./obsidian-blog.config.ts`) 해석을 위해 `module: NodeNext`/`moduleResolution: bundler` 중 Astro가 권장하는 쪽을 그대로 둔다.

### 8. 디렉토리 구조 (이 step 종료 시점)

```
apps/blog/
├── astro.config.mjs           # NEW
├── obsidian-blog.config.ts    # NEW
├── package.json               # 의존성 보강
├── tsconfig.json              # 보강
└── src/
    ├── content.config.ts      # NEW
    └── styles/
        └── global.css         # NEW
```

`pages/`는 만들지 않는다 — step 1의 책임.

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog exec astro sync
```

전부 0 exit. astro sync는 content collection 타입 생성 + obpubLoader가 vault를 한 번 walk 하는 동작이며, 0-public 결과여도 통과해야 한다 (loader는 publicSlugs가 비어 있으면 store를 빈 상태로 둔다).

watcher 패치에 따른 신규 vitest 케이스 4개 이상 추가.

## 검증 절차

1. AC 커맨드 실행. 특히 `pnpm --filter blog exec astro sync`의 stdout에 `obpub: ` 로그(parseNote/walk 진행)가 보이는지 확인.
2. `apps/blog/.astro/types.d.ts`에 `notes` collection 타입이 생성됐는지 확인 (없으면 sync가 실패한 것).
3. 아키텍처 체크리스트:
   - 공개 판정 로직을 apps/blog 또는 integration에 재구현하지 않았는가? (loader/pipeline만 사용)
   - frontmatter allowlist 외 필드를 content schema에 추가하지 않았는가?
   - vault 절대경로가 `obsidian-blog.config.ts` 외 어디에도 하드코딩되지 않았는가?
   - WSL polling 옵션이 dev 경로에서만 영향을 주고 build에는 무관한가?
4. 결과에 따라 `phases/step6-apps-blog/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "한 줄"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단

## 금지사항

- **라우트(`pages/`)를 만들지 마라.** 이유: scope 분리. step 1의 책임이며, 이 step에서 만들면 0-public 시나리오의 빌드 검증 책임이 모호해진다.
- **MDX 통합 / sitemap / OG 이미지 / pagefind 등 추가 Astro integration을 도입하지 마라.** 이유: MVP 스코프 외(Plan v0.2). vault 노트는 loader가 HTML로 직접 넘기므로 MDX 파이프라인이 필요 없다.
- **content schema에 frontmatter allowlist 외 필드를 추가하지 마라.** 이유: CLAUDE.md CRITICAL — 한 곳에서 결정, 다른 곳에서 우회 금지.
- **vault 절대경로를 `obsidian-blog.config.ts` 외 파일에 적지 마라.** README/문서/주석 모두 금지(사용자 머신 정보 노출).
- **`runCorePipeline`을 직접 호출하지 마라.** 이유: 이 step은 부트스트랩만. 직접 호출은 step 2의 graph endpoint에서 module-level memoize와 함께 도입한다.
- **theme-default의 컴포넌트를 wrap 또는 fork하지 마라.** 이유: theme 교체 가능성을 깬다. apps/blog는 theme를 그대로 import만 한다.
- **기존 테스트를 깨뜨리지 마라.** 특히 `packages/astro-integration/tests/`의 watcher/integration 테스트와 `packages/core/tests/integration/`의 canary 검증.
- **TODO.md를 임의로 갱신하지 마라.** Step 6 전체 완료 후 별도 정리.
