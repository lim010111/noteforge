# Architecture Decision Records

이 디렉터리는 큰 아키텍처 결정 한 건당 하나의 파일로 보존한다. 형식: [Michael Nygard ADR template](https://github.com/joelparkerhenderson/architecture-decision-record).

## 인덱스

- [0001-privacy-first-opt-in.md](./0001-privacy-first-opt-in.md) — 기본값 = 비공개 (vs Quartz opt-out)
- [0002-allowlist-frontmatter.md](./0002-allowlist-frontmatter.md) — frontmatter allowlist 강제 + 단일 소스
- [0003-pnpm-workspace-monorepo.md](./0003-pnpm-workspace-monorepo.md) — pnpm workspace 4 패키지 + 1 앱 구조
- [0004-build-locally-not-ci.md](./0004-build-locally-not-ci.md) — apps/blog 빌드는 사용자 머신에서만 (CI 자동 빌드 미지원)
- [0005-tdd-for-privacy.md](./0005-tdd-for-privacy.md) — privacy 영역은 실패 테스트 먼저, canary 검증 강제
- [0011-chromatic-palette-expansion.md](./0011-chromatic-palette-expansion.md) — v0.3 secondary accent + 5 카테고리 슬롯 + 사이드바 surface tier (warm earth tone family)
- [0012-folder-routing-trailing-slash.md](./0012-folder-routing-trailing-slash.md) — v0.3 `trailingSlash: 'always'` + 폴더↔노트/alias 슬러그 충돌 빌드 타임 throw
- [0014-sticky-header-shadow-on-scroll.md](./0014-sticky-header-shadow-on-scroll.md) — v0.6 sticky 헤더 `--shadow-1` on scroll (4번째 static-contract JS 예외)

> ADR-0006 ~ ADR-0010, ADR-0013은 현재 [`docs/ADR.md`](../ADR.md)에만 인라인 형태로 남아 있다. 표준 SSOT로 분리할 가치가 있다고 판단되는 시점에 이 디렉터리에 백필한다.

## 새 결정 추가

1. 다음 4자리 번호로 새 파일 생성 (`0006-...md`).
2. Status / Context / Decision / Consequences / Date 5섹션.
3. 이 README.md 의 인덱스에 한 줄 추가.
4. 관련 모듈 CLAUDE.md 에서 link. 프로젝트 차원 결정은 root MEMORY.md 에서도 link.
