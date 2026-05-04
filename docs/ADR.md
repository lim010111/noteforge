# Architecture Decision Records

## 철학
privacy-first. 한 가지 책임을 잘 하는 도구. "기본값이 새는 쪽"이면 안 된다. 외부 의존은 필요한 최소한만. 결정은 한 곳(`packages/core/src/privacy/`)에.

---

### ADR-001: SSG 프레임워크로 Astro 5 선택
**결정**: Astro 5.x의 Content Layer API 기반으로 구현.
**이유**:
- MDX/Markdown 네이티브 지원, content collections이 vault 파싱 모델과 잘 맞음.
- 0-JS by default로 정적 블로그에 적합.
- Islands로 그래프뷰 등 인터랙티브 영역만 선택적 하이드레이션.
- 생태계/호스팅 호환성 우수 (Vercel/Netlify/Cloudflare).
- Node.js/TS 네이티브라 remark 파이프라인 제어가 자연스러움.
**대안**: Quartz 자체 빌드(Vite+Preact) — 자유도 높지만 MVP에 과함. Next.js `output: 'export'` — 콘텐츠 사이트에 무거움. Eleventy — JS 생태계 약함.
**트레이드오프**: Astro 버전 업에 어댑터 영향. 대응: `@noteforge/astro`에 의존 격리.

---

### ADR-002: Opt-in privacy 모델
**결정**: 기본값 `isPublic = false`. `public: true` frontmatter 또는 `#public` 태그로만 공개.
**이유**: Quartz의 opt-out 모델은 사용자 실수(새 노트 작성 시 명시적으로 `publish: false` 누락)에 취약. 민감 vault에서 신뢰 계약을 세우려면 반대 방향이 필요.
**대안**: Quartz 호환 opt-out — 기존 사용자 전환 쉬움. 하지만 제품 차별점이 사라짐.
**트레이드오프**: 모든 노트에 명시 표시가 필요. 사용자가 frontmatter/태그를 잊으면 공개가 안 됨 — `obpub status` 명령으로 완화.

---

### ADR-003: pnpm workspaces monorepo
**결정**: `packages/{core, astro-integration, theme-default, cli}` + `apps/blog` 단일 레포.
**이유**:
- `core`는 프레임워크 독립이므로 다른 어댑터로 확장 가능.
- `theme-default`는 교체 가능한 하나의 테마 — 분리해야 사용자 교체가 쉬움.
- 도그푸드 사이트(`apps/blog`)를 같은 레포에 두면 엔드투엔드 회귀를 CI에서 즉시 감지.
**대안**: 단일 패키지 — 초기엔 빠르지만 테마 교체/어댑터 확장 시 리팩터링 부담.
**트레이드오프**: 초기 설정(pnpm workspace, tsconfig base, turbo) 오버헤드. 초기 1일 투자 > 장기 이득.

---

### ADR-004: Private 링크 기본 동작 = `strip-to-text`
**결정**: public 노트가 `[[Private]]`를 링크하면 AST에서 `<a>` 없이 plain text로 치환. 저자가 명시적으로 썼던 단어만 남음.
**이유**: `remove-entirely`는 문장 구조를 깨고, `placeholder("[비공개 링크]")`는 "여기 뭔가 있다"는 신호를 노출함. 저자가 쓴 단어는 저자 책임 영역이므로 자연스러운 타협점.
**대안**: `remove-entirely` — 최대 안전, 문장 왜곡. `placeholder` — 명시적, 전문가 바이브.
**트레이드오프**: 저자가 private 노트 제목을 직접 타이핑한 경우 그 단어는 남음. `audit --strict`에서 경고.

---

### ADR-005: Obsidian 코멘트 `%%...%%` 무조건 제거
**결정**: 공개/비공개 여부와 무관하게 Phase A(discovery) 직후 본문 AST에서 `%%...%%` 블록/인라인 모두 제거.
**이유**: `%%...%%`는 Obsidian 에디터에서 저자 본인에게만 보이는 사적 코멘트. 민감 정보(아이디어, 비판, 인용 출처 등)를 담는 경우가 많음. 보수적으로 처리하는 편이 안전.
**대안**: 저자에게 공개/비공개 선택권 — 편의성 vs 안전성 트레이드에서 안전성을 기본값으로.
**트레이드오프**: 드물게 저자가 공개하려던 코멘트도 사라짐. 명시적 opt-in 플래그(`publishComments: true`)는 v0.2에서 검토.

---

### ADR-006: Frontmatter allowlist (blocklist가 아닌)
**결정**: `title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`만 공개. 그 외 모든 필드는 공개 렌더에서 제거.
**이유**: blocklist는 "잊은 필드가 누출"되지만 allowlist는 "잊은 필드가 감춰짐". privacy-first 원칙에 맞음.
**대안**: blocklist — 호환성 높지만 새 필드 추가 시 누출 위험.
**트레이드오프**: 사용자가 커스텀 필드(`reading-time`, `mood`)를 공개하려면 `publishing.frontmatterAllowlist`에 추가해야 함. 명시적 선언이 문서화 효과.

---

### ADR-007: 자체 remark plugin (remark-wiki-link 미사용)
**결정**: `@noteforge/core/src/privacy/linkRewriter.ts`를 직접 구현. 기존 `remark-wiki-link` 사용하지 않음.
**이유**: private 타겟 탐지 + 3가지 동작(resolved / privateTarget / notFound) 구분 + 정확한 AST 치환 제어가 필수. 라이브러리 래퍼로는 테스트가 어려움.
**대안**: `remark-wiki-link` + post-processing — 복잡도 분산되고 회귀 추적 어려움.
**트레이드오프**: ~100줄 자체 코드 유지 필요. 그만큼 프라이버시 동작을 테스트로 완전 제어.

---

### ADR-008: MIT 라이선스
**결정**: 코드 MIT 라이선스. vault 콘텐츠는 사용자 소유를 README에 명시.
**이유**: 최대 채택, 상업 사용 허용. 개인 개발자들이 자기 도그푸드로 쓰기 편함.
**대안**: AGPL — SaaS 복제 방어에는 유리하나 개인 채택 저해.
**트레이드오프**: 미래 SaaS 전환 시 재검토 가능 (듀얼 라이선스 또는 코어/프로 분리).

---

### ADR-009: 다중 vault는 MVP 지연
**결정**: config schema는 `vaults: []` 배열을 허용하되 v0.1 구현은 `length > 1`이면 에러.
**이유**: 다중 vault는 테마 해석 프로토콜(vault별 URL 프리픽스 + 테마 분리 렌더)이 필요해 설계 복잡도가 급증. 먼저 단일 vault로 privacy 핵심을 견고히 하고, v0.2에서 확장.
**트레이드오프**: 다중 vault 수요가 있는 사용자는 v0.2를 기다려야 함. 대신 schema가 배열 기반이므로 breaking change 없이 확장 가능.

---

### ADR-010: Vault는 레포 외부 절대경로로 참조
**결정**: vault 파일은 이 레포에 포함하지 않음. `apps/blog/noteforge.config.ts`에서 절대경로로 지정.
**이유**:
- 이 레포의 git 이력에 private 노트가 실수로 포함되는 사고를 원천 차단.
- 다른 사용자가 자기 vault를 연결하는 패턴이 동일 (도구성).
**대안**: 레포 내 `vault/` + `.gitignore` — 설치는 쉽지만 실수 위험.
**트레이드오프**: 초기 설정에서 절대경로 지정 단계 필요. `obpub status` 등 CLI가 config를 쉽게 안내.

---

### ADR-011: Chromatic 팔레트 확장 (v0.3)
**결정**: v0.3에서 보조 액센트(`--color-accent-2`, forest-moss `#4d6948` / `#9ec19a`) 1개 + 카테고리 액센트 슬롯(`--color-accent-cat-1..5`, iron-oxide / ochre / moss / bronze / slate) 5개 + 사이드바 surface tier(`--color-bg-sidebar`) 1개를 도입. 모두 *warm earth tone family* 안에 머물며, per-슬롯 hover/soft 변종은 토큰으로 만들지 않는다.
**이유**:
- v0.2 도그푸드 결과, 단일 iron-oxide 액센트만으로는 사이드바·폴더 트리·breadcrumb·홈 레일이 평면적이라는 평가. *production-grade*의 결을 내려면 *identity / current-location*용 보조 채널과 폴더별 색-코딩이 필요.
- "사용자가 컬러풀함을 원한다"는 요구를 보라/인디고/네온으로 풀면 v0.2 안티패턴(보라/인디고 브랜드, AI 무지개)을 다시 들이는 셈. warm earth tone 가족만 따라 *coordinated*하게 확장하면 SaaS 클리셰를 들이지 않으면서도 분위기를 다층화할 수 있다.
- 사이드바 surface tier는 *recess* 신호(Δ 휘도 < 1.5:1)로만 작동 — `--color-bg-sidebar`는 페이지 색의 한 단계 단차일 뿐, panel처럼 도드라지지 않는다. 1px 우측 헤어라인이 실제 분리를 담당.
**대안**:
- (1) **토큰 손대지 않고 컴포넌트 레이아웃만 개편** — 사이드바 추가만으로는 트리/레일이 여전히 단색이라 *vault의 모양*이 색으로는 안 읽힘. 시각 임팩트 부족.
- (2) **멀티 브랜드 색 시스템 도입(보라/인디고/시안 같은 cool 가족 추가)** — v0.2 안티패턴 §"보라/인디고 브랜드 색상" 행을 정면 위반. 거부.
- (3) **slot ceiling 6+ + per-슬롯 hover/soft 변종 풀세트** — hue 영역이 warm 가족 밖으로 밀려나거나, 호출부가 per-카테고리 surface 시스템을 합성할 수 있어 multi-brand 시각으로 변질될 위험. 5슬롯 + flat tier로 막는다.
**트레이드오프**: 토큰 추가는 fork 사용자가 테마를 커스터마이즈할 때 학습 비용이 늘어남(액센트가 *primary action* / *secondary identity* / *5 카테고리 슬롯*으로 분기). 완화책으로 `docs/UI_GUIDE.md` §3·§4-5에서 슬롯 의미를 vault-agnostic 언어로(슬롯 인덱스는 의미 중립, 매핑은 결정론적 해시) 명문화한다. WCAG AA 검증은 모든 신규 토큰에 대해 페이지/사이드바 양쪽 배경 대비로 두 번 수행했고, 최종 hex/대비 값은 `packages/theme-default/src/styles/tokens.css`의 인라인 주석에 보존되어 있다.

---

### ADR-012: 폴더 라우팅 전략 — `trailingSlash: 'always'` + 충돌 빌드 타임 throw
**결정**: v0.3에서 `astro.config.mjs`의 `trailingSlash`를 `'never'`(v0.2)에서 `'always'`로 전환. 모든 내부 URL은 trailing slash로 끝난다(`/AI/Claude/`, `/AI/Claude/foo/`, `/tags/typescript/`). 폴더-노트 / 폴더-alias 슬러그 충돌은 `apps/blog/src/pages/[...slug].astro:39`의 alias↔note 충돌 throw 패턴을 그대로 따라 빌드 타임 throw로 처리한다.
**이유**:
- v0.3가 폴더 인덱스 URL(`/AI/Claude/`)을 도입하면서 노트 URL(`/AI/Claude/foo`)과의 슬래시 정책 차이가 *vacuous*하지 않게 됐다. 두 정책이 다르면 매칭 우선순위·canonical/og:url·`_headers` 매처·alias `<meta http-equiv="refresh">`가 모두 갈라져 회귀 추적이 어렵다. 한 규칙으로 통일하면 충돌 면이 닫힌다.
- 충돌이 발생하면 silent override(어느 분기가 이긴 건지 사용자가 알기 어려움)가 아니라 명시적 fail-fast가 자연스럽다 — alias collision 가드(`apps/blog/src/pages/[...slug].astro:39`)와 동일 정책. 빌드 메시지로 사용자가 vault frontmatter 또는 폴더 레이아웃에서 즉시 해결 가능.
**대안**:
- **trailingSlash 유지 + 폴더 URL을 `/folders/...` 등 별도 prefix로 분리** — URL 디자인이 vault 사용자 관점에서 부자연스럽고("내 노트 폴더가 왜 `/folders/AI/Claude/`?"), fork 사용자 학습 비용 증가. Obsidian의 폴더 멘탈 모델과도 맞지 않음.
- **silent override** — 충돌 시 후순위 라우트를 무시 — 사고 시 노트 1편이 dist에서 사라지는 결과. fail-fast가 안전.
- **trailingSlash 유지(`'never'`) + 폴더 URL을 `/AI/Claude/index`로 우회** — trailing slash 없는 폴더 인덱스가 검색엔진/canonical에서 어색하고, alias와 동일 슬러그 충돌 가능성은 그대로 남음.
**트레이드오프**:
- 기존 step8 canonical / og:url / alias meta-refresh / `_headers` 매처가 모두 새 슬래시 정책으로 한꺼번에 갱신되어야 함(step 6 작업). step 8 audit이 dist에서 모든 내부 URL이 trailing slash를 갖는지 검증.
- Cloudflare Pages는 `trailingSlash: 'always'`를 자연스럽게 지원하지만, fork 사용자가 다른 호스팅(Netlify/Vercel)을 쓸 경우 매처 동작 차이를 `docs/DEPLOY.md`(미래 갱신)에 명시 필요. 현재는 v0.2 release 채택 호스팅이 Cloudflare 단일이라 즉시 영향 없음.

---

### ADR-013: 게시물 미리보기 서문은 `description` 우선, rendered HTML excerpt fallback
**결정**: 목록 미리보기의 서문은 allowlisted `frontmatter.description`을 우선 사용한다. 값이 없거나 공백이면 Content Layer의 `entry.rendered.html`에서 텍스트를 추출해 160자 excerpt로 표시한다.
**이유**:
- 모든 공개 노트가 `description`을 작성하지는 않는다. 빈 행을 만들면 썸네일형 목록에서 정보 밀도가 급격히 낮아진다.
- raw markdown body를 다시 읽거나 새로 파싱하면 privacy pipeline을 우회할 위험이 있다. `rendered.html`은 이미 comment strip, private link rewrite, private transclusion 제거, attachment closure 처리를 거친 산출물이므로 listing fallback의 입력으로 적합하다.
- 본문 맨 앞의 `#public` 같은 공개 opt-in 태그는 독자용 서문이 아니므로 excerpt 앞에서만 제거한다.
**대안**: description이 없으면 서문을 생략 — 구현은 단순하지만 실제 vault에서 대부분의 목록 행이 제목+메타만 남는다. raw markdown에서 excerpt 생성 — privacy 단계 중복/우회 위험 때문에 거부.
**트레이드오프**: HTML-to-text 변환은 완전한 브라우저 DOM 파서가 아니라 보수적인 문자열 정규화다. 현재는 파이프라인 산출 HTML의 제한된 형태를 대상으로 충분하며, excerpt는 표시 보조 정보일 뿐 canonical content가 아니다.
