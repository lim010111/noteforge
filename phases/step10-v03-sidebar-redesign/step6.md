# Step 6: folder-index-route-and-collision

## 읽어야 할 파일

이 step은 **이번 phase에서 가장 회귀 위험이 큰 step**이다. trailingSlash 전환은 step8(canonical URL, OG meta, alias meta-refresh, Cloudflare `_headers`)와 cascading 충돌하므로 모든 영향 지점을 *원자적으로* 갱신해야 한다.

먼저 아래를 빠짐없이 읽어 영향 표면을 머리에 박아라:
- `apps/blog/astro.config.mjs:15` — 현재 `trailingSlash: 'never'`.
- `apps/blog/src/pages/[...slug].astro` (전체) — 특히:
  - 라인 ~28-46: alias-redirect 엔트리 추출 + 39라인의 alias↔note 충돌 throw 메시지 형식(이번 step의 새 throw가 따라야 할 패턴).
  - 라인 ~48-57: aliasRoutes 생성.
  - 라인 ~76-83: `Astro.site` 부재 throw.
  - 라인 ~91-122: `aliasCanonical` / `noteCanonical` 변수와 `<meta http-equiv="refresh">` 렌더(라인 ~114).
- `apps/blog/src/lib/viewModels.ts` — `entryToNoteViewModel`, `entryToAliasRedirectViewModel`, `filterPublishable`, `buildBacklinksViewModel`. canonical URL이 어디서 만들어지는지 확인.
- `apps/blog/src/lib/folderAggregation.ts` (step 3 산출).
- `phases/step8-deploy-prep/step0.md`, `step2.md`, `step3.md`, `step4.md` — alias 엔진, `_headers`, canonical/OG의 step8 결정 사항.
- `phases/step10-v03-sidebar-redesign/design/COMPONENTS.md` (FolderIndex 시안).

## 작업

다음 6가지를 *한 step 안에서* 모두 수행. 하나라도 누락되면 step8 회귀가 발생한다.

### 1. `apps/blog/astro.config.mjs`: trailingSlash 전환

```diff
- trailingSlash: 'never',
+ trailingSlash: 'always',
```

### 2. canonical URL 생성기 갱신 (`apps/blog/src/lib/viewModels.ts`)

- `entryToNoteViewModel`이 만드는 `canonicalUrl`이 trailing `/`로 끝나도록.
- `entryToAliasRedirectViewModel`이 만드는 `canonicalUrl` 그리고 redirect target 값(`to`/`canonicalUrl` 둘 다)이 trailing `/`로 끝나도록.
- 폴더 인덱스용 새 viewmodel(`entryToFolderIndexViewModel` 또는 동등)이 있다면 같은 규칙.
- 헬퍼 함수로 `withTrailingSlash(siteUrl: string, pathname: string): string`를 둬도 좋음 — `siteUrl`이 이미 `/`로 끝날 때 double-slash 방지, `pathname`이 비어있을 때 사이트 루트 `${siteUrl}/`로 정규화.

### 3. alias `<meta http-equiv="refresh">` 갱신 (`apps/blog/src/pages/[...slug].astro:114`)

```diff
- <meta http-equiv="refresh" content={`0; url=${aliasTo}`} />
+ <meta http-equiv="refresh" content={`0; url=${ensureTrailingSlash(aliasTo)}`} />
```

`aliasTo`가 이미 `/`로 끝나는지 보장하는 작은 헬퍼 추가(혹은 viewmodel 단계에서 정규화).

### 4. `getStaticPaths`에 folder-index kind 추가

`[...slug].astro` 안에서:

```ts
type RouteProps =
  | { kind: 'note'; entry: NoteEntry; titleBySlug: Map<string, string> }
  | { kind: 'alias-redirect'; entry: AliasRedirectEntry }
  | { kind: 'folder-index'; viewModel: FolderIndexViewModel };
```

`getStaticPaths` 안에서:
- 기존 `noteRoutes`, `aliasRoutes` 그대로.
- 새: `buildFolderTree(publishable)`로 트리를 만들고 *비-루트, 비-leaf-only* 노드를 모두 순회해 `folderRoutes`를 만든다. 즉, 자식 폴더가 있거나 자식 노트가 있는 폴더 노드 → `params: { slug: '<path>' }`, `props: { kind: 'folder-index', viewModel: { ... } }`.
- 루트 폴더(path `''`)는 인덱스 페이지(`apps/blog/src/pages/index.astro`)가 담당하므로 *제외*.
- folder slug는 슬래시 포함(예: `'AI/Claude'`). Astro가 trailing slash를 붙여 `/AI/Claude/` 출력.

### 5. 충돌 throw 확장 (`[...slug].astro:39` 패턴 통일 + 기존 alias throw도 갱신)

현재 `apps/blog/src/pages/[...slug].astro:39-44`의 alias 충돌 throw는 *파일 경로 표기 없음*. 본 step에서 새 folder 충돌 throw를 추가하면서 두 메시지의 형식을 *동일*하게 맞추기 위해 **기존 alias throw에도 파일 경로 trailer를 추가**한다(file:line 컨벤션 step 7c와 일관).

기존 (변경 전, 라인 39-44):
```ts
for (const alias of aliasEntries) {
  if (claimed.has(alias.id)) {
    throw new Error(
      `[...slug] route collision: alias '${alias.id}' (→ '${alias.data.to}') ` +
        `would overwrite a note slug. Resolve in vault frontmatter before building.`,
    );
  }
  claimed.add(alias.id);
}
```

변경 후 (alias throw에 파일 경로 trailer 추가):
```ts
for (const alias of aliasEntries) {
  if (claimed.has(alias.id)) {
    throw new Error(
      `[...slug] route collision: alias '${alias.id}' (→ '${alias.data.to}') ` +
        `would overwrite a note slug. Resolve in vault frontmatter before building. ` +
        `(apps/blog/src/pages/[...slug].astro)`,
    );
  }
  claimed.add(alias.id);
}
```

추가 (folder 충돌 throw):
```ts
for (const folder of folderRoutes) {
  if (claimed.has(folder.params.slug)) {
    throw new Error(
      `[...slug] route collision: folder '${folder.params.slug}/' shares its slug with an existing note or alias. ` +
      `Resolve by renaming the folder or the colliding note. (apps/blog/src/pages/[...slug].astro)`
    );
  }
  claimed.add(folder.params.slug);
}
```

기존 alias↔note throw를 *건드리는 변경*임을 step8 회귀 가드 측면에서 명시 — step8에서 alias 메시지 wording을 정확히 검사하는 테스트가 있다면 그 테스트도 같이 갱신.

### 6. `FolderIndex.astro` 컴포넌트 + 페이지 분기

새 파일 `packages/theme-default/src/components/FolderIndex.astro` (+ `.types.ts`):
- Props: `{ folderName: string; folderPath: string; breadcrumb: { name: string; href: string }[]; childFolders: { name: string; path: string }[]; childNotes: { slug: string; title: string }[] }`.
- 렌더: `<header>` breadcrumb + `<h1>` 폴더 이름 + `<section>` 자식 폴더 리스트 + `<section>` 자식 노트 리스트.
- props 외 다른 데이터 소스 접근 금지.

`[...slug].astro` 본문에서 `props.kind === 'folder-index'` 분기 추가:
```astro
{props.kind === 'folder-index' ? (
  <BaseLayout title={...} canonicalUrl={...} sidebar={...}>
    <FolderIndex {...props.viewModel} />
  </BaseLayout>
) : props.kind === 'alias-redirect' ? (
  ... // 기존
) : (
  ... // 기존 note
)}
```

### 7. 테스트

새 테스트:
1. **collision throw — folder vs note**: fixture에 `posts/foo` 노트 + `id: 'posts'` 노트 → `getStaticPaths` 호출 시 throw, 메시지에 `posts/`와 파일 경로 포함. (vitest 단위 테스트로 throw 검증; e2e build로도 검증)
2. **collision throw — folder vs alias**: alias `from: 'posts'` + 폴더 `posts/...` → throw.
3. **canonical URL trailing slash**: 빌드 후 `apps/blog/dist/**/*.html`을 grep하여 `<link rel="canonical" href="..."` 값이 모두 `/"` (또는 `/?` query 케이스 없음 가정)로 끝나는지.
4. **alias meta-refresh trailing slash**: `<meta http-equiv="refresh"` content의 `url=` 부분이 모두 `/`로 끝나는지.
5. **OG meta trailing slash**: `<meta property="og:url"` content가 `/`로 끝나는지.
6. **폴더 인덱스 라우팅**: 빌드 산출물에 `apps/blog/dist/AI/Claude/index.html` (또는 동등 경로)이 존재.
7. **기존 step8 audit 회귀 0**: `pnpm obpub audit` 위반 0.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm obpub audit

# canonical/og/alias 모두 trailing slash로 끝남 (위반 시 출력)
node -e "
const { readdirSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
function* walk(d) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith('.html')) yield p;
  }
}
let bad = 0;
for (const f of walk('apps/blog/dist')) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<link rel=\"canonical\" href=\"([^\"]+)\"/g)) {
    if (!m[1].endsWith('/')) { console.error('bad canonical', f, m[1]); bad++; }
  }
  for (const m of html.matchAll(/<meta property=\"og:url\" content=\"([^\"]+)\"/g)) {
    if (!m[1].endsWith('/')) { console.error('bad og:url', f, m[1]); bad++; }
  }
  for (const m of html.matchAll(/<meta http-equiv=\"refresh\" content=\"[^;]+;\\s*url=([^\"]+)\"/g)) {
    if (!m[1].endsWith('/')) { console.error('bad refresh url', f, m[1]); bad++; }
  }
}
process.exit(bad ? 1 : 0);
"
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 단계 통과.
2. trailingSlash cascading 체크리스트:
   - `astro.config.mjs` `'always'` 전환?
   - viewmodels 단계에서 모든 canonical URL이 `/`로 끝남?
   - alias meta-refresh `url=` 값이 `/`로 끝남?
   - OG `og:url` 값이 `/`로 끝남?
   - `_headers` 파일은 step8에서 만들어졌고 path-prefix matching이라 trailing slash 영향 작음 — 여전히 `pnpm obpub audit`이 위반 0 보고하는지 확인. 위반이 나오면 _headers 갱신을 step8 회귀 fix로 이 step에서 처리(step10에서 처리하는 게 아님).
3. 충돌 throw 체크:
   - 폴더-노트 충돌 → throw + 메시지에 폴더 경로 + 파일 경로?
   - 폴더-alias 충돌 → throw?
   - 메시지 형식이 기존 alias↔note throw(`[...slug].astro:39`)와 일관?
4. canary 회귀: `pnpm --filter blog build` 후 canary 2종 dist 0회.
5. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 6을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "trailingSlash always 전환 + viewmodels canonical/alias-refresh trailing slash 정규화 + folder-index kind 라우트 + folder↔note/alias 충돌 build-time throw + FolderIndex.astro, 4종 회귀 가드(canonical/og/refresh/audit) 통과"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- 폴더-노트/alias 슬러그 충돌을 silent override(폴더 우선/노트 우선)로 처리하지 마라. 이유: silent override는 노트를 *보이지 않게 사라지게* 하는 회귀 — alias collision 가드와 동일 정책.
- 폴더 라우트를 vault FS 스캐닝으로 만들지 마라. 이유: privacy 우회 경로. 모든 라우트는 `filterPublishable`을 거친 collection 결과로부터.
- canonical/OG/alias-refresh 갱신 중 하나라도 빠뜨리지 마라. 이유: 한 곳만 누락되면 step8의 deploy 계약 회귀(검색 엔진 정규화 깨짐, alias가 잘못된 URL로 보냄).
- `Astro.site` 사용 의미를 변경하지 마라. 이유: step8에서 site URL이 canonical 빌드의 SSOT — `_headers`/sitemap도 같은 값을 참조한다.
- folder index 페이지에서 `getCollection`을 직접 호출하지 마라(이미 `[...slug].astro`가 받음). 컴포넌트는 props만.
- `packages/core/src/privacy/**`을 수정하지 마라.
