# 0015. Folder-Mode 사이드바, leaf 노트 기본 숨김 (`nav.sidebarNotes`)

## Status
Accepted · 2026-Q2 · v0.7

## Context
`nav.mode === 'folder'` 은 사이드바 폴더 트리에 폴더뿐 아니라 각 폴더에
직접 속한 노트(leaf 노트)까지 제목으로 펼쳐 보여 왔다. 그 근거는
`apps/blog/src/lib/sidebarPayload.ts` 주석에 명시돼 있었다 — *"folder
모드는 vault path 가 곧 URL 이라 full-tree 뷰(노트 포함)를 유지한다"*.
사이드바가 사이트맵 역할을 겸한다는 의도였다.

이 설계는 노트 수가 적을 때만 성립한다. 발행 노트가 늘어나면 사이드바가
노트 제목으로 가득 차 카테고리 구조가 묻히고 탐색이 어려워진다. 이미
`nav.mode === 'category'` 는 이 문제 때문에 `hideLeafNotes` 를 자동으로
켜 사이드바를 "카테고리 전용 내비게이터"로 유지하고 있었다 — folder
모드만 예외였다.

`hideLeafNotes` 메커니즘 자체(`FolderTree.astro` 의 노트 렌더 분기 생략,
자식 폴더 없는 카테고리를 chevron 없는 단순 링크로 강등하는
`shouldRenderAsLeafLink`)와, 폴더를 클릭하면 자식 노트 목록을 보여 주는
도착지(`FolderIndex.astro`)는 이미 전부 구현돼 있었다. 남은 것은 "folder
모드에서 그것을 어떻게 켜느냐" 였다.

## Decision
1. `navSchema` 에 `sidebarNotes: z.enum(['show', 'hide']).default('hide')`
   를 추가한다. 기본값은 `'hide'`.
2. `buildSidebarPayload` 의 `if (mode === 'category')` 특례를 제거하고
   `hideLeafNotes = (nav.sidebarNotes === 'hide')` 단일 규칙으로 통합한다.
   folder·category 두 모드가 같은 사이드바 밀도 규칙을 공유한다. 기본값
   `'hide'` 라 category 모드 동작은 불변이다.
3. 폴더를 클릭하면 나오는 `FolderIndex.astro` 페이지가 자식 노트 목록의
   도착지 역할을 그대로 맡는다 — 이미 썸네일·설명·태그·날짜를 포함해
   노트를 나열하므로 변경 없음.
4. `FolderTree` 에 조상 폴더 하이라이트(`folder-tree__name--current-section`)
   를 추가한다. 노트를 사이드바에서 숨기면 노트 페이지에서 해당 노트
   링크의 `aria-current="page"` 가 사라져 "현재 위치" 단서가 없어지므로,
   `activeSlug` 의 직속 컨테이너 폴더를 약하게 강조해 wayfinding 을
   보완한다(`aria-current` 가 아닌 별도 클래스 — 현재 페이지는 노트지
   폴더가 아니므로).
5. vault 루트 직속 노트(폴더 없는 노트)도 같은 규칙으로 숨긴다. 홈페이지
   글 목록·태그 페이지로 도달한다. "노트는 사이드바에 안 나온다"는 규칙을
   예외 없이 유지한다.

## Alternatives considered
- **`nav.mode` 를 `category` 로 전환** — 사이드바는 깔끔해지지만 포스트
  URL 이 vault path 기반에서 frontmatter `category` 기반으로 바뀌고,
  모든 노트에 `category` 필드를 요구한다. URL/SEO 영향이 크고 사용자가
  원한 것은 사이드바 정리이지 라우팅 변경이 아니므로 기각.
- **토글 없이 무조건 숨김** — `buildSidebarPayload` 에서 `hideLeafNotes`
  를 항상 `true` 로. 가장 적은 코드지만 문서화된 full-tree 뷰를 제품에서
  완전히 제거해 되돌릴 여지를 없앤다. 기각.
- **블로그만 opt-in, 기본값 `'show'` 유지** — 다른 OSS 사용자에게 영향이
  0 이지만, "노트가 많아지면 지저분"이라는 근거는 특정 블로그가 아니라
  모든 사용자에게 적용된다. 더 나은 기본값이라 판단해 기각.

## Consequences
- **+** 노트 수가 늘어도 사이드바가 카테고리 구조를 유지한다.
- **+** folder·category 모드가 사이드바 밀도에 대해 단일 규칙을 공유 —
  `buildSidebarPayload` 의 모드별 특례가 사라진다.
- **+** full-tree 뷰는 삭제되지 않고 `nav.sidebarNotes: 'show'` 로
  opt-in 가능하게 demote 된다.
- **−** folder 모드의 "vault path = URL = full-tree 사이트맵" 설계 근거를
  뒤집는다. `sidebarPayload.ts` 의 옛 주석은 새 근거로 재작성된다.
- **−** 루트 직속 노트는 사이드바 진입점을 잃고 홈·태그 페이지로만
  도달한다.
- privacy 에는 영향 없음 — 노트 숨김은 privacy 게이트가 아닌 표시 결정.
  canary 회귀 테스트는 그대로 통과해야 한다.

## Related
- 결정 기록: [0012-folder-routing-trailing-slash.md](./0012-folder-routing-trailing-slash.md) — folder ↔ 노트 슬러그 라우팅
- 코드: `packages/core/src/config.ts` (`navSchema`),
  `apps/blog/src/lib/sidebarPayload.ts` (`buildSidebarPayload`),
  `packages/theme-default/src/components/FolderTree.astro`
  (`hideLeafNotes` 분기 · 조상 폴더 하이라이트)
