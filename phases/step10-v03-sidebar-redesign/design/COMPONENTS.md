# COMPONENTS — v0.3 Sketches

These sketches are the SSOT for steps 4–7 of the v0.3 phase. Tokens referenced here are defined in `TOKENS.md` (delta from v0.2). Markup uses Astro/Tailwind shorthand; Tailwind class names like `bg-sidebar`, `text-accent-2`, `bg-cat-1` are tier-mapped to the corresponding CSS variable in step 2's Tailwind config (not authored as raw class strings in this file).

Status convention follows v0.2: every component declares `[New in v0.3]` because all six are new surfaces. Implementation is the responsibility of later steps in this phase; this file *is* the design contract.

---

## `Sidebar` — `[New in v0.3]`

**Purpose**: navigational spine. Persistent on every route. Composes `AvatarBlock` (top) + `FolderTree` (middle) + optional secondary nav links (bottom) into a single recessed left panel on `lg+`, or a JS-less `<details>` drawer on `< lg`.

**Props (TS-shape, prose form)**:

- `avatar?: { src: string; alt: string }` — passed through to `AvatarBlock`.
- `nickname?: string` — passed through to `AvatarBlock`.
- `handle?: string` — optional second mono line under the nickname.
- `tree: FolderNode` — root of the folder tree. See `FolderTree` for the shape.
- `currentPath: string` — used to mark `aria-current="page"` and set the active row tint.
- `extraNav?: Array<{ label: string; href: string }>` — optional links rendered below the tree (e.g., `tags`, `graph`). When omitted, the bottom nav block does not render.

**Sketch (lg+)**:

```
┌─────────────────────┐  <-- right edge: 1px --color-border
│                     │
│      ⬤ avatar       │  <-- AvatarBlock (omitted if no avatar+nickname)
│                     │
│  limwoohyun         │  <-- nickname, sans h4, --color-text-heading
│  @LIMWOOHYUN01      │  <-- handle, mono meta, --color-text-faded
│                     │
├─── (border-t) ──────┤
│                     │
│  ▾ ● AI             │  <-- FolderTree, depth 0 row + cat dot
│      ▾   Gemini     │
│      ▾   Claude     │
│            └ claude prompt guide
│                     │
│  ▸ ● DB             │
│  ▸ ● writing        │
│                     │
├─── (border-t) ──────┤
│                     │
│  TAGS               │  <-- extraNav, mono uppercase, --color-text-faded
│  GRAPH              │
│                     │
└─────────────────────┘
```

**Sketch (< lg)**: top of viewport renders a single `<details class="sidebar-drawer">` with the chevron + brand mark in `<summary>`. Opening the drawer slides the same content downward (CSS `[open]` selector + `--duration-menu` 200ms transition; `prefers-reduced-motion: reduce` zeroes it).

**States**:

- **default**: `bg-sidebar`, body text `--color-text-body`, links inherit `--font-sans`.
- **hover** (per-row only — sidebar itself has no hover): handled by `FolderTree` rows.
- **focus**: keyboard focus on any link or `<summary>` shows `--color-focus-ring` outline (2px solid, never removed).
- **active** (the current page's row): handled by `FolderTree` via `aria-current="page"`.
- **empty AvatarBlock**: when `avatar` or `nickname` is missing the AvatarBlock + its bottom border are omitted; the FolderTree starts at the top with `--space-6` top padding instead.
- **empty extraNav**: bottom block (incl. its top border) is omitted.

**Markup contract**:

```html
<aside class="sidebar bg-sidebar border-r border-default w-[var(--container-sidebar-w)]
              hidden lg:flex flex-col" aria-label="사이트 내비게이션">
  {avatar && nickname && <AvatarBlock {...} />}
  <FolderTree tree={tree} currentPath={currentPath} />
  {extraNav?.length && (
    <nav class="border-t border-default px-5 py-4
                font-mono text-meta uppercase tracking-wider text-muted
                flex flex-col gap-2" aria-label="보조 내비게이션">
      {extraNav.map(n => <a href={n.href}>{n.label}</a>)}
    </nav>
  )}
</aside>

<details class="sidebar-drawer lg:hidden border-b border-default" aria-label="내비게이션 메뉴">
  <summary class="h-12 px-4 flex items-center gap-3
                  font-mono text-meta uppercase tracking-wider text-heading">
    <span class="chevron" aria-hidden="true">▸</span>
    <span>noteforge</span>
  </summary>
  <div class="bg-sidebar pb-4">
    {avatar && nickname && <AvatarBlock {...} />}
    <FolderTree tree={tree} currentPath={currentPath} />
    {extraNav?.length && <nav>…</nav>}
  </div>
</details>
```

**Category accent application in this component**: none directly — the category dots live inside `FolderTree` rows. The Sidebar itself is achromatic.

**Mobile (`< 640px`)**: drawer collapsed by default; opening pushes the page content down (no overlay). Header height stays 48px to match v0.2 BaseLayout.

---

## `AvatarBlock` — `[New in v0.3]`

**Purpose**: identity slot at the top of the sidebar. Render-only-when-complete to avoid placeholder leaks.

**Props**:

- `avatarSrc?: string` — image URL (frontmatter or site-config sourced).
- `avatarAlt?: string` — `alt` for screen readers; defaults to the nickname.
- `nickname?: string` — display name.
- `handle?: string` — optional second mono line.

**Render rule (privacy-adjacent)**: the block renders **only if both `avatarSrc` and `nickname` are non-empty strings**. If either is missing, the block is omitted entirely — no initials fallback, no silhouette placeholder, no "Anonymous" copy. A placeholder is a signal that *someone* is hidden, which we refuse on principle (and to avoid AI-template "user card" vibes).

**Sketch**:

```
        ⬤
       (64px)
      [avatar]

  limwoohyun
  @LIMWOOHYUN01
```

**Markup**:

```html
{avatarSrc && nickname && (
  <div class="px-5 pt-6 pb-5 flex flex-col items-start gap-3">
    <img src={avatarSrc} alt={avatarAlt ?? nickname}
         width="64" height="64"
         class="w-16 h-16 rounded-full border border-default object-cover" />
    <div>
      <div class="font-sans text-h4 text-heading">{nickname}</div>
      {handle && (
        <div class="mt-1 font-mono text-meta uppercase tracking-wider text-faded">
          @{handle}
        </div>
      )}
    </div>
  </div>
)}
```

**States**:

- **default**: as drawn above.
- **hover**: the avatar `<img>` is not a link by default — no hover state. If a future site-config wraps it in a link, hover reveals `--color-accent-2` underline on the nickname.
- **focus**: only present if avatar is wrapped in a link; `--color-focus-ring`.
- **active**: not applicable.
- **empty (either prop missing)**: block does not render. The FolderTree below starts at the top of the sidebar with `--space-6` top padding to compensate for the absent header.

**Category accent application**: none — AvatarBlock sits *above* the tree and has no category context. The nickname color is `--color-text-heading`, not `--color-accent-2`. (`--color-accent-2` lands on FeaturedRail and current-folder-row, not here — keeping identity quiet.)

**Mobile (`< 640px`)**: identical layout, lives at the top of the drawer body when the user opens the drawer. Avatar size unchanged.

---

## `FolderTree` — `[New in v0.3]`

**Purpose**: render the folder hierarchy as a JS-less disclosure tree. Folder names are always-visible links; only the children list collapses.

**Props**:

- `tree: FolderNode` — recursive shape `{ name: string; href: string; depth: number; categorySlot?: 1|2|3|4|5; isCurrent?: boolean; children: Array<FolderNode | NoteNode> }`.
- `currentPath: string` — used to set `aria-current="page"` on the matching row.

**The JS-less `<details>` pattern** (the unusual bit):

By default, `<details>` hides every non-`<summary>` child when collapsed. We override this so the folder name link is always visible — only the children `<ul>` actually toggles:

```css
/* in tokens.css or theme-default's base.css — step 2 of this phase */
.folder-tree details > a.folder-name { display: inline-block; }
.folder-tree details > ul             { display: none; }
.folder-tree details[open] > ul       { display: block; }
.folder-tree details > summary .chevron { transition: transform var(--duration-base) var(--ease-out); }
.folder-tree details[open] > summary .chevron { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) {
  .folder-tree details > summary .chevron { transition: none; }
}
```

The summary contains *only* the chevron (`▸` glyph wrapped in `aria-hidden`) — clicking it toggles the disclosure. The folder name link is a sibling that stays visible whether the folder is open or closed. **No JavaScript** is loaded for any of this.

**Sketch (depth 0 = first-level folder, with cat dot)**:

```
▾  ● AI                          <-- expanded, cat-1 (iron oxide) dot, current-folder
   ▾   Gemini                    <-- depth 1, no dot
   ▾   Claude                    <-- depth 1, no dot, current-folder
        ─ opus-4.7 guide          <-- depth 2, leaf (note), no chevron
        ─ opus-4.6 guide
▸  ● DB                          <-- collapsed, cat-2 (ochre) dot
▸  ● writing                     <-- collapsed, cat-3 (moss) dot
```

**Markup**:

```html
<nav class="folder-tree px-5 py-4" aria-label="Folder tree">
  <ul class="flex flex-col gap-1">
    {tree.children.map(node =>
      node.kind === 'folder' ? (
        <li>
          <details open={node.isCurrent || node.containsCurrent}>
            <summary class="inline-flex items-center justify-center w-5 h-5
                            cursor-pointer rounded-sm
                            text-faded hover:text-body hover:bg-surface-strong
                            focus-visible:outline focus-visible:outline-2
                            focus-visible:outline-accent">
              <span class="chevron" aria-hidden="true">▸</span>
              <span class="sr-only">{node.name} 폴더 펼치기/접기</span>
            </summary>
            {node.depth === 0 && node.categorySlot && (
              <span class="folder-dot inline-block w-1.5 h-1.5 rounded-full mx-1.5
                           align-middle"
                    style={`background-color: var(--color-accent-cat-${node.categorySlot})`}
                    aria-hidden="true" />
            )}
            <a href={node.href}
               class="folder-name font-sans text-body text-body
                      hover:text-link rounded-md px-1.5 py-0.5
                      aria-[current=page]:bg-accent-2-soft
                      aria-[current=page]:text-accent-2"
               aria-current={node.href === currentPath ? 'page' : undefined}>
              {node.name}
            </a>
            <ul class="ml-3 mt-1 flex flex-col gap-1
                       border-l border-default pl-3">
              { /* recurse */ }
            </ul>
          </details>
        </li>
      ) : (
        <li class="ml-5 flex items-baseline gap-2 font-sans text-body">
          <span class="font-mono text-meta text-faded" aria-hidden="true">─</span>
          <a href={node.href}
             class="hover:text-link
                    aria-[current=page]:text-accent-2
                    aria-[current=page]:font-medium"
             aria-current={node.href === currentPath ? 'page' : undefined}>
            {node.name}
          </a>
        </li>
      )
    )}
  </ul>
</nav>
```

**ARIA**: `<nav aria-label="Folder tree">` + nested `<ul>`s + `aria-current="page"` on the active link. **No `role="tree"`, no `role="treeitem"`, no keyboard arrow handlers.** Tab traversal between links and Enter/Space on `<summary>` to toggle is the entire keyboard contract — sufficient for a content site, and avoidable of the WAI-ARIA tree-widget complexity (which would require us to ship JS for arrow keys, type-ahead, level announcement, and roving tabindex).

**States**:

- **default folder row**: chevron `▸` collapsed; folder name in `--color-text-body`.
- **hover** (cursor on chevron): `bg-surface-strong` background on chevron's hit area; folder name unchanged. Cursor on folder name: text shifts to `--color-text-link`.
- **focus** (keyboard): `--color-focus-ring` outline on whichever element is focused (chevron summary or folder link).
- **expanded** (`[open]`): chevron rotates 90° to `▾`; children `<ul>` becomes visible.
- **active** (`aria-current="page"`): folder-name link gets `bg-accent-2-soft` background + `text-accent-2` text. The matching row reads as "you are here" without crossing into the iron-oxide link/action territory.
- **empty children**: a folder with no public children does not render its children `<ul>` — but the folder itself still renders (it has its own index page). The chevron in that case has `pointer-events: none` and `opacity: 0.4` to signal "leaf-like folder."

**Category accent application**:

- **Depth 0 only**: each first-level folder row carries a 6×6px circular dot in its assigned `--color-accent-cat-N` slot, positioned between the chevron and the folder name. Slot assignment is computed deterministically from the slug-segment string (see step 3 — `packages/core/src/folderTree/categorySlot.ts`).
- **Depth ≥ 1**: no dot. Sub-folders inherit their parent's category implicitly via the indent rail (the `border-l border-default` on the children `<ul>`).
- **Category dot uses `var(--color-accent-cat-N)` as `background-color`** — inline style is the only place per-instance color is set. The class name does not encode the slot.

**Privacy contract within this component**:

- Tree input is *already* filtered by `packages/core/src/privacy/` (Phase C in `docs/ARCHITECTURE.md`). The component renders what it receives; it does **not** filter.
- A folder containing only private notes is omitted from the input → does not render → no "empty folder" leakage.
- A folder mixing public and private notes renders only the public children. The chevron is fully interactive — there is no UI hint that more (private) content exists.

**Mobile (`< 640px`)**: identical structure inside the drawer. Tap targets on chevron + folder name remain ≥ 44×44 logical pixels via padding.

---

## `FolderIndex` — `[New in v0.3]`

**Purpose**: the page rendered at `/<folder>/` URLs (collision rules with note slugs are step 6's responsibility — this design assumes folder routes are reachable). Lists immediate child *folders* first, then immediate child *notes*, with a breadcrumb above. Mirrors Obsidian's open-folder view.

**Props**:

- `breadcrumb: Array<{ label: string; href: string }>` — root-to-current path. Last item is the current folder; first item is "home" (label: `home`, href: `/`).
- `categorySlot?: 1|2|3|4|5` — the category slot for the *first* breadcrumb segment (so the breadcrumb dot mirrors the tree dot).
- `childFolders: Array<{ name: string; href: string; noteCount: number }>` — public child folders.
- `childNotes: Array<{ title: string; href: string; date?: string }>` — public child notes.

**Sketch**:

```
HOME / AI / CLAUDE                                  <-- breadcrumb, mono uppercase
                                                        first segment carries cat dot

Claude                                              <-- folder name as page heading,
                                                        font-serif text-h1 text-heading

▸ folders                                           <-- mono section heading
─────────────────────────────────────────────
  ▸ ● claude prompt guide                4 notes    <-- child folders, leftmost dot if depth0
─────────────────────────────────────────────

▸ notes                                             <-- mono section heading
─────────────────────────────────────────────
  2026-04-26   opus-4.7 guide                      <-- child notes, mono date + sans title
  2026-04-12   opus-4.6 guide
─────────────────────────────────────────────
```

**Markup**:

```html
<article class="mx-auto max-w-[var(--measure-prose)]">
  <nav class="font-mono text-meta uppercase tracking-wider text-muted
              flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="breadcrumb">
    {breadcrumb.map((seg, i) => (
      <>
        {i === 0 && categorySlot && (
          <span class="folder-dot w-1.5 h-1.5 rounded-full"
                style={`background-color: var(--color-accent-cat-${categorySlot})`}
                aria-hidden="true" />
        )}
        {i < breadcrumb.length - 1 ? (
          <a href={seg.href} class="hover:text-link">{seg.label}</a>
        ) : (
          <span class="text-link" aria-current="page">{seg.label}</span>
        )}
        {i < breadcrumb.length - 1 && <span class="text-faded">/</span>}
      </>
    ))}
  </nav>

  <h1 class="mt-4 font-serif text-h1 text-heading">
    {breadcrumb[breadcrumb.length - 1].label}
  </h1>

  {childFolders.length > 0 && (
    <section class="mt-7" aria-labelledby="folders-heading">
      <h2 id="folders-heading"
          class="font-mono text-meta uppercase tracking-wider text-muted">
        ▸ folders
      </h2>
      <ul class="mt-3 border-y border-default divide-y divide-default">
        {childFolders.map(f => (
          <li>
            <a href={f.href}
               class="flex items-baseline justify-between gap-3 py-3
                      hover:bg-surface-strong px-3 -mx-3 rounded-md">
              <span class="flex items-baseline gap-2 font-sans text-body">
                <span class="text-faded" aria-hidden="true">▸</span>
                <span>{f.name}</span>
              </span>
              <span class="font-mono text-meta uppercase tracking-wider text-faded shrink-0">
                {f.noteCount} notes
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )}

  {childNotes.length > 0 && (
    <section class="mt-7" aria-labelledby="notes-heading">
      <h2 id="notes-heading"
          class="font-mono text-meta uppercase tracking-wider text-muted">
        ▸ notes
      </h2>
      <ul class="mt-3 border-y border-default divide-y divide-default">
        {childNotes.map(n => (
          <li>
            <a href={n.href}
               class="flex items-baseline gap-4 py-3
                      hover:bg-surface-strong px-3 -mx-3 rounded-md">
              {n.date && (
                <time class="font-mono text-meta uppercase tracking-wider text-faded shrink-0">
                  {n.date}
                </time>
              )}
              <span class="font-sans text-body">{n.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )}

  {childFolders.length === 0 && childNotes.length === 0 && (
    <p class="mt-7 text-muted">이 폴더에는 공개된 글이 없습니다.</p>
  )}
</article>
```

**States**:

- **default**: as drawn.
- **hover** on a folder/note row: `bg-surface-strong` fills the row's hit area (negative margin + padding to extend the hover rectangle slightly outside prose measure).
- **focus**: `--color-focus-ring` outline on the row's `<a>`.
- **active** (the current breadcrumb segment): last segment is `text-link` and carries `aria-current="page"`. There is no per-row active state on this page (the rows are nav targets, not the current selection).
- **empty (no public children)**: the entire section's `<ul>` and heading are omitted; if both lists are empty, the fallback `<p>` renders. The fallback copy is intentionally vague ("공개된 글이 없습니다") — it does not disclose whether the folder ever held private notes.

**Category accent application**: a single dot before the *first* breadcrumb segment (depth 0). Mirrors the tree's depth-0 dot for the same folder. Subsequent breadcrumb segments are uncolored (only the trailing segment, `aria-current="page"`, gets `--color-accent` via `text-link`).

**Mobile (`< 640px`)**: breadcrumb wraps; row hover gains tap-target padding. Section headings remain mono uppercase; row layout stays `flex items-baseline gap-4` with date wrapping under the title via `flex-wrap` if the row gets tight.

---

## `RecentRail` — `[New in v0.3]`

**Purpose**: home page's first rail — the most recent N public notes, chronological by `date` desc.

**Props**:

- `entries: Array<{ title: string; href: string; date: string; categorySlot?: 1|2|3|4|5 }>` — already filtered + sorted by `selectRecent(n)` in `packages/core` (step 7 of this phase).
- `limit: number` — max items to render. Default 10.
- `seeAllHref?: string` — link to a "all notes" page; if absent, the trailing affordance is omitted.

**Sketch**:

```
▸ recent                                            <-- mono section heading

─────────────────────────────────────────────
  ● 2026-04-26   opus-4.7 guide                    <-- cat dot + mono date + sans title
  ● 2026-04-19   wrangler 배포 노트
  ● 2026-04-12   opus-4.6 guide
  …
─────────────────────────────────────────────

→ all notes                                         <-- mono caps, --color-text-link
```

**Markup**:

```html
<section class="mt-7" aria-labelledby="recent-heading">
  <h2 id="recent-heading"
      class="font-mono text-meta uppercase tracking-wider text-muted">
    ▸ recent
  </h2>
  <ul class="mt-3 border-y border-default divide-y divide-default">
    {entries.slice(0, limit).map(e => (
      <li>
        <a href={e.href}
           class="flex items-baseline gap-3 py-3 px-3 -mx-3 rounded-md
                  hover:bg-surface-strong">
          {e.categorySlot && (
            <span class="folder-dot w-1.5 h-1.5 rounded-full shrink-0 self-center"
                  style={`background-color: var(--color-accent-cat-${e.categorySlot})`}
                  aria-hidden="true" />
          )}
          <time class="font-mono text-meta uppercase tracking-wider text-faded shrink-0"
                datetime={e.date}>
            {e.date}
          </time>
          <span class="font-sans text-body">{e.title}</span>
        </a>
      </li>
    ))}
  </ul>
  {seeAllHref && (
    <p class="mt-3 font-mono text-meta uppercase tracking-wider">
      <a href={seeAllHref} class="text-link hover:text-link-hover">→ all notes</a>
    </p>
  )}
</section>
```

**States**:

- **default**: as drawn.
- **hover** on a row: `bg-surface-strong` fills the row.
- **focus**: `--color-focus-ring` outline on the `<a>`.
- **active**: not applicable on home — Recent never marks the current page (home doesn't *have* a "current note").
- **empty (`entries.length === 0`)**: rail still renders with a fallback `<p class="text-muted">아직 공개된 글이 없습니다.</p>` (matches v0.2 Graph empty-state copy). Recent is not privacy-filtered the same way Featured is — an empty Recent rail on a brand-new vault is fine to acknowledge.

**Category accent application**: each row carries the dot for its first slug segment. Same slot-assignment as the FolderTree (so the same folder reads with the same color across surfaces).

**Mobile (`< 640px`)**: the row's `flex items-baseline gap-3` wraps the date under the title. Dot stays adjacent to the date.

---

## `FeaturedRail` — `[New in v0.3]`

**Purpose**: home page's second rail — author-curated featured notes, ordered by an explicit slug list in site config.

**Props**:

- `entries: Array<{ title: string; href: string; date?: string; categorySlot?: 1|2|3|4|5 }>` — already filtered + ordered by `selectFeatured(n)` in `packages/core` (step 7).
- `limit: number` — default 6.

**The empty rule**: `FeaturedRail` does **not render at all** when `entries.length === 0`. No heading, no fallback copy. An empty "Featured" heading is a privacy-adjacent leak signal ("there used to be a featured note here, then it got hidden"). This matches v0.2 `Backlinks` empty-state policy.

**Sketch**:

```
─────────────────────────────────────────────  <-- divider above the rail (border-t)

▸ featured                                       <-- mono caps, --color-accent-2 (forest moss)
                                                     ↑ second accent lives here

  ● 2026-03-02   privacy-first SSG라는 선택      <-- entries
  ● 2025-11-19   Obsidian 발행 도구 비교
```

**Markup**:

```html
{entries.length > 0 && (
  <section class="mt-9 pt-7 border-t border-default" aria-labelledby="featured-heading">
    <h2 id="featured-heading"
        class="font-mono text-meta uppercase tracking-wider text-accent-2">
      ▸ featured
    </h2>
    <ul class="mt-3 border-y border-default divide-y divide-default">
      {entries.slice(0, limit).map(e => (
        <li>
          <a href={e.href}
             class="flex items-baseline gap-3 py-3 px-3 -mx-3 rounded-md
                    hover:bg-surface-strong">
            {e.categorySlot && (
              <span class="folder-dot w-1.5 h-1.5 rounded-full shrink-0 self-center"
                    style={`background-color: var(--color-accent-cat-${e.categorySlot})`}
                    aria-hidden="true" />
            )}
            {e.date && (
              <time class="font-mono text-meta uppercase tracking-wider text-faded shrink-0"
                    datetime={e.date}>
                {e.date}
              </time>
            )}
            <span class="font-sans text-body">{e.title}</span>
          </a>
        </li>
      ))}
    </ul>
  </section>
)}
```

**States**:

- **default**: as drawn.
- **hover** / **focus**: same row treatment as RecentRail.
- **active**: not applicable.
- **empty**: section does not render. **Critical** — never render the heading "featured" with no items below it.

**Category accent application**:

- The section heading "▸ featured" uses `--color-accent-2` (forest-moss) — this is the only place the secondary accent appears on home. It is what *signals* "featured" without requiring a stronger surface treatment.
- Per-row category dots same as RecentRail.

**Mobile (`< 640px`)**: same row treatment; the section's top border + heading remain. The accent-2 heading color holds AA contrast on `--color-bg-page` in both modes (verified in TOKENS).

---

## Cross-component invariants

These are repeated above per-component but consolidated here so step 4–7 implementers cannot miss them:

1. **No new JS beyond v0.2's theme-toggle script.** FolderTree uses `<details>`. Sidebar drawer on `< lg` uses `<details>`. RecentRail / FeaturedRail are static lists.
2. **Privacy-filtered data only.** Every component receives data already filtered by `packages/core/src/privacy/`. Components do not filter; they render or omit. Empty-state policies are component-local (RecentRail acknowledges empty, FeaturedRail does not, AvatarBlock omits-when-incomplete, FolderTree omits empty folders entirely).
3. **`aria-current="page"`** is the only "active state" mechanism. No custom data attributes for the active row.
4. **Category accent reaches only**: depth-0 folder dot, FolderIndex first-breadcrumb dot, RecentRail row dot, FeaturedRail row dot. Nothing else (no row backgrounds, no full-width tints, no per-row hover variants).
5. **Secondary accent (`--color-accent-2`)** reaches only: AvatarBlock nickname (optional second-line accent — not styled in the markup above, available if a future variant wants it), FeaturedRail heading, FolderTree current-folder row text + soft bg. Nothing else.
6. **Iron-oxide (`--color-accent`)** continues to own: links inside body prose, `text-link` class anywhere, focus ring, heading anchor `#`, breadcrumb's last (current) segment.
