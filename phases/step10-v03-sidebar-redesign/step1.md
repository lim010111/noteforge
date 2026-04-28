# Step 1: docs-rewrite-and-backup

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `phases/step10-v03-sidebar-redesign/design/MOODBOARD.md`
- `phases/step10-v03-sidebar-redesign/design/TOKENS.md`
- `phases/step10-v03-sidebar-redesign/design/COMPONENTS.md`
- `phases/step10-v03-sidebar-redesign/design/ANTIPATTERNS.md`
- `docs/UI_GUIDE.md` (현재 v0.2 본문 — 전면 개정 대상)
- `docs/UI_GUIDE.v0.1.md` (v0.1 백업 — 같은 백업 패턴을 v0.3에서도 사용)
- `docs/ADR.md` (특히 ADR 번호 규약: `### ADR-NNN`, 4-section 구조 `**결정**` / `**이유**` / `**대안**` / `**트레이드오프**`)
- `docs/ARCHITECTURE.md` (사이드바·폴더 라우팅 섹션이 들어갈 위치)
- `apps/blog/src/pages/[...slug].astro:39` (기존 alias-collision throw 메시지 형식 — 새 ADR이 이 패턴을 참조해야 함)

## 작업

코드는 건드리지 않는다. 문서만 개정한다.

### 1. 백업

```bash
cp docs/UI_GUIDE.md docs/UI_GUIDE.v0.2.md
```

v0.1 백업이 이미 `docs/UI_GUIDE.v0.1.md`로 존재한다. 같은 패턴을 v0.2 → v0.2 백업에 적용. v0.2 백업 파일은 그 자체가 fork 사용자 대상 SSOT 이력이므로 `docs/` 안에 둔다(phase 폴더가 아님).

### 2. `docs/UI_GUIDE.md` 전면 개정 (v0.3)

v0.2 본문을 *기반*으로 다음을 반영:

- 1절 **설계 배경** — v0.2 → v0.3 전환 이유(dogfood 결과 시각 빈약함 비판). editorial-technical 골격 유지를 명시.
- **사이드바 · 폴더 트리** 새 절 — `<details>` 기반 JS-less 토글, 폴더 이름은 링크/`▶`는 `<summary>` 분리, lg+ 상시 + < lg 드로어, ARIA는 `<nav aria-label="Folder tree">` + `aria-current` (tree role 미사용 이유 명시).
- **AvatarBlock + 아이덴티티** 새 절 — `obpubConfig.site.{avatar, nickname}`. 외부 호스트 차단(http/https/// /data: 거부). 둘 다 없으면 블록 미렌더.
- **홈 레일** 새 절 — Recent(`n=10`) + Featured(`n=6`, `featured: true` frontmatter). featured 0개면 레일 자체 미렌더(empty-state 누설 0).
- **확장 팔레트** 새 절 — 보조 accent + 카테고리 accent + 새 surface tier. 한계선(warm 계열만, 페이지 배경 위 텍스처 금지) 명문화.
- **트레일링 슬래시 정책** 새 절 — `trailingSlash: 'always'` 채택 이유(폴더 인덱스 URL과 노트 URL 충돌면 축소). 마이그레이션 노트 한 줄.

다음은 **그대로 보존**(v0.2 계약):
- WCAG AA 4.5:1 대비, 키보드 focus outline, `prefers-reduced-motion`, semantic HTML, alt 의무.
- Privacy-first 시각 계약(시각만 다듬는 변경이 누출 경로를 만들지 않음).
- 정적 출력 계약(다크모드 sync script 1개 외 인터랙티브 JS 추가 금지).
- 7개 안티패턴 금지선(글래스 모피즘 / gradient text / AI 배지 / 네온 글로우·펄스 / 보라·인디고 / `rounded-2xl` 일괄 / gradient orb).

### 3. `docs/ARCHITECTURE.md` — 사이드바·폴더 라우팅 섹션 추가

새 절 `## 사이드바 · 폴더 라우팅`을 추가. 다음을 다룬다:

- **데이터 흐름**: `getCollection('notes')` → `filterPublishable` → `buildFolderTree(entries) → FolderNode` → `Sidebar` props. private 노트는 이미 `filterPublishable`에서 빠지므로 트리에 자연 부재(시각 계층 책임 0).
- **폴더 라우팅**: `[...slug].astro`에서 `kind: 'note' | 'alias-redirect' | 'folder-index'` 분기. 폴더 인덱스 URL은 `/path/with/slashes/` (trailingSlash always).
- **충돌 가드**: 폴더 경로가 노트 슬러그/alias id와 충돌하면 빌드 타임 throw. `apps/blog/src/pages/[...slug].astro:39`의 alias 충돌 throw 패턴을 그대로 따른다.
- **재사용 가치 결정**: `buildFolderTree`는 `apps/blog/src/lib/folderAggregation.ts`에 둠(입력이 Astro CollectionEntry라 core 재사용 가치 낮음 — TODO.md 트리키한 결정 사항 표 참조).

### 4. `docs/ADR.md` — ADR 2건 추가

기존 `### ADR-NNN` 번호 규약을 따라 다음 가용 번호 2개에 4-section 구조(`**결정**`, `**이유**`, `**대안**`, `**트레이드오프**`)로 추가.

ADR-A: **Chromatic 팔레트 확장 (v0.3)**
- 결정: 보조 accent 1개 + 카테고리 accent 4~6개 + 새 surface tier 1개 도입.
- 이유: v0.2 dogfood에서 단일 iron-oxide 액센트가 *production-grade* 결을 못 낸다고 평가. 컬러풀함은 사용자 요구.
- 대안: (1) 토큰 손대지 않고 컴포넌트 레이아웃만 개편 — 시각 임팩트 부족. (2) 멀티 브랜드 색 시스템 도입 — v0.2 안티패턴 위반.
- 트레이드오프: 토큰 추가는 fork 사용자가 테마 커스터마이즈 시 학습 비용 증가. UI_GUIDE에서 슬롯 의미를 vault-agnostic으로 적어 완화.

ADR-B: **폴더 라우팅 전략 — `trailingSlash: 'always'` + 충돌 빌드 타임 throw**
- 결정: `astro.config.mjs`에서 `trailingSlash: 'never'` → `'always'` 전환. 폴더-노트/폴더-alias 슬러그 충돌은 `apps/blog/src/pages/[...slug].astro:39` 패턴으로 빌드 타임 throw.
- 이유: 폴더 인덱스 URL(`/AI/Claude/`)과 노트 URL(`/AI/Claude/foo`)의 슬래시 정책을 한 규칙으로 통일하면 충돌면 축소. 충돌을 silent override하면 노트 누락 위험 — alias collision 가드와 동일 정책이 자연스럽다.
- 대안: trailingSlash 유지 + 폴더 URL을 `/folders/...` 등 별도 prefix로 분리 — URL 디자인이 vault 사용자 관점에서 부자연스럽고 fork 사용자 학습 비용 증가.
- 트레이드오프: 기존 step8 canonical/OG/alias meta-refresh가 모두 새 슬래시 정책을 따라야 함(step6에서 한꺼번에 갱신). _headers/Cloudflare 매칭 규칙 영향은 `pnpm obpub audit`로 검증.

### 5. CLAUDE.md는 건드리지 않는다

이유: CLAUDE.md의 *아키텍처 규칙*과 *개발 프로세스* 섹션은 v0.3에서도 동일하다. 명령어 표만 v0.3에서 변경되는 게 있으면 step 10에서 일괄 갱신.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test

# 본문 변경 sanity
grep -c "v0.3" docs/UI_GUIDE.md            # ≥ 1
grep -c "trailingSlash" docs/ADR.md        # ≥ 1
grep -c "사이드바" docs/ARCHITECTURE.md    # ≥ 1

# 백업 존재
test -f docs/UI_GUIDE.v0.2.md
```

## 검증 절차

1. 위 AC 커맨드 실행.
2. 문서 체크리스트:
   - UI_GUIDE에 접근성 계약(WCAG AA / focus outline / `prefers-reduced-motion` / semantic HTML / alt) 5개가 모두 *원문 그대로* 보존?
   - 7개 안티패턴 금지선이 v0.3 가이드에서도 동일하게 명시?
   - ADR 2건이 기존 번호 규약(`### ADR-NNN`)과 4-section 구조를 따랐는가?
   - ARCHITECTURE의 사이드바 절이 데이터 흐름 → 폴더 라우팅 → 충돌 가드 순으로 적혔는가?
3. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "UI_GUIDE v0.3 전면 개정 + v0.2 백업 + ARCHITECTURE 사이드바 섹션 + ADR 2건(palette/trailingSlash)"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- v0.2 백업(`docs/UI_GUIDE.v0.2.md`)을 삭제하거나 빈 파일로 두지 마라. 이유: fork 사용자 입장에서 디자인 이력이 SSOT다 — 같은 패턴을 step9에서 v0.1로 이미 적용했다.
- 7개 안티패턴 중 어느 하나라도 v0.3에서 *허용*으로 표기하지 마라. 이유: chromatic 확장은 *새 토큰* 도입이지 *금지 모티프 부활*이 아니다(ANTIPATTERNS.md 한계선 표 참조).
- 접근성 계약 5개 중 하나라도 누락 또는 약화시키지 마라. 이유: WCAG AA / focus / reduced-motion 등은 v0.1부터 누적된 계약이다.
- CLAUDE.md `## 아키텍처 규칙`이나 `## 개발 프로세스`를 수정하지 마라. 이유: privacy/TDD/canary 규칙은 v0.3에서도 동일하다.
- 코드(`packages/**`, `apps/**`)를 건드리지 마라. 이유: 이 step은 docs-only이고, tokens.css/siteSchema 확장은 step 2의 책임이다.
