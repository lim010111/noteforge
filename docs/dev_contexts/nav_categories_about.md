# Top nav 교체 + Categories / About 구현

## Context

현재 `BaseLayout.astro` 상단 메뉴는 `notes / tags / graph` 세 개가 하드코딩되어 있다. 사용자는 이를 일반 블로그 컨벤션에 맞춰 **`Home / Categories / About`** 으로 바꾸고, 각 메뉴를 동작하는 페이지로 구현하길 원한다.

- **Home** = 이미 존재하는 `apps/blog/src/pages/index.astro` (Recent + Featured 레일). 페이지 자체는 손대지 않음.
- **Categories** = 모든 공개 노트를 카테고리(=vault 최상위 폴더)별로 한 페이지에서 훑어볼 수 있는 새 페이지. 사이드바 `FolderTree` 가 이미 `<h2>Categories</h2>` 로 라벨링 중이므로 의미·용어가 일치.
- **About** = 블로거의 자기소개 페이지. 본 프로젝트는 정적 사이트 생성기이고 "설정 페이지"의 실체는 `apps/blog/obsidian-blog.config.ts` 이다 (`site.social.github`, `site.social.email` 이 거기 산다). **별도의 런타임 설정 UI 라우트는 만들지 않는다** — About 컨텐츠도 동일하게 이 config 파일에서 관리한다.

## 사용자 결정 사항 (확정)

1. **About 컨텐츠 소스**: `obsidian-blog.config.ts` (= 기존 github/email 와 동일한 설정 자리). 별도 설정 UI 페이지 없음.
2. **기존 `/tags`, `/graph` 라우트**: 페이지·기능은 유지, 상단 메뉴에서만 제거. 노트 본문의 태그 칩은 그대로 `/tags/[tag]` 로 동작.
3. **Categories 레이아웃**: flat — 최상위 폴더가 H2 섹션, 그 폴더의 모든 descendant 노트를 평탄화해서 그 아래 한 리스트로 표시. vault 루트 노트는 `Uncategorized` 섹션으로.

## 보조 결정 (계획자 판단)

- **Nav 텍스트**: 영문 (`Home / Categories / About`). 사용자 요청문이 영문이고 사이드바·footer 영문 카피와 일치.
- **사이드바 표시**:
  - `/categories`: **표시함**. 사이드바는 폴더 네비게이션, 페이지는 카테고리 개요 — 역할이 다름.
  - `/about`: **표시함**. 다른 페이지와 레이아웃 일관성 유지.
- **카테고리 섹션 정렬**: 알파벳(case-insensitive). `Uncategorized` 는 항상 맨 끝.
- **카테고리 내 노트 정렬**: date desc → slug asc (기존 `tagAggregation.entriesForTag` 와 동일 규칙).
- **About 스키마**: 마크다운 파서 도입하지 않고 **구조화 필드** (`headline`, `bio[]`, `highlights[]`). 표현력 부족 시 후속 PR에서 markdown 옵션 추가.
- **OG/canonical 메타데이터**: 두 새 페이지 모두 `index.astro` 와 동일 패턴 — `canonicalUrl`, `ogType="website"`, `siteName: obpubConfig.site.title`.

## 변경 파일 (확정)

**Edit:**
- `packages/theme-default/src/layouts/BaseLayout.astro` — nav `<li>` 3개 교체 (lines 51–53 desktop, 81–83 mobile drawer).
- `packages/core/src/config.ts` — `siteSchema` 안에 `about` 필드(=`aboutSchema`) 추가.
- `packages/core/tests/config.test.ts` — `describe('site.about (v0.4)', …)` 블록 추가 (기존 `site.avatar`, `site.social` describe와 동일 패턴).
- `packages/theme-default/src/index.ts` — 새 컴포넌트 두 개 배럴 export.

**Create:**
- `apps/blog/src/pages/categories.astro` — Categories 페이지.
- `apps/blog/src/pages/about.astro` — About 페이지.
- `apps/blog/src/lib/categoryOverviewPayload.ts` — 순수 함수 `buildCategoryOverviewSections(root: FolderNode): CategorySection[]`.
- `apps/blog/tests/categoryOverviewPayload.test.ts` — 위 함수 단위 테스트.
- `packages/theme-default/src/components/CategoryOverview.astro` — 섹션 리스트 렌더 컴포넌트 (순수 렌더, privacy 책임은 caller).
- `packages/theme-default/src/components/CategoryOverview.types.ts` — props/section 타입.
- `packages/theme-default/src/components/AboutPage.astro` — Identity + Headline + Social + Bio + Highlights 렌더.
- `packages/theme-default/src/components/AboutPage.types.ts` — props 타입.
- `docs/dev_contexts/nav_categories_about.md` — **이 계획 문서 자체** (사용자 요청).

**No-op (재사용):**
- `apps/blog/src/lib/folderAggregation.ts` — `buildFolderTree` 그대로 호출.
- `apps/blog/src/lib/viewModels.ts` — `filterPublishable`, `ensureTrailingSlash`.
- `apps/blog/src/lib/sidebarPayload.ts` — `buildSidebarPayload`.
- 기존 컴포넌트: `BaseLayout`, `Sidebar`, `AvatarBlock`, `SocialLinks`.

**손대지 않음:**
- `apps/blog/obsidian-blog.config.ts` — 사용자가 직접 `site.about` 채우면 됨. 빈 상태에서도 About 페이지가 의미 있게 렌더되는지 PR에서 검증.
- `apps/blog/src/pages/{tags/*, graph.astro, [...slug].astro, index.astro, 404.astro}` — 라우트·기능 유지.

## 1. Nav 교체 (`BaseLayout.astro`)

`:49–55` (desktop `<nav class="site-nav">`) 와 `:79–85` (mobile drawer `<nav class="mobile-menu__nav">`) 의 `<ul>` 내부 `<li>` 3개를 다음으로 교체:

```html
<li><a href="/">Home</a></li>
<li><a href="/categories">Categories</a></li>
<li><a href="/about">About</a></li>
```

- Brand 링크 (`<a class="brand" href="/">noteforge</a>`, line 48) 는 유지. 로고 + Home nav 둘 다 `/` 로 가는 건 일반 컨벤션.
- aria-label 유지.
- 카피 외 마크업/스타일 클래스 변경 없음 → CSS 작업 0.

> Caveat (out of scope): brand 텍스트 `"noteforge"` 가 하드코딩되어 있음. 실제 `site.title` 은 `"shine notes"`. 별도 PR에서 `obpubConfig.site.title` 을 흘리는 방식으로 수정 권장.

## 2. Categories 페이지

### Pure helper — `apps/blog/src/lib/categoryOverviewPayload.ts`

```ts
export interface CategoryNote { href: string; title: string; date?: string; }
export interface CategorySection {
  name: string;     // 폴더명 또는 'Uncategorized'
  href?: string;    // 폴더 인덱스로 deep-link 시 정의, Uncategorized면 undefined
  notes: CategoryNote[];
}

export function buildCategoryOverviewSections(
  root: FolderNode,
): CategorySection[];
```

동작:
- 루트의 각 직계 child → 섹션 1개 (`name = child.name`, `href = '/' + child.path + '/'`).
- 그 child의 descendant 노트들을 모두 모아 평탄화. 정렬: date desc → slug asc.
- 루트의 `notes[]` 가 있으면 마지막에 `name: 'Uncategorized', href: undefined` 섹션으로 push.
- 모든 섹션의 `notes[]` 가 비어 있으면 빈 배열 반환 (caller가 emptyMessage 처리).

날짜 추출: `entry.data.frontmatter['date']` 가 string 일 때만 사용 (기존 `homeRails`, `tagAggregation` 패턴 따름).

### 컴포넌트 — `CategoryOverview.astro`

Props: `{ sections: CategorySection[]; emptyMessage?: string }`.

```astro
{sections.length === 0 ? <p class="empty">{emptyMessage}</p>
  : sections.map(s => (
    <section class="category-section" aria-labelledby={`cat-${s.name}`}>
      <h2 id={`cat-${s.name}`}>
        {s.href ? <a href={s.href}>{s.name}</a> : s.name}
      </h2>
      <ul role="list">
        {s.notes.map(n => (
          <li>
            <a href={n.href}>{n.title}</a>
            {n.date && <time datetime={n.date}>{n.date}</time>}
          </li>
        ))}
      </ul>
    </section>
  ))}
```

스타일은 `NoteList` 와 시각적 일관성 (간격/typography 토큰 재사용). 컴포넌트 자체 CSS 는 minimal — 기존 `components.css` 스타일을 그대로 받아씀.

### 페이지 — `apps/blog/src/pages/categories.astro`

```ts
const all = await getCollection('notes');
const publishable = filterPublishable(all);
const tree = buildFolderTree(publishable);
const sections = buildCategoryOverviewSections(tree);
const sidebar = buildSidebarPayload(all);
const canonicalUrl = ensureTrailingSlash(new URL(Astro.url.pathname, Astro.site).toString());
```

```astro
<BaseLayout
  title="Categories"
  canonicalUrl={canonicalUrl}
  ogType="website"
  siteName={obpubConfig.site.title}
  sidebar={sidebar}
  social={obpubConfig.site.social}
>
  <CategoryOverview sections={sections} emptyMessage="아직 공개된 글이 없습니다." />
</BaseLayout>
```

## 3. About 페이지

### Config 스키마 확장 (`packages/core/src/config.ts`)

```ts
const aboutSchema = z.object({
  headline: z.string().min(1, '빈 문자열은 허용되지 않습니다').optional(),
  bio: z.array(z.string().min(1, '빈 문자열은 허용되지 않습니다')).default([]),
  highlights: z.array(z.string().min(1, '빈 문자열은 허용되지 않습니다')).default([]),
}).optional();

// siteSchema 안에 추가:
about: aboutSchema,
```

기본값: `about` 미지정 시 `undefined`. 명시했지만 sub-field 빈 배열이면 `bio: [], highlights: []` 로 normalize.

### 컴포넌트 — `AboutPage.astro`

Props (`AboutPage.types.ts`):
```ts
export interface AboutIdentity {
  author: string;
  nickname?: string;
  avatar?: string;
  social?: { github?: string; email?: string };
}
export interface AboutContent {
  headline?: string;
  bio: readonly string[];
  highlights: readonly string[];
}
export interface AboutPageProps {
  identity: AboutIdentity;
  about?: AboutContent;
}
```

렌더 순서:
1. `<AvatarBlock avatar={identity.avatar} nickname={identity.nickname} author={identity.author} />` (기존 컴포넌트 재사용).
2. `about?.headline` 있으면 `<p class="about-headline">`.
3. `<SocialLinks {...(identity.social ?? {})} />` — 둘 다 없으면 컴포넌트가 자체적으로 빈 렌더.
4. `about?.bio` 의 각 string 을 `<p>` 로.
5. `about?.highlights` 비어있지 않으면 `<ul role="list">` + `<li>` 로.

`about` 자체가 `undefined` 거나 모든 sub-field 가 비어 있으면 → identity + social 만 렌더. 페이지가 의미 있게 표시됨.

### 페이지 — `apps/blog/src/pages/about.astro`

```ts
const identity: AboutIdentity = {
  author: obpubConfig.site.author,
  nickname: obpubConfig.site.nickname,
  avatar: obpubConfig.site.avatar,
  social: obpubConfig.site.social,
};
const sidebar = buildSidebarPayload(await getCollection('notes'));
const canonicalUrl = ensureTrailingSlash(new URL(Astro.url.pathname, Astro.site).toString());
```

```astro
<BaseLayout
  title="About"
  canonicalUrl={canonicalUrl}
  ogType="profile"
  siteName={obpubConfig.site.title}
  sidebar={sidebar}
  social={obpubConfig.site.social}
>
  <AboutPage identity={identity} about={obpubConfig.site.about} />
</BaseLayout>
```

> `ogType="profile"` 은 OpenGraph profile object 표준. About 페이지 의미 정확.

### "설정 페이지" 명확화

정적 사이트 생성기에는 런타임 admin UI 가 없다. 블로거의 설정 surface 는 `apps/blog/obsidian-blog.config.ts` 한 파일.

About 추가 후 사용자가 다음과 같이 채울 수 있다 (예시 — PR 설명에 포함):

```ts
defineConfig({
  site: {
    title: 'shine notes',
    url: 'https://noteforge.pages.dev',
    author: 'shine',
    nickname: 'Shine',
    avatar: 'avatar.png',
    social: { github: 'https://github.com/lim010111', email: 'me@example.com' },
    about: {
      headline: 'Frontend engineer · curious generalist',
      bio: [
        '서울에서 일하는 개발자입니다.',
        'React/Astro 와 Obsidian 을 즐겨 씁니다.',
      ],
      highlights: ['TypeScript', 'Astro', 'Obsidian'],
    },
  },
  // ...
});
```

`/settings` 라우트 같은 별도 페이지는 만들지 않는다.

## 4. Privacy

- **Categories**: `filterPublishable` 통과 후에만 `buildFolderTree` → `buildCategoryOverviewSections` 로 흐른다. private 노트 노출 경로 없음. canary 부재 검증은 build artefact grep.
- **About**: vault 노트를 읽지 않음 (config 기반). frontmatter 누출 경로 자체 없음. canary grep 은 회귀 가드용.

## 5. 테스트 전략

> 발견: `packages/theme-default/tests/components/` 디렉토리 부재 — 테마 컴포넌트 단위 테스트 인프라 없음. 강제 도입은 본 PR 범위 초과. 따라서 테스트는 **lib 순수 함수** + **schema** + **build-time canary grep** 으로 한정.

작성 순서 (TDD):

1. **`packages/core/tests/config.test.ts`** — `describe('site.about (v0.4)', …)` 추가:
   - `accepts site without about (entirely optional)` → `cfg.site.about === undefined`.
   - `accepts about with all fields populated` → `headline / bio[2] / highlights[3]` round-trip.
   - `defaults bio and highlights to empty arrays when about is partial` → `{ headline: 'x' }` → `bio: [], highlights: []`.
   - `rejects empty headline string` → throw `ObpubConfigError`.
   - `rejects empty string in bio array` → throw.
   - `rejects empty string in highlights array` → throw.
2. **`apps/blog/tests/categoryOverviewPayload.test.ts`** — `buildCategoryOverviewSections`:
   - 빈 트리 → 빈 배열.
   - 최상위 폴더 1개 + 노트 N → 섹션 1개, 노트 평탄화.
   - 중첩 폴더 (A/B/C) → 최상위 A 섹션 안에 B/C descendants 평탄화.
   - 루트 직속 노트 존재 → `Uncategorized` 섹션 마지막.
   - 노트 정렬 (date desc → slug asc) 검증.
3. **빌드 + canary grep** (수동 + CI):
   - `pnpm --filter blog build`.
   - `grep -r "FOLDER_TREE_DO_NOT_LEAK_8a4f2" apps/blog/dist` → 0건.
   - `grep -r "DO_NOT_LEAK_BANANA_6f3c1" apps/blog/dist` → 0건.

Astro 페이지/컴포넌트 단위 테스트는 본 PR 에서 도입하지 않음 (별도 인프라 작업 필요).

## 6. 검증 (end-to-end)

```bash
pnpm -r typecheck                       # strict + noUncheckedIndexedAccess
pnpm test                               # 신규 테스트 포함
pnpm lint
pnpm --filter blog dev                  # 수동 클릭
pnpm --filter blog build
pnpm obpub audit                        # dist 독립 검증
grep -r "FOLDER_TREE_DO_NOT_LEAK_8a4f2" apps/blog/dist || echo OK
grep -r "DO_NOT_LEAK_BANANA_6f3c1"     apps/blog/dist || echo OK
```

수동 클릭 체크리스트:
- [ ] Desktop 헤더에 `Home Categories About` 순서 표시.
- [ ] Mobile 햄버거 드로어에도 같은 3개 노출 + 사이드바 폴더 트리 그대로.
- [ ] `/` (Home) — Recent + Featured 정상.
- [ ] `/categories` — 섹션별로 노트 평탄 리스트, 정렬 OK, `private/` 자식 부재, `Uncategorized` 위치 마지막.
- [ ] `/about` — config 의 `site.about` 비어있을 때 identity + social 만 렌더, 채워지면 headline/bio/highlights 렌더.
- [ ] `/tags`, `/tags/<tag>`, `/graph` 직접 URL 접근 동작 유지.
- [ ] 노트 본문의 태그 칩 클릭 → `/tags/<tag>` 동작.
- [ ] 다크/라이트 토글, FOUC 부재.
- [ ] canonical/OG 메타 (head 검사) — `/categories`, `/about` 모두 정상.
- [ ] 콘솔 에러 0.

## 7. 커밋 분리 제안

CLAUDE.md "작은 PR 선호" 와 일관:

1. `docs(plan): nav 교체 + Categories/About 작업 계획 추가` — `docs/dev_contexts/nav_categories_about.md`.
2. `feat(core): site.about 스키마 추가` — config.ts + config.test.ts.
3. `feat(theme): nav 교체 (Home/Categories/About) + CategoryOverview · AboutPage 컴포넌트` — BaseLayout + 4 새 파일 + index.ts.
4. `feat(blog): /categories · /about 페이지` — 2 페이지 + payload lib + 테스트.

전체를 단일 PR 로 묶고 위 4커밋으로 구성 권장. privacy 파일 (`packages/core/src/privacy/**`) 미수정 — 분리 PR 룰 미해당.

## 8. 범위 외 / 후속 작업

- 런타임 admin UI 페이지 (`/settings`) — 정적 사이트 모델에 부합 X. 만들지 않음.
- About 마크다운 파서 — v1 은 구조화 필드. 후속 PR.
- Footer 에 `/tags`, `/graph` 부가 링크 — 별도 디자인 결정. 본 PR 미포함.
- 한국어 nav 라벨 (`홈/카테고리/소개`) — 후속 결정.
- BaseLayout brand 텍스트 `"noteforge"` 하드코딩 → `site.title` 바인딩. 별도 PR.
- `apps/blog/obsidian-blog.config.ts` 의 `site.about` 실 컨텐츠 채우기 — 사용자 본인 작업.

## 9. 본 계획서의 docs/ 저장

승인 후 첫 작업으로 이 파일 (`/home/shine/.claude/plans/delegated-giggling-lake.md`) 의 내용을 그대로 `docs/dev_contexts/nav_categories_about.md` 에 복사 (사용자 요청). 기존 `docs/dev_contexts/{next_todo,sidebar_fix,social_icons_and_sidebar_label}.md` 와 동일 컨벤션 (snake_case 파일명, 작업 단위 단위 1파일).
