# @noteforge/astro

## 책임 (Owns)
Astro 5 어댑터. Content Layer loader + chokidar 기반 watcher 로 core 파이프라인을 dev / build 사이클에 통합한다. wikilink remark 변환, 의존 그래프 추적, dev 모드 cover 이미지 미들웨어 포함.

## 핵심 파일
- src/integration.ts — Astro hook 진입점 (defineIntegration 래퍼)
- src/loader.ts — Content Collection loader (`runCorePipeline` 래핑)
- src/watcher.ts — chokidar 기반 watcher + debounced invalidation
- src/depGraph.ts — forward / reverse edge 추적
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
- 새 watcher 이벤트 → src/watcher.ts + src/depGraph.ts invalidation 흐름 동시 갱신
- 새 remark 변환 추가 → src/remarkWikilink.ts 패턴 확장 후 src/integration.ts 에 등록
- dev 미들웨어 변경 → src/devCoverMiddleware.ts. privacy 결정을 절대 재유도하지 말 것

## Non-obvious
- **반드시**: watcher 는 privacy 판정을 재유도하지 않음 — `core/classify` 결과만 신뢰.
- **주의**: in-memory dep-graph 는 dev 서버 lifecycle 동안만 유지. build 시 새로 생성된다.
- **Note:** chokidar 는 test 주입 가능 (EventEmitter 인터페이스). 통합 테스트에서 mock 사용.
- attachment closure 검증은 core 가 수행 — integration 은 path rewrite 만 담당.

## 관련 (Related)
- 의존: [@noteforge/core](../core/CLAUDE.md)
- 소비자: [apps/blog](../../apps/blog/CLAUDE.md)
- 결정 기록: [adr/0003-pnpm-workspace-monorepo.md](../../docs/adr/0003-pnpm-workspace-monorepo.md)
