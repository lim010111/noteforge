# blog (apps/blog)

## 책임 (Owns)
도그푸드 사이트. vault 노트를 Astro Content Layer 로 로드하고 `@noteforge/theme-default` 컴포넌트로 렌더. 프로젝트별 obpub 설정의 SSOT.

## 핵심 파일
- noteforge.config.ts — 이 사이트의 ObpubConfig (SSOT)
- src/content.config.ts — Astro Collection (obpubLoader + zod 스키마)
- src/lib/pipelineCache.ts — per-note privacy 결과 메모이즈
- src/lib/folderAggregation.ts — 폴더 트리 / 인덱스 뷰모델
- src/lib/viewModels.ts — 페이지 단위 뷰모델 조립

## 외부 의존 (Depends on)
- `@noteforge/astro`, `@noteforge/core`, `@noteforge/theme-default` (워크스페이스)
- astro 5.x, tailwindcss 4.x

## 테스트
```bash
pnpm --filter blog typecheck      # astro check
pnpm test -- apps/blog            # 뷰모델 / 폴더 집계 unit
pnpm --filter blog build          # 빌드 + 자동 audit
```

## 변경 패턴 (Common modification patterns)
- 새 페이지 라우트 → src/pages/ + src/content.config.ts schema 일관성 확인 + trailingSlash 'always' 유지
- 새 뷰모델 → src/lib/ 단위 테스트 + theme/core export 만 import (raw vault read 금지)
- 사이트 설정 변경 → noteforge.config.ts SSOT 만 수정. avatar 외부 호스트 거부 검증

## Non-obvious
- **반드시**: pipelineCache 는 privacy 결과를 캐시한다. privacy 로직을 여기에 재구현하지 말 것.
- **주의**: vendor:assets (fonts / katex) 가 `predev` / `prebuild` 에 자동 실행. 신규 자산 self-host 만 허용.
- **Note:** trailingSlash: 'always' 로 통일. 새 라우트 추가 시 슬래시 일관성 유지.
- 커스텀 페이지도 항상 theme / core export 만 import — raw vault read 절대 금지.

## 관련 (Related)
- 의존: [@noteforge/astro](../../packages/astro-integration/CLAUDE.md), [@noteforge/core](../../packages/core/CLAUDE.md), [@noteforge/theme-default](../../packages/theme-default/CLAUDE.md)
- 결정 기록: [adr/0004-build-locally-not-ci.md](../../docs/adr/0004-build-locally-not-ci.md)
