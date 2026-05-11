# @noteforge/astro

## 책임 (Owns)
Astro 5 어댑터. Content Layer loader + chokidar 기반 watcher 로 core 파이프라인을 dev / build 사이클에 통합한다. wikilink remark 변환, 의존 그래프 추적, dev 모드 cover 이미지 미들웨어 포함.

## 핵심 파일
- src/integration.ts — Astro hook 진입점 (defineIntegration 래퍼)
- src/loader.ts — Content Collection loader (`runCorePipeline` 래핑)
- src/watcher.ts — chokidar 기반 watcher + debounced invalidation. **상태/edge 추적은 자체 보유하지 않음** — `createIncrementalVaultIndex`로 위임. 이 패키지의 `@noteforge/core` import는 `createIncrementalVaultIndex` (+ `ObpubConfig` 타입) 단일 진입점.
- src/remarkWikilink.ts — `[[...]]` MDX 변환
- src/devCoverMiddleware.ts — dev 모드 cover 이미지 응답

## 외부 의존 (Depends on)
- `@noteforge/core` — config / pipeline / privacy / parseNote
- peerDep: astro 5.x

## 테스트
```bash
pnpm --filter @noteforge/astro test
```

## 변경 패턴 (Common modification patterns)
- 새 watcher 이벤트 → src/watcher.ts + (필요 시) `createIncrementalVaultIndex`의 인터페이스 확장. forward/reverse edge 추적 자체는 인덱서 내부 — 여기서 재구현 금지.
- 새 remark 변환 추가 → src/remarkWikilink.ts 패턴 확장 후 src/integration.ts 에 등록
- dev 미들웨어 변경 → src/devCoverMiddleware.ts. privacy 결정을 절대 재유도하지 말 것
- **새 core 심볼이 필요 → `packages/core/src/index.ts`에 export 추가 후 `from '@noteforge/core'`로 임포트.** 서브패스 임포트는 ESLint가 차단.

## Non-obvious
- **반드시**: watcher 는 privacy 판정을 재유도하지 않음 — `core/classify` 결과만 신뢰. VaultIndex 자체도 classify를 모르므로 watcher 경로에 privacy 코드가 새어들어갈 표면이 없다.
- **주의**: incremental VaultIndex의 forward/reverse edge는 dev 서버 lifecycle 동안만 in-memory. build 시 `buildVaultIndex` 가 매번 새로 walk.
- **Note:** chokidar 는 test 주입 가능 (EventEmitter 인터페이스). 통합 테스트에서 mock 사용.
- attachment closure 검증은 core 가 수행 — integration 은 path rewrite 만 담당.
- **단일 cross-package 진입점**: 이 패키지의 src/*.ts 가 `@noteforge/core/<subpath>`를 임포트하면 안 된다 (ESLint `no-restricted-imports`). 새 심볼 필요 시 core의 `src/index.ts`에 export 추가.

## 관련 (Related)
- 의존: [@noteforge/core](../core/CLAUDE.md)
- 소비자: [apps/blog](../../apps/blog/CLAUDE.md)
- 결정 기록: [adr/0003-pnpm-workspace-monorepo.md](../../docs/adr/0003-pnpm-workspace-monorepo.md)
