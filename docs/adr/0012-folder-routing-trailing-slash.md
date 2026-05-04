# 0012. Folder Routing — `trailingSlash: 'always'` + Build-time Collision Throw

## Status
Accepted · 2026-Q2 · v0.3

## Context
v0.3가 폴더 인덱스 URL(`/AI/Claude/`)을 도입하면서 노트 URL(`/AI/Claude/foo`)과의 슬래시 정책 차이가 *vacuous*하지 않게 됐다. 두 정책이 다르면 다음 항목이 모두 갈라져 회귀 추적이 어려워진다.

- 매칭 우선순위 (Astro 라우터)
- `<link rel="canonical">` / `og:url` (검색 엔진 / 소셜 카드 일관성)
- `_headers` 매처 (Cloudflare Pages 등)
- alias `<meta http-equiv="refresh">`

또한 폴더-노트 / 폴더-alias가 같은 슬러그로 충돌할 때 silent override(어느 분기가 이긴 건지 사용자가 알기 어려움)는 사고 시 노트 1편이 dist에서 사라지는 결과를 낸다.

## Decision
- v0.3에서 `astro.config.mjs`의 `trailingSlash`를 `'never'`(v0.2)에서 **`'always'`**로 전환한다. 모든 내부 URL은 trailing slash로 끝난다(`/AI/Claude/`, `/AI/Claude/foo/`, `/tags/typescript/`).
- 폴더-노트 / 폴더-alias 슬러그 충돌은 `apps/blog/src/pages/[...slug].astro:39`의 alias↔note 충돌 throw 패턴을 그대로 따라 **빌드 타임 throw**로 처리한다. 빌드 메시지로 사용자가 vault frontmatter 또는 폴더 레이아웃에서 즉시 해결할 수 있다.

## Alternatives considered
- **trailingSlash 유지(`'never'`) + 폴더 URL을 `/folders/...` 등 별도 prefix로 분리** — URL 디자인이 vault 사용자 관점에서 부자연스럽고("내 노트 폴더가 왜 `/folders/AI/Claude/`?"), fork 사용자 학습 비용 증가. Obsidian의 폴더 멘탈 모델과도 맞지 않음.
- **silent override** — 충돌 시 후순위 라우트를 무시. 노트 1편이 dist에서 사라지는 결과. fail-fast가 안전.
- **trailingSlash 유지(`'never'`) + 폴더 URL을 `/AI/Claude/index`로 우회** — trailing slash 없는 폴더 인덱스가 검색엔진/canonical에서 어색하고, alias와 동일 슬러그 충돌 가능성은 그대로 남음.

## Consequences
- **+** 매칭 우선순위·canonical·og:url·`_headers`·alias meta-refresh가 한 규칙을 따라 충돌 면이 닫힌다.
- **+** 슬러그 충돌이 silent override 대신 빌드 타임 fail-fast로 드러난다.
- **−** 기존 step8 canonical / og:url / alias meta-refresh / `_headers` 매처가 새 슬래시 정책으로 한꺼번에 갱신되어야 한다. step 8 audit이 dist에서 모든 내부 URL이 trailing slash를 갖는지 검증한다.
- **−** Cloudflare Pages는 `trailingSlash: 'always'`를 자연스럽게 지원하지만, fork 사용자가 다른 호스팅(Netlify/Vercel)을 쓸 경우 매처 동작 차이를 `docs/DEPLOY.md`(미래 갱신)에 명시할 필요가 있다. 현재는 v0.2 release 채택 호스팅이 Cloudflare 단일이라 즉시 영향 없음.

## Related
- [docs/ADR.md](../ADR.md) — 인라인 결정 색인
- [docs/DEPLOY.md](../DEPLOY.md) — 호스팅별 매처 동작 (TODO: fork 사용자 가이드)
- 코드: `apps/blog/astro.config.mjs`, `apps/blog/src/pages/[...slug].astro` (alias↔note collision throw 패턴)
