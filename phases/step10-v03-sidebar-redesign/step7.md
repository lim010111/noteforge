# Step 7: home-recent-and-featured-rails

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `apps/blog/src/pages/index.astro` (현재 v0.2 홈 — 이번 step에서 두 레일 구조로 재작성. 현재 NoteList 호출 패턴 = `<NoteList entries={items} emptyMessage="..." />`. **그대로 따른다**.)
- `apps/blog/src/lib/viewModels.ts` (`NoteEntry` 타입, `filterPublishable`, 기존 sort 패턴)
- `packages/theme-default/src/components/NoteList.astro` 와 `NoteList.types.ts` — **API 계약 확인 필수**:
  - `NoteListProps = { entries: NoteListEntry[]; emptyMessage: string }` (둘 다 필수, prop 이름은 `entries`이지 `notes` 아님)
  - `NoteListEntry = { href: string; title: string; date?: string }` (NoteEntry가 아니라 strict subset)
  - 호출부는 `selectRecent`/`selectFeatured` 결과(NoteEntry[])를 NoteListEntry[]로 *직접 매핑*해야 한다.
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

`selectRecent`/`selectFeatured`는 `NoteEntry[]`를 반환하지만, `<NoteList />`는 `entries: NoteListEntry[]`(`{ href, title, date? }`)를 받는다. 호출부에서 매핑 단계가 필요. 기존 v0.2 `index.astro`의 매핑 패턴을 그대로 사용한다.

대략 형태:

```astro
---
import { getCollection } from 'astro:content';
import { BaseLayout, NoteList, type NoteListEntry } from '@noteforge/theme-default';
import { filterPublishable, type NoteEntry } from '../lib/viewModels.ts';
import { selectRecent, selectFeatured } from '../lib/homeRails.ts';
import obpubConfig from '../../obsidian-blog.config.ts';

const all = await getCollection('notes');
const publishable = filterPublishable(all);
const recent = selectRecent(publishable);
const featured = selectFeatured(publishable);

function toItems(entries: NoteEntry[]): NoteListEntry[] {
  return entries.map((entry) => {
    const dateRaw = entry.data.frontmatter['date'];
    const item: NoteListEntry = {
      href: `/${entry.id}/`,                          // trailingSlash always (step 6)
      title: entry.data.title ?? entry.id,
    };
    if (typeof dateRaw === 'string') item.date = dateRaw;
    return item;
  });
}

const recentItems = toItems(recent);
const featuredItems = toItems(featured);
const canonicalUrl = new URL(Astro.url.pathname, Astro.site).toString();
---

<BaseLayout
  title={obpubConfig.site.title}
  canonicalUrl={canonicalUrl}
  ogType="website"
  siteName={obpubConfig.site.title}
>
  <section aria-labelledby="recent-heading">
    <h2 id="recent-heading">Recent</h2>
    <NoteList entries={recentItems} emptyMessage="아직 공개된 글이 없습니다." />
  </section>

  {featured.length > 0 && (
    <section aria-labelledby="featured-heading">
      <h2 id="featured-heading">Featured</h2>
      <NoteList entries={featuredItems} emptyMessage="" />
    </section>
  )}
</BaseLayout>
```

핵심 규칙:
- **NoteList prop 이름**: `entries`(NOT `notes`). `emptyMessage`는 *required*. featured 분기에서는 `<section>` 자체가 미렌더이므로 emptyMessage 값은 무관(`""` 빈 문자열도 OK — `min(1)` 같은 검증은 NoteList에 없음).
- `featured.length === 0`이면 `<section>` 자체가 *미렌더*. 빈 헤딩, "No featured posts" 카피, 빈 `<ul>` 컨테이너 *모두 금지*.
- href는 trailing slash로 끝남(`/${entry.id}/`) — step 6의 `trailingSlash: 'always'` 정책과 일관.
- **사이드바 wire는 본 step에서 절대 하지 않는다** (step 8 책임). `buildSidebarPayload` import도 추가하지 않고, `<BaseLayout>`에 `sidebar` prop도 *넘기지 않는다*. step 5의 BaseLayout이 `sidebar` 옵셔널이라 미전달 시 v0.2 단일 컬럼으로 폴백 — step 7 시점에서는 사이드바 없는 홈 그대로 빌드되고, step 8에서 한 곳에 wire가 추가된다.

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
- 본 step에서 `buildSidebarPayload` import나 `<BaseLayout sidebar={...}>` 전달을 추가하지 마라. 이유: 사이드바 wire는 step 8 단일 SSOT다 — placeholder import/주석조차 두지 않는다(혼란 + 유령 의존). `index.astro`는 step 7에서 사이드바 없이, step 8에서 한 번 더 수정되어 사이드바가 들어간다.
- `<NoteList notes={...}/>`로 호출하지 마라. 이유: 컴포넌트의 prop 이름은 `entries`이고 `emptyMessage`는 required다 — 잘못 쓰면 즉시 typecheck 실패.
- 새 frontmatter 필드(`featured_priority`, `pinned` 등)를 도입하지 마라. 이유: privacy allowlist는 별도 PR/별도 step의 책임이고, 본 step은 *기존 allowlist 안의* `featured`만 사용한다.
- featured 정렬에 `date` 외 다른 키를 쓰지 마라. 이유: TODO.md 결정 사항 표상 정렬은 date desc 한 가지.
- `RECENT_RAIL_CAP`/`FEATURED_RAIL_CAP`을 매직넘버 인라인으로 박지 마라. 이유: fork 사용자 튜닝 가능 + 회귀 가드 grep.
- `index.astro` 본문에서 privacy 판정(`isPublic`)을 호출하지 마라. 이유: `filterPublishable`이 단일 SSOT.
- `packages/core/src/privacy/**`을 수정하지 마라.
