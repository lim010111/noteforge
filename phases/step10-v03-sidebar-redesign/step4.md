# Step 4: sidebar-and-avatar-components

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `phases/step10-v03-sidebar-redesign/design/COMPONENTS.md` (Sidebar/AvatarBlock/FolderTree 시안 + 카테고리 accent 적용 지점)
- `phases/step10-v03-sidebar-redesign/refs/parent_page.png` (폴더 이름 vs `▶` 분리 hit zone)
- `packages/theme-default/src/components/Backlinks.astro` + `Backlinks.types.ts` (props 패턴 참조)
- `packages/theme-default/src/components/TagList.astro` + `TagList.types.ts`
- `packages/theme-default/src/components/Note.astro` (prose/메타 컨벤션)
- `packages/theme-default/src/styles/tokens.css` (step 2에서 새로 들어온 `--color-accent-secondary`, `--color-accent-cat-N`, 새 surface tier)
- `packages/theme-default/src/styles/components.css`, `layout.css`
- `apps/blog/src/lib/folderAggregation.ts` (step 3 산출 — `FolderNode` 타입)
- `packages/theme-default/tests/` 디렉토리 — 기존 컴포넌트 테스트 패턴(있다면 그 패턴 재사용; 없다면 Vitest + HTML 렌더 패턴을 다른 패키지에서 찾아 미러)

## 작업

3개 컴포넌트 + 1개 helper. 모두 JS-less, 정적 빌드.

### 1. `packages/theme-default/src/lib/categoryAccent.ts` (신규)

```ts
/**
 * 첫 슬러그 segment를 안정적으로 N개 accent 슬롯 중 하나에 매핑.
 * - 입력 segment 동일 → 같은 슬롯(결정성).
 * - vault-agnostic: 하드코딩된 vault 폴더명 없음.
 * - Unmapped(빈 segment 등) → null → 호출부가 primary accent로 폴백.
 *
 * 구현 힌트: FNV-1a 32-bit 같은 단순 해시 → modulo N. modulo가 fork 사용자에게도 결정적이 되도록
 * 슬롯 수(N)는 시그니처 인자로 받는다.
 */
export function pickCategoryAccentSlot(
  segment: string,
  slotCount: number,
): number | null;

/**
 * 코드 SSOT. design/TOKENS.md의 N과 일치해야 하며,
 * tokens.css의 `--color-accent-cat-1`..`-N`까지 정의되어 있어야 한다.
 * step 8의 sidebarPayload.ts는 이 상수를 import해서 SLOT_COUNT 하드코딩 회피.
 */
export const CATEGORY_ACCENT_SLOT_COUNT: number;  // 실값은 design/TOKENS.md (4~6)
```

`packages/theme-default/src/index.ts`(barrel)에서 `pickCategoryAccentSlot`과 `CATEGORY_ACCENT_SLOT_COUNT`를 모두 named export 한다 — step 8이 `import { CATEGORY_ACCENT_SLOT_COUNT } from '@noteforge/theme-default'`로 받는다.

테스트 `categoryAccent.test.ts`:
- 같은 segment → 같은 슬롯(결정성, 100회 반복).
- 다른 segment 100개 → 분포가 균등에 가까움(쓸데없이 1개 슬롯에 몰리지 않음 — 분산 sanity check).
- 빈 문자열 → `null`.
- `slotCount=0` → `null` (방어).

### 2. `packages/theme-default/src/components/AvatarBlock.astro` (신규) + `.types.ts`

Props:
```ts
export interface AvatarBlockProps {
  avatarSrc?: string;   // siteSchema에서 검증된 상대 경로
  nickname?: string;
}
```

규칙:
- 둘 다 없으면 *컴포넌트 자체가 아무것도 렌더하지 않는다* (빈 슬롯 누설 0).
- `avatarSrc`만 있으면 이미지만, `nickname`만 있으면 텍스트만.
- `<img>`에 `loading="eager"`(첫 화면), `decoding="async"`, 명시적 `width`/`height`(CLS 0).
- Avatar 모양: 기존 radius 스케일(`--radius-sm/md/lg`) 안에서 design 결정 — `rounded-full` 토큰 신규 도입 금지(ANTIPATTERNS).

### 3. `packages/theme-default/src/components/FolderTree.astro` (신규) + `.types.ts`

Props:
```ts
import type { FolderNode } from '../lib/folderTree.types';  // step 3에서 신규 생성된 SSOT
export interface FolderTreeProps {
  root: FolderNode;
  activeSlug?: string;          // 현재 활성 노트 슬러그(예: 'AI/Claude/agents')
  activeFolderPath?: string;    // 현재 활성 폴더 인덱스 경로(예: 'AI/Claude/' — trailing slash 포함)
  slotCount: number;            // categoryAccent 슬롯 수(--color-accent-cat-N의 N)
}
```

렌더 규칙:
- 외곽: `<nav aria-label="Folder tree">` → `<ul>` (tree role 사용 금지 이유: 키보드 화살표 핸들러 없음).
- 폴더 노드: `<li><details open?>... </details></li>`.
  - `<summary>` 안에 `▶` 아이콘 — 토글 hit zone.
  - 폴더 *이름*은 `<a href="/<path>/">` (별도 hit zone — `<summary>`와 분리, click 이벤트 stop은 불필요).
  - `open` 속성: `activeSlug` 또는 `activeFolderPath`가 이 폴더의 자손이면 자동 `open`. 그 외엔 닫힘. 영속화 없음.
  - 폴더 이름 옆 카테고리 accent 도트(혹은 underline) — 첫 segment에 대해 `pickCategoryAccentSlot` 호출, 결과 슬롯 → CSS variable inline `style="--cat-accent: var(--color-accent-cat-${n})"`. unmapped면 inline 변수 미설정 → primary accent 상속.
- 노트 노드: `<li><a href="/<slug>/">` — `aria-current="page"` when `activeSlug === slug`.
- 빈 트리(루트 children/notes 모두 0): `<nav>` 자체를 렌더하지 않음.

### 4. `packages/theme-default/src/components/Sidebar.astro` (신규) + `.types.ts`

`AvatarBlock` + `FolderTree` 컴포지션 + (선택적) 추가 nav 링크 슬롯.

Props:
```ts
export interface SidebarProps {
  folderTree: FolderNode;
  activeSlug?: string;
  activeFolderPath?: string;
  avatarSrc?: string;
  nickname?: string;
  slotCount: number;
}
```

렌더 컨테이너: `<aside class="sidebar">`. lg+에서 grid 좌측 컬럼, < lg에서 BaseLayout의 `<details>` 드로어 안 내용으로 들어감(드로어 자체는 step 5의 BaseLayout 책임).

### 5. CSS

`packages/theme-default/src/styles/components.css`에 다음 BEM 스타일을 *토큰만 참조*하여 추가:
- `.sidebar`, `.sidebar__avatar`, `.sidebar__tree`
- `.folder-tree`, `.folder-tree__item`, `.folder-tree__summary`, `.folder-tree__name`, `.folder-tree__chevron`, `.folder-tree__notes`, `.folder-tree__note-link`, `.folder-tree__note-link--active`
- hex 직접 사용 금지(ANTIPATTERNS 회귀 가드).
- `prefers-reduced-motion`: `<details>` 토글 transition 비활성화.

### 6. 테스트

`packages/theme-default/tests/Sidebar.test.ts` (또는 컴포넌트별 분리). 다음 fixture와 케이스:

Fixture (3단 깊이):
```
root
├─ posts/
│  ├─ a (note)
│  └─ b (note)
├─ AI/
│  └─ Claude/
│     └─ agents (note)
└─ about (note)
```

테스트:
1. **DOM nesting**: rendered HTML의 `<ul>` 트리가 입력 트리 모양과 일치(폴더 → 폴더/노트 자식).
2. **`aria-current="page"` 위치**: `activeSlug='AI/Claude/agents'`로 렌더 → 그 노트 링크에만 `aria-current="page"`. 다른 곳엔 *없다*.
3. **`<details open>` 조상 체인**: 위 active state에서 `AI`와 `AI/Claude` 둘 다 `open`. 형제 `posts`는 `open` *없음*.
4. **활성 폴더 인덱스**: `activeFolderPath='AI/Claude/'`로 렌더 → `AI`와 `AI/Claude` `open`. `aria-current` 노트 링크에는 없음(폴더 이름 링크에 `aria-current="page"` 부여 — 폴더 이름이 활성).
5. **빈 트리 미렌더**: `root.children=[]`, `root.notes=[]`이면 `<nav>` 자체가 출력에 *없다*.
6. **AvatarBlock 빈 슬롯 누설 0**: `avatarSrc`/`nickname` 둘 다 없으면 `<aside>` 안에 avatar 영역 *없다*.
7. **카테고리 accent 결정성**: 같은 segment를 두 번 렌더 → 같은 `--cat-accent` CSS 변수 슬롯.
8. **Privacy 회귀 가드** (CRITICAL):
   - `filterPublishable`을 시뮬레이션해 private 브랜치를 입력에서 *제외*한 트리를 만들고, 거기 들어 있던 canary 텍스트(`DO_NOT_LEAK_BANANA_6f3c1`)가 렌더 결과에 0회 등장.
   - 같은 입력으로 BaseLayout 통합 렌더(step 5에서 더 자세히) 후 canary 0회.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test

# 새 컴포넌트가 hex를 직접 사용하지 않음(ANTIPATTERNS 회귀 가드)
! grep -E '#[0-9a-fA-F]{3,8}' packages/theme-default/src/components/{Sidebar,FolderTree,AvatarBlock}.astro

# Sidebar/FolderTree 컴포넌트가 client 디렉티브 없이 정적 — JS bundle 0 추가
! grep -E 'client:(load|idle|visible|media|only)' packages/theme-default/src/components/{Sidebar,FolderTree,AvatarBlock}.astro
```

## 검증 절차

1. 위 AC 커맨드 실행.
2. 컴포넌트 체크리스트:
   - `<nav aria-label="Folder tree">` 사용? `role="tree"` *없음*?
   - 폴더 이름 링크와 `▶` summary가 별도 hit zone?
   - 빈 슬롯(빈 트리, avatar/nickname 미정의) 모두 *완전 미렌더*?
   - 카테고리 accent 도트가 `pickCategoryAccentSlot` 결과를 통해 적용?
3. canary 회귀: `pnpm --filter blog build` 후 canary 2종 dist 0회.
4. audit 회귀: `pnpm obpub audit` 위반 0.
5. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 4를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "AvatarBlock/FolderTree/Sidebar 신규(+types) + categoryAccent.ts 결정 매핑 + 8 컴포넌트 테스트(DOM/active/aria/empty/accent/canary), JS-less 정적 렌더 유지"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- 컴포넌트 안에서 `astro:content`나 `getCollection`을 import하지 마라. 이유: 데이터는 props로만 — pure 컴포넌트 계약, BaseLayout/페이지가 데이터 소스.
- `role="tree"`/`role="treeitem"`/`role="group"` ARIA tree role을 사용하지 마라. 이유: 표준 tree role은 화살표 키 키보드 탐색 핸들러를 *필수*로 요구한다 — 우리는 client JS 0이라 그걸 제공할 수 없고, role만 광고하는 건 보조기술 사용자에게 *깨진 약속*이라 차라리 평범한 nav가 낫다.
- `client:load`/`client:idle`/`client:visible` 등 client 디렉티브를 어디에도 붙이지 마라. 이유: v0.2의 정적 출력 계약(`<head>` theme-init 1개 외 인터랙티브 JS 0).
- 컴포넌트 CSS에 `#hex` 색을 직접 쓰지 마라. 이유: 토큰만 사용 — fork 사용자가 테마 커스터마이즈 가능해야 함.
- 폴더 이름과 토글을 같은 hit zone에 두지 마라. 이유: 와이어프레임(parent_page.png)에서 둘이 분리되어 있고, 폴더 이름은 인덱스 페이지 이동, ▶는 펼침 — 두 행동이 의미적으로 다르다.
- 컴포넌트 안에 정적 `id` 속성(또는 `for=`/`aria-labelledby`/`aria-controls`로 참조되는 id)을 부여하지 마라. 이유: BaseLayout(step 5)에서 데스크톱 grid 좌측과 모바일 `<details>` 드로어 안에 같은 `<Sidebar>`를 *두 번 렌더*한다. 같은 id가 한 페이지에 두 번 나오면 HTML 위반 + 보조기술 충돌. 필요하면 props로 id suffix를 받아 호출부가 differ하게 둔다.
- `packages/core/src/privacy/**`을 수정하지 마라.
- 빈 슬롯에 placeholder 텍스트("프로필 없음" 등)를 그리지 마라. 이유: empty-state 누설 — 어떤 사용자가 avatar/nickname을 *설정하지 않았다*는 정보 자체를 흘리지 않는다.
