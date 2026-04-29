# Step 8: wire-sidebar-into-all-routes

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `apps/blog/src/pages/index.astro` (step 7 산출 — Recent/Featured 두 레일)
- `apps/blog/src/pages/[...slug].astro` (step 6 산출 — note/alias-redirect/folder-index 3 분기)
- `apps/blog/src/pages/graph.astro`
- `apps/blog/src/pages/404.astro`
- `apps/blog/src/pages/tags/index.astro`
- `apps/blog/src/pages/tags/[tag].astro`
- `apps/blog/src/pages/api/graph.json.ts` (이건 데이터 라우트 — *건드리지 않음*)
- `apps/blog/src/lib/folderAggregation.ts` (step 3)
- `apps/blog/src/lib/viewModels.ts` (`filterPublishable`)
- `apps/blog/obsidian-blog.config.ts` (step 2 산출 schema에 `avatar?`/`nickname?` — 사용자가 추가했을 수 있음)
- `packages/theme-default/src/components/Sidebar.astro` + `BaseLayout.astro`(step 4/5)

## 작업

### 1. 신규 헬퍼 `apps/blog/src/lib/sidebarPayload.ts`

```ts
import { CATEGORY_ACCENT_SLOT_COUNT } from '@noteforge/theme-default';
import type { FolderNode } from '@noteforge/theme-default';
import { filterPublishable } from './viewModels.ts';
import { buildFolderTree } from './folderAggregation.ts';
import obpubConfig from '../../obsidian-blog.config.ts';

export interface SidebarPayload {
  folderTree: FolderNode;
  activeSlug?: string;
  activeFolderPath?: string;
  avatarSrc?: string;
  nickname?: string;
  slotCount: number;
}

/**
 * - allEntries: getCollection('notes') 결과(정제 전).
 * - 내부에서 filterPublishable → buildFolderTree.
 * - active 인자는 호출부가 정함. 노트 페이지 = entry.id, 폴더 인덱스 페이지 = `${path}/`,
 *   home/tags/graph/404 = undefined.
 * - obpubConfig.site.{avatar,nickname}을 읽어 옵션 통과.
 * - slotCount는 step 4에서 export된 CATEGORY_ACCENT_SLOT_COUNT를 그대로 사용
 *   (design/TOKENS.md → tokens.css → categoryAccent.ts SSOT 체인).
 */
export function buildSidebarPayload(
  allEntries: Parameters<typeof filterPublishable>[0],
  options?: { activeSlug?: string; activeFolderPath?: string },
): SidebarPayload;
```

**SLOT_COUNT 하드코딩 금지** — step 4의 `CATEGORY_ACCENT_SLOT_COUNT`를 import해서 그대로 통과시킨다. design/TOKENS.md → tokens.css → categoryAccent.ts → sidebarPayload 한 SSOT 체인을 깨면, design이 N=5라 결정했는데 코드가 N=6이면 빈 슬롯이 unset되어 시각 회귀.

### 2. 라우트 wiring

#### 2-1. `apps/blog/src/pages/index.astro`
- `buildSidebarPayload(all)` (active 인자 없음) → `<BaseLayout sidebar={...}>`.

#### 2-2. `apps/blog/src/pages/[...slug].astro`
- `props.kind === 'note'`: `buildSidebarPayload(all, { activeSlug: props.entry.id })`.
- `props.kind === 'folder-index'`: `buildSidebarPayload(all, { activeFolderPath: `${props.viewModel.folderPath}/` })`.
- `props.kind === 'alias-redirect'`: 사이드바 *없이* (alias 페이지는 즉시 redirect라 사이드바가 무의미 — 빈 props 전달).

#### 2-3. `apps/blog/src/pages/graph.astro`
- `buildSidebarPayload(all)` (active 없음).

#### 2-4. `apps/blog/src/pages/404.astro`
- `buildSidebarPayload(all)` (active 없음). 404의 기존 "private 존재 누설 금지" 카피는 그대로.

#### 2-5. `apps/blog/src/pages/tags/index.astro` & `tags/[tag].astro`
- 둘 다 `buildSidebarPayload(all)` (active 없음 — 태그 페이지는 노트/폴더 활성 표기 없음).

#### 2-6. `apps/blog/src/pages/api/graph.json.ts`
- 데이터 라우트 — *건드리지 않음*. 사이드바와 무관.

### 3. 테스트

신규 `apps/blog/src/lib/sidebarPayload.test.ts`:

1. **payload shape**: 3단 깊이 fixture 입력 → 출력 `folderTree`가 step 3의 `buildFolderTree` 결과와 동일.
2. **active note 통과**: `activeSlug: 'AI/Claude/agents'` 전달 → 출력에 그대로 보존.
3. **active folder 통과**: `activeFolderPath: 'AI/Claude/'` 전달 → 출력에 그대로 보존.
4. **avatar/nickname 미정의 시**: `obpubConfig.site`에 둘 다 없으면 출력의 `avatarSrc`/`nickname`이 *모두 undefined* (빈 문자열 등 거짓 값으로 흘러들지 않음).
5. **avatar/nickname 정의 시**: 둘 다 있으면 출력에 그대로.
6. **`SLOT_COUNT` export**: const grep으로 실값 확인.
7. **filterPublishable 누설 가드**: `allEntries`에 private 노트 + canary `DO_NOT_LEAK_BANANA_6f3c1`을 심은 fixture 통과 → 출력 트리 어디에서도 canary 0회 등장.

빌드 시 smoke:

```bash
pnpm --filter blog build
# 모든 HTML 페이지에 사이드바 nav landmark가 들어 있는지(alias-redirect 페이지는 제외)
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
let missing = 0;
for (const f of walk('apps/blog/dist')) {
  const html = readFileSync(f, 'utf8');
  // alias-redirect 페이지는 meta-refresh로 식별
  const isAlias = /<meta http-equiv=\"refresh\"/.test(html);
  if (isAlias) continue;
  if (!/<nav[^>]+aria-label=\"Folder tree\"/.test(html)) {
    console.error('missing sidebar nav', f);
    missing++;
  }
}
process.exit(missing ? 1 : 0);
"
```

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm obpub audit

# 모든 비-alias 페이지에 사이드바 nav landmark 존재 (위 node 스크립트)
# api/graph.json.ts 변경 없음 sanity
git diff --stat apps/blog/src/pages/api/graph.json.ts | grep -c '|' || true   # 0이어야 함
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 단계 통과.
2. wiring 체크리스트:
   - 모든 페이지 라우트(index/[...slug]/tags index/tags [tag]/graph/404)에서 `buildSidebarPayload` 호출?
   - `activeSlug`/`activeFolderPath` 인자가 페이지 종류별로 정확?
   - alias-redirect 페이지에는 사이드바 *전달 안 함*?
   - api/graph.json.ts는 한 글자도 변경 안 됨?
3. canary 회귀: 빌드 후 canary 2종 0회 (+ step 9에서 새 canary 가드 추가).
4. audit 회귀: `pnpm obpub audit` 위반 0.
5. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 8을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "sidebarPayload.ts 신규 + 6개 라우트(index/[...slug]/tags×2/graph/404)에 사이드바 wire, alias-redirect 페이지는 스킵, 7 단위 테스트 + build smoke(모든 비-alias 페이지에 nav landmark)"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- `sidebarPayload.ts`에서 vault FS를 읽지 마라(`fs`/`path`로 디스크 접근 금지). 이유: 모든 입력은 `getCollection('notes')` 결과로만 — privacy 우회 경로 차단.
- 헬퍼 로직을 페이지 안에 *복제*하지 마라(SSOT 1곳). 이유: 6개 라우트의 wiring 일관성이 깨지면 한 페이지에서만 누설/회귀가 일어날 수 있다.
- 헬퍼에서 `isPublic` 같은 privacy 판정을 직접 호출하지 마라. `filterPublishable`만 사용. 이유: 결정은 `packages/core/src/privacy/`에서만(CLAUDE.md CRITICAL).
- `api/graph.json.ts`를 건드리지 마라. 이유: API 라우트는 데이터 출력이고, 사이드바 props가 의미 없음 + 의도치 않은 JSON 형태 변경은 step8의 graph 계약 회귀.
- alias-redirect 페이지에 사이드바를 그리지 마라. 이유: 즉시 redirect 페이지에 사이드바를 그리면 (1) FOUC, (2) 외부 traffic이 redirect 도중 사이드바 트리(노트 슬러그)를 *0.x초간 보게 됨* — 의미 없는 누설 기회.
- `SLOT_COUNT`나 카테고리 accent 슬롯 수를 본 파일에 매직넘버로 하드코딩하지 마라. 이유: design/TOKENS.md → tokens.css → `CATEGORY_ACCENT_SLOT_COUNT` SSOT 체인. 한 곳에서만 수정해도 전체가 따라가도록.
- `packages/core/src/privacy/**`을 수정하지 마라.
