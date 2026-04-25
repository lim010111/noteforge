# Step 0: backlinks-component (TDD)

`@obpub/theme-default`에 `Backlinks.astro`를 추가한다. 어떤 공개 노트가 현재 노트를 참조하는지 보여주는 view-only 컴포넌트.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/UI_GUIDE.md` — aside / 카드 / 링크 스타일 토큰. "장식 없음" 원칙.
- `/docs/PRD.md` — 백링크 UX (private 노트 누설 금지가 가장 중요).
- `/docs/ARCHITECTURE.md` — 컴포넌트는 view-only. 공개 판정/필터링은 이미 끝난 데이터를 받음. **컴포넌트는 isPublic 재판정 금지**.
- `/CLAUDE.md` — frontmatter allowlist (`title`, `description`, `date`, …).
- `/packages/core/src/privacy/graph.ts` — `Graph`/`computeBacklinks()` 시그니처 참고용 (재구현 금지, 컴포넌트는 결과만 받음).
- `/packages/core/src/pipeline.ts` — `PipelineResult.publicGraph: PublicGraph { nodes: string[]; edges: { from, to }[] }`. 이미 public-only로 필터됨.
- `/packages/theme-default/src/components/Note.astro` + `Note.types.ts` — view-model 패턴(allowlist subset) 레퍼런스.
- `/packages/theme-default/src/components/Note.types.ts` — JSDoc 톤 + 필드 주석 형식.
- `/packages/theme-default/tests/Note.test.ts` — Container API 테스트 패턴(렌더 → assert + canary 검증).
- `/packages/theme-default/src/index.ts` — re-export 위치.
- `/packages/theme-default/vitest.config.mts` — `getViteConfig` + Astro container 테스트 설정.
- `/packages/core/tests/fixtures/vault-mixed/` — canary `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`.

## 작업

### 1. Backlinks Props 타입 — `packages/theme-default/src/components/Backlinks.types.ts`

```ts
/**
 * View-model for `<Backlinks />`.
 *
 * INTENTIONALLY a STRICT SUBSET of the data the privacy pipeline emits.
 * Only entries whose target is PUBLIC may appear here — `@obpub/core/privacy`
 * is the single decider, and the caller must build this object from
 * `PipelineResult.publicGraph` (already public-filtered) so that no private
 * note title or slug ever reaches this component.
 *
 * Caller responsibilities (the component does NOT re-derive any of these):
 *   - all `entries[i].slug` are PUBLIC slugs (verified upstream).
 *   - `title` is the PUBLIC display title (allowlist-respecting), not the
 *     raw filename or any private-side override.
 */
export interface BacklinkEntry {
  /** Public slug. The component emits a link to `/<slug>`. */
  slug: string;
  /** Public display title. The component renders this as the link text. */
  title: string;
}

export interface BacklinksViewModel {
  entries: BacklinkEntry[];
}

export interface BacklinksProps {
  backlinks: BacklinksViewModel;
}
```

**중요**:
- `BacklinkEntry`에 `body`, `frontmatter`, `tags` 같은 필드를 추가하지 마라. 이 컴포넌트는 노트 본문/메타를 표시하지 않는다.
- 컴포넌트는 `slug`/`title` 외 어떤 필드도 출력해선 안 된다. 추가 필드를 들고 오는 객체가 들어와도 DOM에 새지 않아야 한다 (allowlist 강제).

### 2. Backlinks.astro — `packages/theme-default/src/components/Backlinks.astro`

```astro
---
/**
 * Backlinks (incoming references) — view-only.
 *
 * privacy contract: every entry in `backlinks.entries` is already PUBLIC
 * (the caller filters via `@obpub/core/privacy` — typically by passing only
 * targets present in `PipelineResult.publicGraph.nodes`). This component
 * MUST NOT re-derive isPublic, look up additional data, or emit anything
 * other than the declared fields of `BacklinkEntry`.
 *
 * Empty state: when there are no entries we render NOTHING — no <aside>,
 * no heading, no "백링크 없음" placeholder. An empty section header could
 * suggest that backlinks were filtered out, which would itself leak
 * information about private references.
 */
import type { BacklinksProps } from "./Backlinks.types";
const { backlinks } = Astro.props as BacklinksProps;
---
{backlinks.entries.length > 0 && (
  <aside aria-label="백링크" class="mt-10 border-l-2 border-zinc-300 pl-3">
    <h2 class="text-lg font-medium text-zinc-900 mt-6 mb-2">이 노트를 참조하는 노트</h2>
    <ul class="space-y-1">
      {backlinks.entries.map((e) => (
        <li>
          <a
            href={`/${e.slug}`}
            class="text-blue-600 hover:text-blue-700 underline decoration-1 underline-offset-2"
          >{e.title}</a>
        </li>
      ))}
    </ul>
  </aside>
)}
```

요구사항:
- 빈 entries → DOM에 `<aside>`/`<h2>` 어떤 것도 출력하지 마라. 이유: 빈 헤더가 "여기 뭔가 있었지만 가려졌다"를 누설.
- 링크 href는 정확히 `/<slug>`. trailing slash 없음. 자동 prefix(`./`, `../`) 금지.
- 링크 텍스트는 `entry.title`만 사용. `slug`/`description`/`date` 어느 것도 표시하지 마라.
- `set:html`을 어디에도 사용하지 마라 (XSS 위험, body가 없으므로 필요도 없음).
- entry 객체에 선언되지 않은 키가 들어와도 DOM에 출력하지 마라 (allowlist 강제는 destructuring/명시 필드 접근으로 자연 보장).
- Tailwind 토큰은 UI_GUIDE 기준만 사용 (link color, border, mt/mb 간격). gradient/shadow/blur 금지.

### 3. Re-export 추가 — `packages/theme-default/src/index.ts`

기존 export에 다음을 **추가**:

```ts
export { default as Backlinks } from "./components/Backlinks.astro";
export type { BacklinksProps, BacklinksViewModel, BacklinkEntry } from "./components/Backlinks.types";
```

### 4. 실패 테스트 먼저 — `packages/theme-default/tests/Backlinks.test.ts`

Container API로 Backlinks를 렌더. 다음 6개 assert (최소):

1. **빈 상태 0 출력**: `entries: []`로 렌더 → 결과 HTML에 `<aside`도, `백링크` 텍스트도, `<h2`도 0회 등장. (단순 공백/주석은 허용.)
2. **n entries → n 링크**: `entries: [{slug:'foo', title:'Foo'}, {slug:'bar-baz', title:'바'}]`로 렌더 → `<a href="/foo">Foo</a>`, `<a href="/bar-baz">바</a>` 각각 정확히 1회. trailing slash가 붙지 않아야 한다 (`/foo/` 0회).
3. **헤딩 1개**: 비어있지 않은 entries 렌더 시 `<h2`가 정확히 1회 등장. 빈 entries에선 0회.
4. **aria-label**: 비어있지 않을 때 `<aside aria-label="백링크"` 정확히 1회.
5. **allowlist 강제**: 다음과 같이 추가 키를 들고 와도 DOM에 0회 등장:
   ```ts
   const sneaky = {
     entries: [{
       slug: 'visible',
       title: 'Visible Title',
       body: 'DO_NOT_LEAK_BANANA_6f3c1',
       frontmatter: { secret: 'PRIVATE_FIELD_PROBE_xyz' },
       tags: ['ANOTHER_PROBE_qrs'],
     }],
   } as unknown as BacklinksViewModel;
   ```
   → `DO_NOT_LEAK_BANANA_6f3c1`, `PRIVATE_FIELD_PROBE_xyz`, `ANOTHER_PROBE_qrs`, `body`, `frontmatter`, `tags` 모두 0회. `Visible Title`과 `/visible`은 1회씩 등장.
6. **title이 raw HTML로 해석되지 않음**: `title: '<script>alert(1)</script>'`로 렌더 → 결과 HTML에 `<script>` 태그가 0개 (escape 처리되어 `&lt;script&gt;`만 등장). 이유: title은 텍스트로만 흘러야 하고, set:html을 쓰지 않으므로 Astro의 기본 escape가 작동해야 한다.

각 assert 작성 직후 `pnpm test`로 실패를 먼저 확인하고 컴포넌트를 만든다.

테스트 파일 헤더에 각 assert가 어떤 회귀를 막는지 한 줄 주석을 넣는다 (Note.test.ts와 동일 톤).

### 5. Mutation check (자가 검증)

다음 변형 중 **적어도 4개**를 임시 적용했을 때 위 assert가 반드시 실패해야 한다 (확인 후 원복):

- A. 빈 entries에서도 `<aside aria-label="백링크">백링크 없음</aside>`을 출력하도록 변경 → assert 1 실패.
- B. 링크 href를 `/${e.slug}/`로 trailing slash 추가 → assert 2 실패.
- C. `<a href={'/'+e.slug}>{e.title} ({e.slug})</a>`로 slug까지 함께 출력 → assert 5 (allowlist) 깨질 수 있음 — `slug`는 의도된 출력이므로 슬러그 자체는 그대로 등장하지만, 추가 키(`body`/`frontmatter`)를 함께 출력하는 변형으로 바꿔서 assert 5가 깨지는지 확인.
- D. `set:html={e.title}`로 변경 → assert 6 실패 (`<script>` escape 안 됨).
- E. `<aside>`를 `<section>`으로 변경 → assert 4 실패.

phase 요약에 "mutation check: A/B/D/E 실패 재현 OK"를 기록 (어떤 4개를 시도했는지 명시).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

- Backlinks 테스트 6개 전원 통과.
- 기존 core / astro-integration / theme-default 테스트 회귀 없음 (현재 244개 기준).

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `set:html`이 사용된 곳이 있는가? (있으면 안 됨 — Backlinks는 어떤 필드도 raw HTML로 받지 않는다.)
   - `BacklinkEntry`에 `slug`, `title` 외 필드가 있는가? (있으면 안 됨.)
   - `packages/core/src/privacy/`를 건드렸는가? (이 step의 권한 밖.)
   - 빈 entries에서 정말 0개의 DOM 노드가 출력되는가? (한 줄 주석 외 자식 노드 없음.)
   - UI_GUIDE 금지 패턴(gradient/blur/shadow glow) 사용했는가? 사용했다면 제거.
3. 결과에 따라 `phases/step4b-theme-discovery/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "Backlinks.astro + Backlinks.types + 6 Container-API tests + empty-state silence + allowlist 강제; mutation check: <목록> 실패 재현 OK"`.
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."` 후 즉시 중단.

## 금지사항

- `set:html`을 어떤 필드에도 쓰지 마라. 이유: Backlinks의 입력은 모두 텍스트(slug/title)이고, raw HTML 주입 경로를 만들 이유가 없음.
- 빈 `entries`일 때 placeholder/안내 문구를 출력하지 마라. 이유: "백링크 없음" 같은 문구가 private 참조의 존재를 누설할 수 있음.
- `BacklinkEntry`/`BacklinksViewModel`에 `body`, `frontmatter`, `tags` 같은 필드를 추가하지 마라. 이유: 백링크는 노트 메타를 표시하지 않으며, 추가 필드는 우발적 누출 표면을 키움.
- 컴포넌트 안에서 `isPublic` 판정/그래프 재계산을 하지 마라. 이유: 결정은 `packages/core/src/privacy/` 한 곳. 호출만 한다.
- `packages/core/`/`packages/astro-integration/`을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
