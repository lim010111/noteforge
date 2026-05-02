# @noteforge/theme-default

## 책임 (Owns)
레퍼런스 Astro 테마. 컴포넌트 / 레이아웃 / 스타일을 export 하고, 항상 frontmatter allowlist 외 필드를 렌더링하지 않는다는 privacy 계약을 강제한다.

## 핵심 파일
- src/index.ts — 컴포넌트 / 레이아웃 named export
- src/layouts/ — BaseLayout 등 페이지 shell
- src/components/ — Note · Backlinks · Graph · FolderIndex · TagPage 등
- src/lib/ — categoryAccent / graph layout 헬퍼
- src/styles/ — Tailwind v4 토큰 + 글로벌 스타일

## 외부 의존 (Depends on)
- `@noteforge/core` — frontmatter allowlist 정의 소비
- peerDep: astro 5.x, tailwindcss 4.x

## 테스트
```bash
pnpm --filter @noteforge/theme-default test
```
(experimental_AstroContainer 사용)

## 변경 패턴 (Common modification patterns)
- 새 컴포넌트 → src/components/ 추가 + src/index.ts export. allowlist 외 필드는 noop 처리 검증
- 새 디자인 토큰 → src/styles/ Tailwind 토큰 + BaseLayout 호환성 확인
- 그래프 / 폴더 트리 표시 변경 → src/lib/ 헬퍼만 수정. raw vault 접근 금지

## Non-obvious
- **반드시**: 컴포넌트는 항상 이미 필터된 `rendered.html` 만 소비. raw vault body / allowlist 외 frontmatter 직접 접근 금지 (루트 CRITICAL).
- **주의**: `cover` / `thumbnail` 이미지는 allowlist 안이지만, path 가 public attachment closure 에 있을 때만 노출.
- **Note:** preview / hero 텍스트는 allowlisted `description` 우선, 없을 때만 `rendered.html` 앞부분에서 excerpt 생성.
- 외부 호스트 URL 차단 정책(AvatarBlock 등) — 새 컴포넌트 추가 시 동일 정책 유지.

## 관련 (Related)
- 의존: [@noteforge/core](../core/CLAUDE.md)
- 소비자: [apps/blog](../../apps/blog/CLAUDE.md)
- 결정 기록: [adr/0002-allowlist-frontmatter.md](../../docs/adr/0002-allowlist-frontmatter.md)
