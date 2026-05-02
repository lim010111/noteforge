# Architecture Decision Records

이 디렉터리는 큰 아키텍처 결정 한 건당 하나의 파일로 보존한다. 형식: [Michael Nygard ADR template](https://github.com/joelparkerhenderson/architecture-decision-record).

## 인덱스

- [0001-privacy-first-opt-in.md](./0001-privacy-first-opt-in.md) — 기본값 = 비공개 (vs Quartz opt-out)
- [0002-allowlist-frontmatter.md](./0002-allowlist-frontmatter.md) — frontmatter allowlist 강제 + 단일 소스
- [0003-pnpm-workspace-monorepo.md](./0003-pnpm-workspace-monorepo.md) — pnpm workspace 4 패키지 + 1 앱 구조
- [0004-build-locally-not-ci.md](./0004-build-locally-not-ci.md) — apps/blog 빌드는 사용자 머신에서만 (CI 자동 빌드 미지원)
- [0005-tdd-for-privacy.md](./0005-tdd-for-privacy.md) — privacy 영역은 실패 테스트 먼저, canary 검증 강제

## 새 결정 추가

1. 다음 4자리 번호로 새 파일 생성 (`0006-...md`).
2. Status / Context / Decision / Consequences / Date 5섹션.
3. 이 README.md 의 인덱스에 한 줄 추가.
4. 관련 모듈 CLAUDE.md 에서 link. 프로젝트 차원 결정은 root MEMORY.md 에서도 link.
