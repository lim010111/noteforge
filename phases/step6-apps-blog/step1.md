# Step 1: blog-routes-home-and-note

홈 / 개별 노트 / 404 라우트만 구현한다. 그래프와 태그 라우트는 step 2의 책임. Astro Content Layer의 `notes` collection을 사용하고, theme-default의 `BaseLayout`/`Note`/`Backlinks`/`NotFound`를 그대로 import한다. 컴포넌트의 view-model 타입이 frontmatter allowlist의 strict subset이므로 라우트는 명시적인 변환 함수를 통과시켜야 한다 — raw frontmatter를 컴포넌트에 흘리면 타입 에러가 난다(allowlist 강제의 컴파일러 가드).

이 step의 가장 큰 검증은 **`pnpm --filter blog build`가 0-public 시나리오에서도 성공**하는 것이다. 사용자 vault에 `public: true` / `#public` 노트가 0개일 가능성이 높으므로 빈 컬렉션 상태에서 home이 친절히 렌더되는지가 핵심.

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — Phase D audit, 데이터 흐름.
- `/docs/PRD.md` — Reader UX (홈 타임라인, 404 누설 금지 문구).
- `/docs/UI_GUIDE.md` — `max-w-3xl`, line-height 1.7, 측정폭 65ch, 색상 토큰.
- `/CLAUDE.md` — CRITICAL: allowlist, tripwire, transclusion, comment strip.
- step 0 산출물:
  - `apps/blog/astro.config.mjs`
  - `apps/blog/obsidian-blog.config.ts`
  - `apps/blog/src/content.config.ts`
  - `apps/blog/src/styles/global.css`
- `/packages/theme-default/src/index.ts` — export 목록.
- `/packages/theme-default/src/layouts/BaseLayout.astro` + `BaseLayout.types.ts` — `BaseLayoutProps` 시그니처.
- `/packages/theme-default/src/components/Note.astro` + `Note.types.ts` — `NoteViewModel` 시그니처(allowlist subset).
- `/packages/theme-default/src/components/Backlinks.astro` + `Backlinks.types.ts` — `BacklinksProps` 시그니처. 백링크 entry에 어떤 필드가 필요한지.
- `/packages/theme-default/src/components/NotFound.astro` — 누설 금지 문구.
- `/packages/astro-integration/src/loader.ts` — `ObpubEntry` 형태(특히 `data.frontmatter`/`data.tags`/`data.backlinks` 와 `rendered.html`).

## 작업

### 1. 디렉토리 구조 (이 step 종료 시점)

```
apps/blog/
└── src/
    ├── pages/
    │   ├── index.astro           # NEW — date 역순 타임라인 + 0-public 플레이스홀더
    │   ├── [...slug].astro       # NEW — 단일 노트
    │   └── 404.astro             # NEW — NotFound 컴포넌트
    ├── lib/
    │   └── viewModels.ts         # NEW — entry → NoteViewModel 변환 (단위 테스트 가능)
    └── styles/global.css
```

`apps/blog/src/lib/viewModels.ts`는 라우트가 공유하는 변환 함수를 모아둔다. **순수 함수로만 작성**해 vitest가 import 가능해야 한다.

### 2. view-model 변환 — 핵심 안전 장치

`apps/blog/src/lib/viewModels.ts`:

```ts
import type { CollectionEntry } from 'astro:content';
import type { NoteViewModel } from '@obpub/theme-default';

type NotesEntry = CollectionEntry<'notes'>;

/**
 * Content Layer entry → Note 컴포넌트가 받는 view-model.
 *
 * - frontmatter는 이미 core/privacy/frontmatterFilter에서 allowlist 적용 완료.
 *   그러나 theme의 NoteViewModel은 allowlist의 *strict subset*만 받는다 → 추가 필드는 무시.
 * - title 결정 우선순위: frontmatter.title > slug 마지막 segment.
 * - date/updated/description은 frontmatter에 있을 때만 setter (undefined로 두면 컴포넌트가 자체 처리).
 * - tags는 collection 데이터 그대로 (tagBlocklist 적용은 core가 이미 처리).
 */
export function entryToNoteViewModel(entry: NotesEntry): NoteViewModel;

/**
 * home 정렬: featured 우선, 그 다음 date 역순, 동률은 slug ASC.
 */
export function sortForHome(entries: readonly NotesEntry[]): NotesEntry[];

/**
 * draft 필터: frontmatter.draft === true 인 entry 제거.
 */
export function filterPublishable(entries: readonly NotesEntry[]): NotesEntry[];
```

각 함수에 대한 vitest 단위 테스트 (`apps/blog/tests/viewModels.test.ts`) 6 케이스 이상:

1. `entryToNoteViewModel`: title 있을 때 그대로.
2. `entryToNoteViewModel`: title 없을 때 slug 마지막 segment.
3. `entryToNoteViewModel`: allowlist 외 frontmatter 키가 view-model에 새지 않음 (타입 + 런타임 검증).
4. `sortForHome`: featured 1개 + 일반 2개 → featured가 맨 앞.
5. `sortForHome`: 같은 date에서 slug ASC.
6. `filterPublishable`: `draft: true` 제거, 그 외 통과.

vitest config에 apps/blog 포함되도록 루트 vitest.config을 확인 (이미 `apps/*` 패턴이 있으면 자동, 없으면 보강).

### 3. `apps/blog/src/pages/index.astro`

```astro
---
import { getCollection } from 'astro:content';
import { BaseLayout } from '@obpub/theme-default';
import { sortForHome, filterPublishable } from '../lib/viewModels.ts';
import '../styles/global.css';

const all = await getCollection('notes');
const publishable = filterPublishable(all);
const sorted = sortForHome(publishable);
---
<BaseLayout title="홈">
  {sorted.length === 0 ? (
    <p class="empty">아직 공개된 글이 없습니다.</p>
  ) : (
    <ul class="timeline">
      {sorted.map((entry) => (
        <li>
          <a href={`/${entry.id}`}>{entry.data.title ?? entry.id}</a>
          {entry.data.frontmatter.date ? (
            <time>{String(entry.data.frontmatter.date)}</time>
          ) : null}
        </li>
      ))}
    </ul>
  )}
</BaseLayout>
```

allowlist 위반 검사: `entry.data.frontmatter`는 strict object지만 화면에 출력하는 필드는 `title`/`date`만. `description` 등을 추가하더라도 allowlist 안의 필드여야 한다.

### 4. `apps/blog/src/pages/[...slug].astro`

```astro
---
import type { GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { BaseLayout, Note, Backlinks } from '@obpub/theme-default';
import { entryToNoteViewModel, filterPublishable } from '../lib/viewModels.ts';
import '../styles/global.css';

export const getStaticPaths: GetStaticPaths = async () => {
  const all = await getCollection('notes');
  const publishable = filterPublishable(all);
  return publishable.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
};

const { entry } = Astro.props;
const note = entryToNoteViewModel(entry);

// rendered.html은 loader가 사전에 sanitize 완료 — set:html 안전.
// backlinks: data.backlinks는 slug 배열. 같은 컬렉션에서 title 보강.
const all = await getCollection('notes');
const titleBySlug = new Map(all.map((e) => [e.id, e.data.title ?? e.id]));
const backlinks = entry.data.backlinks.map((slug) => ({
  slug,
  title: titleBySlug.get(slug) ?? slug,
  href: `/${slug}`,
}));
---
<BaseLayout title={note.title} description={note.description}>
  <Note note={note}>
    <div set:html={entry.rendered.html} />
  </Note>
  {backlinks.length > 0 ? <Backlinks backlinks={backlinks} /> : null}
</BaseLayout>
```

`Backlinks.types.ts`의 정확한 prop 형태를 보고 위 backlinks 구조를 맞춰라(필드명이 다르면 거기 맞춤). 프롭 변환은 같은 viewModels.ts에 작은 헬퍼로 옮겨도 좋다.

`Astro.props`의 type 안전성: `defineCollection`이 부여한 `CollectionEntry<'notes'>`가 `entry.rendered.html`을 노출하는지 확인. (loader가 `rendered: { html, metadata }`를 set하므로 노출돼야 정상.) 만약 Astro 5 Content Layer가 `rendered`를 별도 메서드(`render()`)로만 노출한다면 그 패턴으로 전환.

### 5. `apps/blog/src/pages/404.astro`

```astro
---
import { BaseLayout, NotFound } from '@obpub/theme-default';
import '../styles/global.css';
---
<BaseLayout title="찾을 수 없습니다">
  <NotFound />
</BaseLayout>
```

NotFound 컴포넌트의 문구가 "비공개입니다 / 존재하지 않습니다"를 구분하지 않고 통합 표현인지 확인 (구분하면 private 노트의 존재 자체가 누설된다 — Plan UX 명시).

### 6. nav 처리

이 step에서 BaseLayout이 자체 nav를 그린다면 그래프/태그 링크는 **표시하지 않거나** 라우트 부재 상태에서 깨지지 않도록 한다 (theme의 BaseLayout이 nav를 받는 props를 노출하는지 확인). step 2에서 그래프/태그 라우트가 생기면 nav 링크를 활성화한다. nav 디자인 변경은 이 step 범위 외.

### 7. tagBlocklist 처리

view-model에서 추가 필터링 금지 — `core/privacy/frontmatterFilter` + `tags.ts`에서 이미 적용됐다. apps/blog가 다시 거르면 결정이 두 곳으로 갈라진다 (CLAUDE.md CRITICAL 위반). raw frontmatter의 `tags`는 collection schema가 받지만 **사용**할 때는 `entry.data.tags` (이미 필터된 결과)만 본다.

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog exec astro sync
pnpm --filter blog build
```

전부 0 exit. 0-public 시나리오(현재 사용자 vault)에서도 build가 성공해야 한다 — index.html에는 "아직 공개된 글이 없습니다" 플레이스홀더가 들어간다.

view-model 단위 테스트 6 케이스 이상 신규 통과.

## 검증 절차

1. AC 커맨드 실행.
2. `apps/blog/dist/index.html`을 열어 다음 확인:
   - 0-public이면 "아직 공개된 글이 없습니다" 텍스트 존재.
   - frontmatter allowlist 외 키가 HTML에 등장하지 않는지 grep.
   - `%%` 패턴이 0회 등장.
3. `apps/blog/dist/404.html`이 생성됐고 NotFound 문구 포함.
4. 아키텍처 체크리스트:
   - viewModels.ts가 공개/비공개 판정을 다시 하지 **않는가**? (오직 frontmatter.draft 필터만)
   - raw `entry.data.frontmatter`를 컴포넌트 prop에 그대로 흘리지 않는가?
   - 백링크가 별도 fetch가 아닌 collection 자체에서 도출되는가? (loader가 미리 계산해 둠)
5. 결과에 따라 `phases/step6-apps-blog/index.json`의 step 1을 업데이트.

## 금지사항

- **라우트에서 `runCorePipeline`을 직접 호출하지 마라.** 이유: collection이 곧 결과. 직접 호출은 step 2의 graph endpoint에서 memoize 패턴과 함께 도입한다.
- **`isPublic` / 태그 / tripwire 판정을 다시 구현하지 마라.** 이유: CLAUDE.md CRITICAL — 결정은 한 곳(core/privacy).
- **raw frontmatter를 컴포넌트 props로 통째 넘기지 마라.** 이유: theme의 `NoteViewModel`/`BaseLayoutProps`는 allowlist의 strict subset이라는 컴파일러 가드를 우회한다.
- **404 페이지에서 "이 노트는 비공개입니다"처럼 사유를 구분하지 마라.** 이유: private 노트의 *존재*를 누설한다.
- **그래프 / 태그 라우트를 만들지 마라.** step 2의 책임.
- **`getCollection`을 단일 모듈에서 두 번 호출하지 마라(같은 라우트 내에서).** 이유: 빌드 시간이 비례 증가. 변환에 필요한 데이터(예: title 보강)는 한 번 호출 후 메모리에서 처리.
- **기존 테스트를 깨뜨리지 마라.** 특히 vault-mixed canary, watcher 통합 테스트.
