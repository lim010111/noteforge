# Step 2: note-and-404 (TDD)

`@obpub/theme-default`에 두 가지를 추가:
1. `Note.astro` — 단일 노트 본문 페이지 컴포넌트. **frontmatter allowlist 강제**가 핵심.
2. `NotFound.astro` — 404 본문 컴포넌트. **private 노트의 존재를 누설하지 않는 문구**가 핵심.

이 step은 privacy 회귀가 가장 일어나기 쉬운 지점이다. 테스트를 두껍게 쓴다.

## 읽어야 할 파일

- `/docs/UI_GUIDE.md` — Note 카드 / 태그 칩 스타일 토큰.
- `/docs/PRD.md` — "독서 우선" + 노트 페이지 UX (제목/발행일/태그 칩 + 본문).
- `/docs/ARCHITECTURE.md` — 컴포넌트는 view-only. 공개 판정/필터링은 이미 끝난 데이터를 받음.
- `/CLAUDE.md` — frontmatter allowlist (`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`).
- `/packages/core/src/types.ts` — `ParsedNote` 타입.
- `/packages/core/src/privacy/frontmatterFilter.ts` — allowlist 필터 구현 (재사용 대상).
- `/packages/theme-default/src/layouts/BaseLayout.astro` — step 1 산출물.
- `/packages/theme-default/src/index.ts` — re-export.
- `/packages/core/tests/fixtures/vault-mixed/` — canary `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`.

## 작업

### 1. Note.astro Props 타입 — `packages/theme-default/src/components/Note.types.ts`

```ts
export interface NoteViewModel {
  title: string;
  date?: string;        // ISO 8601
  updated?: string;
  tags: string[];       // 이미 blocklist 거른 tag 목록
  description?: string;
  body: string;         // 사전 렌더된 sanitized HTML
}

export interface NoteProps {
  note: NoteViewModel;
}
```

**중요**:
- `NoteViewModel`은 frontmatter allowlist의 **부분집합**만 갖는다. `personal-note`, `review-date` 같은 임의 키는 타입 자체가 허용하지 않는다.
- `body`는 이미 core 파이프라인에서 link rewrite + comment strip + transclude까지 끝난 sanitized HTML. **컴포넌트는 추가 가공 없이 그대로 출력**.
- `tags`는 이미 tag blocklist를 거친 결과만 담겨 있다고 가정 (호출자 책임). 컴포넌트는 추가 필터링하지 않는다.

### 2. Note.astro — `packages/theme-default/src/components/Note.astro`

```astro
---
import type { NoteProps } from "./Note.types";
const { note } = Astro.props as NoteProps;
---
<article>
  <header>
    <h1>{note.title}</h1>
    {note.date && <time datetime={note.date}>{/* 사람이 읽는 포맷 */}</time>}
    {note.tags.length > 0 && (
      <ul aria-label="태그">
        {note.tags.map((t) => <li><a href={`/tags/${encodeURIComponent(t)}`} class="...">#{t}</a></li>)}
      </ul>
    )}
  </header>
  <div set:html={note.body} />
</article>
```

요구사항:
- `<article>`을 정확히 1개 사용.
- 태그 칩 스타일은 UI_GUIDE의 "태그 칩" 토큰만 사용.
- `set:html`은 **`note.body`에만 사용**. 다른 어떤 필드에도 쓰지 마라 (raw injection 위험).
- `note` 객체 외의 어떤 필드도 DOM에 그대로 출력하지 마라. JSON-LD/`<meta>`/HTML 주석 어디에도 NoteViewModel 밖 값이 등장하면 안 됨.

### 3. NotFound.astro — `packages/theme-default/src/components/NotFound.astro`

```astro
---
// no props — 정적 안내문만
---
<section>
  <h1>페이지를 찾을 수 없습니다</h1>
  <p>요청하신 페이지가 존재하지 않거나, 더 이상 공개되지 않습니다.</p>
  <p><a href="/">홈으로 돌아가기</a></p>
</section>
```

**필수 문구 규칙** (PRD의 "private 존재 누설 금지" 준수):
- "비공개" 단어를 사용하지 마라. 이유: 그 자리에 사적 노트가 있었음을 누설.
- "삭제됨" 사용 금지. 이유: 동일.
- 허용되는 표현: "존재하지 않거나, 더 이상 공개되지 않습니다." (양가적 — public이 unpublished되었거나 애초에 없었거나).
- 슬러그/요청 경로를 페이지에 출력하지 마라. 이유: 경로 자체가 정보 (예: `/diary/2024-...`).

### 4. Re-export 추가 — `packages/theme-default/src/index.ts`

```ts
export { default as BaseLayout } from "./layouts/BaseLayout.astro";
export type { BaseLayoutProps } from "./layouts/BaseLayout.types";
export { default as Note } from "./components/Note.astro";
export { default as NotFound } from "./components/NotFound.astro";
export type { NoteProps, NoteViewModel } from "./components/Note.types";
```

### 5. 실패 테스트 먼저 — `packages/theme-default/tests/Note.test.ts`

Astro container API로 Note를 렌더. 다음 7개 assert (최소):

1. `<article>` 정확히 1개.
2. `<h1>`에 props.note.title이 정확히 출력.
3. `note.date` 제공 시 `<time datetime="...">` 1개. 미제공 시 0개.
4. `note.tags = ["foo", "bar"]` 입력 시 `<a href="/tags/foo">`, `<a href="/tags/bar">` 각각 정확히 1개.
5. **canary 누출 없음**: `body: "before <p>안녕</p> after"`로 줘서 그대로 들어가는지 확인 + `note.title = "DO_NOT_LEAK_BANANA_6f3c1"`이면 title은 출력되지만, 같은 문자열을 **NoteViewModel 밖에서** 주입하려는 어떤 시도도 실패해야 한다.
6. **타입 차원 차단**: `note: { ...정상필드..., personalNote: "secret" }` 같은 오브젝트를 넘겨도 personalNote 문자열이 렌더 HTML에 0회 등장. (TypeScript는 excess property check로 컴파일 단계에서 막아줄 수 있고, 런타임에서도 컴포넌트는 명시 필드만 읽으므로 출력 안 됨 — 이걸 assert.)
7. **`%%` 코멘트 잔존 없음**: `body: "<p>before %%leak%% after</p>"`처럼 일부러 코멘트 패턴이 들어와도 코멘트 strip은 core 책임이므로 컴포넌트는 그대로 통과시키되, fixture vault의 정상 파이프라인을 거친 body에는 `CLAUDE_COMMENT_LEAK_77b`가 0회 등장. (이 assert는 fixture에서 가져온 sanitized body로 수행.)

`packages/theme-default/tests/NotFound.test.ts` — 4개 assert (최소):

1. `<h1>` 1개 + 본문에 "존재하지 않거나" 또는 "더 이상 공개되지 않습니다" 문구 포함.
2. **누설 금지 단어 없음**: HTML에 "비공개", "private", "삭제" 단어가 0회 등장.
3. 홈 링크 `<a href="/">` 정확히 1개.
4. 어떤 props도 받지 않는다 (Astro.props 객체에 키가 없음).

각 assert 작성 직후 `pnpm test`로 실패를 먼저 확인하고 컴포넌트를 만든다.

### 6. Mutation check (자가 검증)

다음 변형 중 적어도 4개를 임시 적용했을 때 위 assert가 반드시 실패해야 한다 (확인 후 원복):
- `<article>`을 2개로 늘림 → Note assert 1 실패.
- `note.body`에 `set:html` 대신 `{note.body}` 사용 → 텍스트로 escape되어 `<p>` 등 태그가 사라짐 → assert 5 깨짐.
- 태그 링크 href를 `/tag/${t}`로 오타 → assert 4 실패.
- NotFound에 "비공개" 단어 추가 → NotFound assert 2 실패.
- NotFound에서 홈 링크 제거 → assert 3 실패.

phase 요약에 "mutation check: A/B/C/D 실패 재현 OK"를 기록.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

- Note 테스트 7개 + NotFound 테스트 4개 전원 통과.
- 기존 core/astro-integration/theme-default 테스트 회귀 없음.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - `set:html`이 `note.body` 외에 사용된 곳이 있는가? (있으면 안 됨)
   - `NoteViewModel`이 frontmatter allowlist의 부분집합인가?
   - NotFound 본문에 "비공개", "private", "삭제" 단어가 0회 등장하는가?
   - 슬러그/경로/사용자 입력이 NotFound에 출력되지 않는가?
   - `packages/core/src/privacy/`를 건드리지 않았는가? (이 step의 권한 밖)
3. 결과에 따라 `phases/step4a-theme-foundation/index.json`의 step 2를 업데이트.
   - 성공 → `"status": "completed"`, `"summary": "Note + NotFound + 11 tests + allowlist 강제 + 누설금지 문구 OK; mutation check: ..."`.
   - 실패 → `"status": "error"`.

## 금지사항

- `Note.astro`/`NotFound.astro`에서 `set:html`을 `note.body` 외 어떤 값에도 쓰지 마라. 이유: stored XSS / raw injection 위험.
- `NoteViewModel`에 allowlist 밖 키를 추가하지 마라 (예: `personalNote`, `reviewDate`). 이유: CLAUDE.md CRITICAL — 새 필드를 추가하려면 allowlist 갱신이 별도 PR로 선행되어야 함.
- NotFound에 요청 경로/슬러그/유저 입력을 출력하지 마라. 이유: private 노트 존재 누설.
- "비공개", "삭제됨", "private", "deleted" 같은 단어를 NotFound 본문에 쓰지 마라. 이유: 그 자리에 비공개 노트가 있었음을 누설.
- 컴포넌트 안에서 추가로 link rewrite/comment strip/transclude 처리를 하지 마라. 이유: 결정은 한 곳(`packages/core/src/privacy/`). 호출만 한다.
- `packages/core/`/`packages/astro-integration/`을 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
