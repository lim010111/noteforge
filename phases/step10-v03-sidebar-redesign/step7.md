# Step 7: home-recent-and-featured-rails

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `apps/blog/src/pages/index.astro` (현재 v0.2 홈 — 이번 step에서 두 레일 구조로 재작성)
- `apps/blog/src/lib/viewModels.ts` (`NoteEntry` 타입, `filterPublishable`, 기존 sort 패턴)
- `packages/theme-default/src/components/NoteList.astro` (홈 레일이 reuse할 수 있는 NoteList 컴포넌트)
- `phases/step10-v03-sidebar-redesign/design/COMPONENTS.md` (RecentRail / FeaturedRail 시안 + featured 0개일 때 거동)
- `packages/core/src/config.ts`의 frontmatter allowlist 부분 — `featured`가 이미 v0.1 step8에서 allowlist에 들어왔음(추가 작업 0).

## 작업

### 1. 신규 헬퍼 `apps/blog/src/lib/homeRails.ts`

```ts
import type { NoteEntry } from './viewModels.ts';

export const RECENT_RAIL_CAP = 10;
export const FEATURED_RAIL_CAP = 6;

/**
 * publishable 노트 중 최근 N개를 반환.
 * - 정렬: data.date desc.
 * - 날짜 없는 엔트리는 *맨 끝*으로 안정 정렬(있는 것끼리 desc → 없는 것끼리 stable id alphabetical).
 * - 그 후 RECENT_RAIL_CAP만큼 take.
 */
export function selectRecent(entries: NoteEntry[]): NoteEntry[];

/**
 * publishable + featured: true 인 노트 중 N개를 반환.
 * - 정렬: data.date desc (featured_priority 같은 추가 필드 사용 금지).
 * - FEATURED_RAIL_CAP만큼 take.
 * - 빈 입력/조건 미충족 → []. 호출부가 빈 배열로 레일 자체 미렌더 결정.
 */
export function selectFeatured(entries: NoteEntry[]): NoteEntry[];
```

두 함수 모두 *pure*. 입력은 이미 `filterPublishable`을 통과한 publishable set이라 가정.

### 2. `apps/blog/src/pages/index.astro` 재작성

대략 형태:

```astro
---
import { getCollection } from 'astro:content';
import { BaseLayout, NoteList } from '@noteforge/theme-default';
import { filterPublishable, type NoteEntry } from '../lib/viewModels.ts';
import { selectRecent, selectFeatured } from '../lib/homeRails.ts';
import { buildSidebarPayload } from '../lib/sidebarPayload.ts'; // step 8에서 들어옴 — 본 step은 placeholder import만, 본 step에서 placeholder 헬퍼 1줄 작성하거나 step 8 합류 후 wire.
import obpubConfig from '../../obsidian-blog.config.ts';
// ...
const all = await getCollection('notes');
const publishable = filterPublishable(all);
const recent = selectRecent(publishable);
const featured = selectFeatured(publishable);
---

<BaseLayout title={obpubConfig.site.title} canonicalUrl={...}>
  <section aria-labelledby="recent-heading">
    <h2 id="recent-heading">Recent</h2>
    <NoteList notes={recent} />
  </section>

  {featured.length > 0 && (
    <section aria-labelledby="featured-heading">
      <h2 id="featured-heading">Featured</h2>
      <NoteList notes={featured} />
    </section>
  )}
</BaseLayout>
```

핵심 규칙:
- `featured.length === 0`이면 `<section>` 자체가 *미렌더*. 빈 헤딩, "No featured posts" 카피, 빈 `<ul>` 컨테이너 *모두 금지*.
- 사이드바 wire는 step 8에서 담당 — 본 step은 home rail 데이터/렌더에만 집중. 단, `<BaseLayout>`에 `sidebar` prop을 전달할 placeholder 자리는 두되, 데이터 연결은 step 8의 책임.
- 본 step 안에서 step 8 의존 import가 어렵다면 한 줄짜리 inline 헬퍼(`buildSidebarPayload`를 step 8에서 도입할 위치)를 비워두고 TODO 주석 *없이* 그냥 `sidebar` prop을 빠뜨려도 됨 — step 5의 BaseLayout이 `sidebar` 옵셔널이라 미전달 시 v0.2 단일 컬럼으로 폴백.

### 3. 테스트

신규 `apps/blog/src/lib/homeRails.test.ts`:

1. `selectRecent`이 `RECENT_RAIL_CAP` 상수 export — `import { RECENT_RAIL_CAP } from '../homeRails'`로 실값 확인(매직넘버 회귀 가드).
2. 11개 입력 → 10개 출력(cap).
3. 8개 입력 → 8개 출력(cap 미만이면 그대로).
4. 입력에 날짜 없는 엔트리 섞여 있을 때 → 날짜 있는 엔트리가 desc 정렬로 앞, 날짜 없는 엔트리가 끝(stable id alphabetical).
5. `selectFeatured`이 `FEATURED_RAIL_CAP` 상수 export.
6. `featured: true` 7개 → 6개 출력(cap).
7. `featured: true` 0개 → `[]`.
8. 동일 date 동률 → stable id alphabetical.
9. **empty featured render assertion**: 페이지 렌더 스냅샷(가능한 환경에서) 또는 정적 분석 — 입력 `publishable`에 `featured: true`가 *없는* fixture로 빌드 후, `apps/blog/dist/index.html`에 `Featured` 문자열이 0회 등장(case-insensitive grep). 이게 제일 결정적인 누설 0 가드.

`pnpm --filter blog build` 후 빌드 산출물 grep으로 9번 어서션을 추가 검증.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm obpub audit

# featured 0개 fixture에서 'Featured' 문자열 0회 (실제 vault 상황 따라 통과 — 회귀 시 이 grep이 1+로 나오면 누설)
# (vault에 featured 노트가 있다면 본 검사는 skip — 단, fixture-driven 단위 테스트가 본 케이스를 커버해야 함)

# 헬퍼 상수 export 확인
grep -c 'export const RECENT_RAIL_CAP'   apps/blog/src/lib/homeRails.ts   # = 1
grep -c 'export const FEATURED_RAIL_CAP' apps/blog/src/lib/homeRails.ts   # = 1
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 단계 통과.
2. 홈 레일 체크리스트:
   - `selectRecent`/`selectFeatured`이 pure 함수(외부 IO 없음)?
   - cap 상수가 named const로 export?
   - featured 0개일 때 `<section>` 자체 미렌더(헤딩/카피/빈 컨테이너 모두 0)?
   - sort가 `date` desc만(featured_priority 등 추가 필드 0)?
3. canary 회귀: 빌드 후 canary 2종 0회.
4. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 7을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "homeRails.ts 신규(selectRecent n=10/selectFeatured n=6, named const export, undated stable) + index.astro Recent/Featured 두 레일, featured 0개 → 섹션 자체 미렌더, 9 테스트 통과"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- featured 0개일 때 어떤 형태로든 "Featured" 단어/헤딩/카피/`<section>` 빈 껍데기를 렌더하지 마라. 이유: 사용자가 *featured 노트를 갖지 않았다*는 정보 자체를 흘리지 않음(empty-state 누설). v0.3 시각 계약상 *없으면 자리도 없다*.
- 새 frontmatter 필드(`featured_priority`, `pinned` 등)를 도입하지 마라. 이유: privacy allowlist는 별도 PR/별도 step의 책임이고, 본 step은 *기존 allowlist 안의* `featured`만 사용한다.
- featured 정렬에 `date` 외 다른 키를 쓰지 마라. 이유: TODO.md 결정 사항 표상 정렬은 date desc 한 가지.
- `RECENT_RAIL_CAP`/`FEATURED_RAIL_CAP`을 매직넘버 인라인으로 박지 마라. 이유: fork 사용자 튜닝 가능 + 회귀 가드 grep.
- `index.astro` 본문에서 privacy 판정(`isPublic`)을 호출하지 마라. 이유: `filterPublishable`이 단일 SSOT.
- `packages/core/src/privacy/**`을 수정하지 마라.
