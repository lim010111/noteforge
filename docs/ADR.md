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
**결정**: `title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`만 공개. 그 외 모든 필드는 공개 렌더에서 제거.
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
**결정**: vault 파일은 이 레포에 포함하지 않음. `apps/blog/obsidian-blog.config.ts`에서 절대경로로 지정.
**이유**:
- 이 레포의 git 이력에 private 노트가 실수로 포함되는 사고를 원천 차단.
- 다른 사용자가 자기 vault를 연결하는 패턴이 동일 (도구성).
**대안**: 레포 내 `vault/` + `.gitignore` — 설치는 쉽지만 실수 위험.
**트레이드오프**: 초기 설정에서 절대경로 지정 단계 필요. `obpub status` 등 CLI가 config를 쉽게 안내.
