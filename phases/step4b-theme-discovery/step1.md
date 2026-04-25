# Step 1: taglist-and-tag-page (TDD)

`@obpub/theme-default`에 두 컴포넌트를 추가:

1. `TagList.astro` — 태그 인덱스 페이지(`/tags`)에서 사용. 모든 공개 태그를 chip + count로 나열.
2. `TagPage.astro` — 태그별 페이지(`/tags/<tag>`)에서 사용. 그 태그를 가진 공개 노트 목록.

두 컴포넌트 모두 view-only. 태그 blocklist 필터/공개 판정은 이미 `@obpub/core/privacy`에서 끝났다고 가정한다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/UI_GUIDE.md` — 태그 칩 토큰(`bg-zinc-100 text-zinc-600 ...`), 홈/태그 인덱스 `max-w-4xl`, h1/h2 타이포.
- `/docs/PRD.md` — 태그 인덱스/태그 페이지 UX, "private 노트 누설 금지" 원칙.
- `/docs/ARCHITECTURE.md` — 컴포넌트 view-only 계약.
- `/CLAUDE.md` — frontmatter allowlist, 태그 blocklist는 core 책임.
- `/packages/core/src/pipeline.ts` — `PipelineResult.publicTags: Map<slug, string[]>` (이미 blocklist 필터됨), `publicSlugs`, `publicFrontmatter` (allowlist 필터됨). 호출자는 이 데이터를 합쳐 ViewModel을 만든다.
- `/packages/theme-default/src/components/Note.astro` — 태그 chip 스타일과 href `/tags/${encodeURIComponent(t)}` 패턴 (TagList도 동일 href contract).
- `/packages/theme-default/src/components/Backlinks.astro` + `Backlinks.types.ts` — 직전 step에서 수립된 view-model + 빈 상태 침묵 패턴(이 step도 동일 원칙).
- `/packages/theme-default/tests/Note.test.ts` — Container API 테스트 패턴(렌더 → assert + canary 검증 + allowlist 침투 시도).
- `/packages/theme-default/src/index.ts` — re-export 위치.

## 작업

### 1. TagList Props 타입 — `packages/theme-default/src/components/TagList.types.ts`

```ts
/**
 * View-model for `<TagList />` (used on the tag index page `/tags`).
 *
 * INTENTIONALLY a STRICT SUBSET. Each `TagSummary.tag` is already
 * blocklist-filtered by `@obpub/core/privacy` (see
 * `PipelineResult.publicTags`). The component MUST NOT re-filter, normalize,
 * or look anything else up.
 *
 * `count` is the number of PUBLIC notes carrying this tag. Counts derived
 * from private notes would leak the size of the private corpus.
 */
export interface TagSummary {
  /** Tag slug as it appears on note pages (e.g. "rust", "한국어"). */
  tag: string;
  /** Number of public notes carrying this tag. Must be ≥ 1 (no zero-count entries). */
  count: number;
}

export interface TagListViewModel {
  tags: TagSummary[];
}

export interface TagListProps {
  taglist: TagListViewModel;
}
```

**중요**:
- `TagSummary`에 `slugs`, `notes`, `description` 같은 필드를 추가하지 마라. 노트 목록은 TagPage의 책임. TagList는 단순 색인.
- `count` 0인 항목을 받지 않는다 (호출자가 걸러서 넘김 — 컴포넌트는 신뢰).

### 2. TagList.astro — `packages/theme-default/src/components/TagList.astro`

```astro
---
/**
 * Tag index — view-only.
 *
 * Privacy contract: `taglist.tags` is already blocklist-filtered upstream
 * (`@obpub/core/privacy` via `publishing.tagBlocklist`). This component
 * MUST NOT re-filter or look up anything else.
 *
 * Empty state: render NOTHING when `tags` is empty. A "태그 없음" placeholder
 * could suggest that hidden tags exist; silence is the safe default.
 */
import type { TagListProps } from "./TagList.types";
const { taglist } = Astro.props as TagListProps;
---
{taglist.tags.length > 0 && (
  <section aria-label="태그 목록" class="space-y-4">
    <h1 class="text-3xl font-semibold text-zinc-950 tracking-tight">태그</h1>
    <ul class="flex flex-wrap gap-2">
      {taglist.tags.map((t) => (
        <li>
          <a
            href={`/tags/${encodeURIComponent(t.tag)}`}
            class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          >#{t.tag} <span class="ml-1 text-zinc-400">{t.count}</span></a>
        </li>
      ))}
    </ul>
  </section>
)}
```

요구사항:
- 빈 tags → DOM에 `<section>`/`<h1>`/`<ul>` 어떤 것도 출력하지 마라.
- 링크 href는 `/tags/${encodeURIComponent(tag)}`. Note.astro의 태그 chip href와 정확히 동일한 contract.
- 태그 chip 스타일은 UI_GUIDE의 토큰만 사용 (`bg-zinc-100 text-zinc-600 hover:bg-zinc-200` + `text-xs px-2 py-0.5 rounded`).
- count는 chip 안에 작은 숫자로 표기 (`<span class="ml-1 text-zinc-400">…</span>`).
- `set:html` 사용 금지.
- `TagSummary`에 선언되지 않은 필드를 출력하지 마라.

### 3. TagPage Props 타입 — `packages/theme-default/src/components/TagPage.types.ts`

```ts
/**
 * View-model for `<TagPage />` (used on `/tags/<tag>`).
 *
 * INTENTIONALLY a STRICT SUBSET. `entries[i].slug` is a PUBLIC slug
 * (verified upstream via `PipelineResult.publicSlugs`); `title`/`date` come
 * from allowlist-filtered frontmatter. Adding fields without first widening
 * the allowlist in CLAUDE.md is forbidden — this type IS the contract.
 */
export interface TagPageEntry {
  /** Public slug. The component emits a link to `/<slug>`. */
  slug: string;
  /** Public display title (allowlist-respecting). */
  title: string;
  /** ISO 8601 date string (e.g. "2026-01-10"). */
  date?: string;
}

export interface TagPageViewModel {
  /** The tag this page is for. Already blocklist-filtered upstream. */
  tag: string;
  /** Public notes carrying this tag, in caller-defined order (typically date desc). */
  entries: TagPageEntry[];
}

export interface TagPageProps {
  tagpage: TagPageViewModel;
}
```

### 4. TagPage.astro — `packages/theme-default/src/components/TagPage.astro`

```astro
---
/**
 * Per-tag listing page — view-only.
 *
 * Privacy contract: `tag` is already blocklist-filtered, and `entries[].slug`
 * is guaranteed PUBLIC by the caller (built from `PipelineResult.publicSlugs`).
 *
 * Empty state for `entries`: render `<h1>` with the tag and an explicit
 * "이 태그를 가진 공개 노트가 없습니다" message. Unlike Backlinks/TagList,
 * this page IS routed by the user (they typed `/tags/<tag>`), so the page's
 * existence is already known. We MUST NOT redirect or 404 (that would imply
 * the tag exists privately). Showing an empty list is fine.
 */
import type { TagPageProps } from "./TagPage.types";
const { tagpage } = Astro.props as TagPageProps;
---
<section class="space-y-4">
  <h1 class="text-3xl font-semibold text-zinc-950 tracking-tight">#{tagpage.tag}</h1>
  {tagpage.entries.length > 0 ? (
    <ul class="space-y-2">
      {tagpage.entries.map((e) => (
        <li>
          <a
            href={`/${e.slug}`}
            class="text-blue-600 hover:text-blue-700 underline decoration-1 underline-offset-2"
          >{e.title}</a>
          {e.date && <span class="ml-2 text-sm text-zinc-500">{e.date}</span>}
        </li>
      ))}
    </ul>
  ) : (
    <p class="text-zinc-600">이 태그를 가진 공개 노트가 없습니다.</p>
  )}
</section>
```

요구사항:
- `<h1>`에 태그명을 정확히 1회 출력 (`#{tagpage.tag}`). 누설 금지 단어를 별도로 검사할 필요는 없으나 `tagpage.tag` 외 어떤 필드도 `<h1>`에 들어가면 안 됨.
- entries 비어있을 때 정확히 1개의 `<p>`로 안내. 404로 가지 마라 (사용자가 명시적으로 요청한 페이지).
- 노트 링크 href는 정확히 `/<slug>`. trailing slash 없음.
- `date`가 있는 entry만 `<span>`으로 표시. 없으면 `<span>` 자체를 출력하지 마라.
- `set:html` 사용 금지.

### 5. Re-export 추가 — `packages/theme-default/src/index.ts`

기존 export(BaseLayout, Note, NotFound, Backlinks)에 다음을 **추가**:

```ts
export { default as TagList } from "./components/TagList.astro";
export type { TagListProps, TagListViewModel, TagSummary } from "./components/TagList.types";
export { default as TagPage } from "./components/TagPage.astro";
export type { TagPageProps, TagPageViewModel, TagPageEntry } from "./components/TagPage.types";
```

### 6. 실패 테스트 먼저 — TagList

`packages/theme-default/tests/TagList.test.ts`. Container API로 렌더. 다음 6개 assert (최소):

1. **빈 상태 0 출력**: `tags: []` → `<section`, `<h1`, `<ul`, `태그` 텍스트 모두 0회.
2. **n 태그 → n 링크**: `tags:[{tag:'rust',count:3},{tag:'한국어',count:1}]` → `<a href="/tags/rust">` 1회, `<a href="/tags/%ED%95%9C%EA%B5%AD%EC%96%B4">` 1회 (encodeURIComponent 적용 검증). `/tag/rust` 같은 오타 0회.
3. **count 표시**: 위 입력에서 chip 안에 `3`, `1` 각각 1회 등장. count 0인 entry는 호출 계약상 들어오지 않으므로 별도 처리 안 함.
4. **헤딩 1개**: 비어있지 않을 때 `<h1` 1회. 비어있을 때 0회.
5. **allowlist 강제**: 추가 키 시도:
   ```ts
   const sneaky = {
     tags: [{
       tag: 'visible',
       count: 1,
       slugs: ['DO_NOT_LEAK_BANANA_6f3c1'],
       description: 'PRIVATE_FIELD_PROBE_xyz',
     }],
   } as unknown as TagListViewModel;
   ```
   → `DO_NOT_LEAK_BANANA_6f3c1`, `PRIVATE_FIELD_PROBE_xyz`, `slugs`, `description` 모두 0회. `visible`은 chip 텍스트로 1회.
6. **태그명 escape**: `tag: '<script>alert(1)</script>'` → `<script>` 태그 0개 (escape됨). href 안에서도 encodeURIComponent로 `%3Cscript%3E…`로 변환되어야 함.

### 7. 실패 테스트 먼저 — TagPage

`packages/theme-default/tests/TagPage.test.ts`. 다음 6개 assert (최소):

1. **`<h1>`이 태그명을 echo**: `tagpage:{tag:'rust', entries:[]}` → `<h1>` 안에 `#rust` 정확히 1회.
2. **빈 entries → 안내 문구 1개**: 위 입력에서 `<p>` 안에 "이 태그를 가진 공개 노트가 없습니다." 정확히 1회. `<ul>`/`<a>` 0회.
3. **n entries → n 링크**: `entries:[{slug:'a',title:'A'},{slug:'b',title:'B',date:'2026-01-10'}]` → `<a href="/a">A</a>` 1회, `<a href="/b">B</a>` 1회. `/a/`, `/b/` (trailing slash) 0회.
4. **date 있을 때만 `<span>`**: 위 입력에서 `<span` 정확히 1회 + `2026-01-10` 1회.
5. **allowlist 강제**: entry 추가 키 시도:
   ```ts
   const sneaky = {
     tag: 'rust',
     entries: [{
       slug: 'visible',
       title: 'Visible',
       body: 'DO_NOT_LEAK_BANANA_6f3c1',
       frontmatter: { secret: 'PRIVATE_FIELD_PROBE_xyz' },
     }],
   } as unknown as TagPageViewModel;
   ```
   → `DO_NOT_LEAK_BANANA_6f3c1`, `PRIVATE_FIELD_PROBE_xyz`, `body`, `frontmatter` 모두 0회. `Visible`, `/visible` 1회.
6. **title escape**: `title: '<img src=x onerror=alert(1)>'` → `<img` 0회 (escape됨).

각 assert 작성 직후 `pnpm test`로 실패를 먼저 확인하고 컴포넌트를 만든다.

테스트 파일 헤더에는 각 assert가 어떤 회귀를 막는지 한 줄 주석을 넣는다(Note.test.ts 톤).

### 8. Mutation check (자가 검증)

다음 변형 중 **적어도 4개**를 임시 적용했을 때 위 assert가 반드시 실패해야 한다 (확인 후 원복):

- A. TagList에서 빈 tags일 때 `<section>태그 없음</section>`을 출력 → TagList assert 1 실패.
- B. TagList href를 `/tag/${t.tag}`로 오타 → TagList assert 2 실패.
- C. TagPage에서 빈 entries일 때 `astro:404` 또는 `throw` → assert 2 실패 + 페이지가 200으로 떠야 한다는 contract 위반.
- D. TagPage에서 `<a href={'/'+e.slug+'/'}>`로 trailing slash 추가 → assert 3 실패.
- E. TagList에서 `<a href={`/tags/${t.tag}`}>` (encodeURIComponent 누락) → assert 2 (한국어 태그) 실패.
- F. TagList chip에서 `set:html={t.tag}` 사용 → assert 6 (escape) 실패.

phase 요약에 "mutation check: <목록> 실패 재현 OK"를 기록.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

- TagList 6개 + TagPage 6개 = 12개 신규 테스트 전원 통과.
- 기존 core / astro-integration / theme-default 테스트 회귀 없음 (직전 step의 Backlinks 6개 포함).

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `set:html`이 사용된 곳이 있는가? (있으면 안 됨.)
   - `TagSummary`/`TagPageEntry`가 frontmatter allowlist 부분집합인가? (e.g. `slugs`/`body`/`frontmatter` 미포함.)
   - 태그 href가 Note.astro와 동일하게 `/tags/${encodeURIComponent(tag)}`인가?
   - 노트 링크 href가 `/<slug>` (trailing slash 없음)인가?
   - TagPage 빈 entries에서 404/redirect로 가지 않는가?
   - `packages/core/src/privacy/`를 건드리지 않았는가?
   - UI_GUIDE 금지 패턴(gradient/blur/shadow glow) 사용했는가? 사용했다면 제거.
3. 결과에 따라 `phases/step4b-theme-discovery/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "TagList + TagPage + 4 view-model files + 12 Container-API tests + empty-state silence (TagList) / 안내문구 (TagPage) + allowlist 강제; mutation check: <목록> 실패 재현 OK"`.
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단.

## 금지사항

- `set:html`을 어떤 필드에도 쓰지 마라. 이유: 태그명/제목은 텍스트로만 흘러야 하고, raw HTML 주입 경로를 만들 이유가 없음.
- TagList에서 빈 tags일 때 placeholder/안내 문구를 출력하지 마라. 이유: `/tags` 경로 자체는 사이트 메뉴에서만 노출되며, 빈 화면은 아예 페이지로 안 만드는 게 호출자 책임이 되도록 컴포넌트는 침묵.
- TagPage에서 빈 entries일 때 404/redirect로 가지 마라. 이유: 사용자가 직접 `/tags/<tag>` URL을 요청한 상태이므로 페이지 자체는 정상 응답해야 하고(blocklist 필터로 0개가 된 경우 등), 404로 응답하면 "이 태그가 비공개로 존재한다"를 누설할 수 있음.
- `TagSummary`에 `slugs` 필드를 두지 마라. 이유: 태그 인덱스가 노트 슬러그를 직접 들고 있으면 누설 표면이 커지고, TagPage 책임과 중복.
- 컴포넌트 안에서 tagBlocklist 재적용/`isPublic` 재판정/노트 메타 lookup을 하지 마라. 이유: 결정은 `packages/core/src/privacy/` 한 곳.
- `packages/core/`/`packages/astro-integration/`을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
