# Plan — Social icons in header + "Categories" sidebar label

## Context

v0.3 has shipped the sidebar / folder tree / identity block, but two header/sidebar polish items remain:

1. **No way for the blogger to expose contact channels.** The footer hardcodes a "source" GitHub link to the project repo, but there's no surface for the *blogger's* GitHub / email. We need a configurable social-icon block that's **opt-in**: bloggers who don't want it should not see it, and the channels (GitHub URL, email) should come from `obsidian-blog.config.ts`.
2. **Sidebar has no section label.** `FolderTree.astro` jumps straight from the avatar block into folder rows. Users need a single-word kicker (e.g. "Categories") at the very top so the column is self-describing — matches the same `mono / meta-text / uppercase` heading pattern already used by `.backlinks__heading` (components.css:22-30).

Both changes are presentational; nothing here touches `packages/core/src/privacy/**`, so the canary fixture (`DO_NOT_LEAK_BANANA_6f3c1`, etc.) is unaffected.

User decisions (confirmed):
- Sidebar label text: **"Categories"** (English plural). Rendered uppercase via existing heading style.
- Social channels in v1: **GitHub + Email only**. Schema is shaped to accept more later without a breaking change.
- Header placement: **inline inside `.header-actions`**, immediately before the existing theme-toggle button. Reuses `.icon-button` styling — zero new layout CSS for the header.

---

## Files to change

### 1. Config schema — `packages/core/src/config.ts`

Add a `socialSchema` and wire it into `siteSchema`. Both fields optional; `social` itself is optional. **Presence-based opt-in**: omit the block (or omit the individual field) and nothing renders. There is no separate `enabled: boolean` toggle — that would be redundant with field presence and add an extra failure mode.

```ts
const socialSchema = z
  .object({
    github: z.string().url('유효한 URL이어야 합니다').optional(),
    email: z.string().email('유효한 이메일 주소여야 합니다').optional(),
  })
  .optional();

// inside siteSchema (after `nickname`, before the closing `})`):
social: socialSchema,
```

`github` is a full URL (e.g. `https://github.com/lim010111`) rather than a username — keeps the rendering trivial (`<a href={github}>`) and matches the footer's existing convention (BaseLayout.astro:106). `email` is a bare address; the component prepends `mailto:`.

### 2. Theme types — new `packages/theme-default/src/components/SocialLinks.types.ts`

```ts
export interface SocialLinksProps {
  github?: string;
  email?: string;
}
```

Parallel to the core schema (theme can't import from core for runtime types — Zod adds a build dep). Keeps the contract typed at the prop boundary.

### 3. New component — `packages/theme-default/src/components/SocialLinks.astro`

Tiny stateless renderer. Renders nothing if both fields are absent. For each present field, emits an `<a class="icon-button">` with an inline SVG (matches the theme-toggle / hamburger pattern in BaseLayout.astro:55-73; no `astro-icon` dep).

- GitHub icon: official GitHub mark, `fill="currentColor"`, `viewBox="0 0 24 24"`.
- Email icon: stroke-style envelope, `stroke="currentColor"`, `viewBox="0 0 24 24"` — visual weight matches the sun/moon/hamburger icons.
- Wrapper: `<span class="social-links" role="list">` so AT users get a clean group; each link has `aria-label="GitHub"` / `aria-label="이메일"` (Korean, matching the existing `aria-label="테마 전환"` / `aria-label="메뉴"` convention in BaseLayout).
- Outbound link hardening: `target="_blank" rel="noopener noreferrer"` for the GitHub link (matches footer convention, BaseLayout.astro:106). The mailto link doesn't need either.
- Empty-render guard: if `github === undefined && email === undefined`, return `null` (`{props.github === undefined && props.email === undefined ? null : ...}`). Renders no wrapper, no whitespace.

### 4. Layout types — `packages/theme-default/src/layouts/BaseLayout.types.ts`

Add `social?: SocialLinksProps` to `BaseLayoutProps`. Field-level (matches the existing comment on this file forbidding raw frontmatter blobs).

### 5. BaseLayout wiring — `packages/theme-default/src/layouts/BaseLayout.astro`

- Import `SocialLinks` from `../components/SocialLinks.astro`.
- Destructure `social` from `Astro.props`.
- Render `<SocialLinks {...social} />` **inside `.header-actions`, immediately before the existing `<button id="theme-toggle">`** (line 55). The component itself returns nothing when both fields are empty — no conditional needed at the call site.

The `.header-actions` flex container already has `gap: var(--space-2)` (layout.css:101-105), so spacing falls out for free. No change to mobile drawer behaviour: the icons live in the always-visible action bar, so they're reachable on every viewport without a second copy in `<details>`.

### 6. Theme exports — `packages/theme-default/src/index.ts`

Export `SocialLinks` and its types alongside the existing `Sidebar` / `AvatarBlock` exports. Required so `apps/blog` pages can pass `social` through (and so any consumer building an alternate layout can opt in).

### 7. Page wiring — `apps/blog/src/pages/*.astro` (6 files)

Pages that already render `<BaseLayout … sidebar={sidebar}>` need to also forward `social`:

- `apps/blog/src/pages/index.astro:38`
- `apps/blog/src/pages/404.astro:10`
- `apps/blog/src/pages/graph.astro:30`
- `apps/blog/src/pages/[...slug].astro:171, 183, 193` (three call sites)
- `apps/blog/src/pages/tags/index.astro:18`
- `apps/blog/src/pages/tags/[tag].astro:31`

Each gets `social={obpubConfig.site.social}`. `obpubConfig` is already imported in every one of these files (existing pattern, see `siteName={obpubConfig.site.title}` on each line above).

### 8. Dogfood config — `apps/blog/obsidian-blog.config.ts`

Add a `social` block under `site` so the dogfood site demonstrates the feature:

```ts
site: {
  title: 'shine notes',
  url: 'https://noteforge.pages.dev',
  author: 'shine',
  social: {
    github: 'https://github.com/lim010111',
  },
},
```

Only `github` is set (the URL is already public in the footer, BaseLayout.astro:106). Email is intentionally left for the user to add manually — committing a personal email into the repo is the user's call, not the agent's.

### 9. Sidebar label — `packages/theme-default/src/components/FolderTree.astro`

Inside the `!isBranch && !isEmpty` branch (lines 100-155), at the **top of the `<nav>`, before `<ul>`**, add:

```astro
<h2 class="folder-tree__heading">Categories</h2>
```

Important: only in the root render path. The branch render (line 156, `<ul class="folder-tree__children">`) is recursion and must stay heading-free.

Empty-tree behaviour preserved: when `isEmpty` the `<nav>` (and now the heading) renders nothing, so users with zero public folders don't see an empty "Categories" kicker — that would be a leak signal of "there used to be folders here", per the privacy doc-comment at FolderTree.astro:19-20.

### 10. Sidebar label CSS — `packages/theme-default/src/styles/components.css`

Add a new rule next to the `.folder-tree` block (around line 261):

```css
.folder-tree__heading {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  font-weight: var(--weight-meta);
  letter-spacing: var(--ls-meta);
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-3) 0;
}
```

Direct re-use of the `.backlinks__heading` token set (components.css:22-30) — visually consistent with the only other section-label in the theme, while keeping the class scoped to its component.

### 11. Header social-link CSS — `packages/theme-default/src/styles/layout.css`

Minimal addition near `.header-actions` (line 101):

```css
.social-links {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}
```

The child `<a>` elements inherit all visual styling from `.icon-button` (1.75rem square, hover swap, SVG sizing). The wrapper exists only to keep group spacing tighter than `.header-actions`'s own `gap: var(--space-2)`, so the social icons read as a unit distinct from the theme toggle.

---

## Why presence-based toggle (and not `social.enabled: boolean`)

The user asked for an On/Off setting. Two ways to express that:

- **Presence-based**: omit `social` (or its fields) → off. *Chosen.*
- **Explicit boolean**: `social: { enabled: false, github: '...', email: '...' }`.

Presence-based is the Astro/SSG idiom, mirrors how `avatar` and `nickname` already work in this exact `siteSchema`, and removes a footgun where someone leaves `enabled: false` while populating fields and is confused why nothing renders. The "off" path is `delete site.social`; the "on" path is `add social: { github: '...' }`. That's strictly what the user asked for ("연동을 원하지 않는 블로거는 끌 수 있게").

---

## Verification

**Type & lint (project commands from CLAUDE.md):**
```
pnpm -r typecheck
pnpm lint
```

**Unit tests (privacy canary must stay green):**
```
pnpm test
```
No privacy-touching code changes, but `packages/core/tests/config.test.ts` may need a tiny addition asserting `siteSchema` accepts `social` and rejects bad URLs/emails — drop in two new cases.

**Build the dogfood site:**
```
pnpm --filter blog build
```
Should succeed; audit pass continues to run as part of the build script.

**Manual visual check:**
```
pnpm --filter blog dev
```
1. Open `/` — confirm `[GH]` icon appears in the right side of the header next to the theme toggle, hovers swap to `--color-text-heading`, click opens `https://github.com/lim010111` in a new tab.
2. Confirm `CATEGORIES` (uppercase, mono, muted) sits above the folder list in the left sidebar at viewport ≥ lg, and inside the `<details>` mobile drawer below lg.
3. Comment out `social` in `apps/blog/obsidian-blog.config.ts` → dev server hot-reloads → no icons rendered, no DOM whitespace remnant.
4. Set an empty vault (or a vault where every note is private) and confirm the sidebar shows neither folders nor a stray "CATEGORIES" heading (privacy: empty section labels are themselves a leak signal).

---

## Out of scope (explicit non-goals)

- Twitter / X / LinkedIn / RSS icons. Schema is shaped (`socialSchema` is a `z.object`) so they slot in with one line each later; not adding now to keep the diff tight per CLAUDE.md ("작은 PR 선호").
- Avatar / nickname changes. The identity block is its own feature.
- Mobile-drawer copy of social icons. Icons live in `.header-actions` which is always visible; a second copy inside `<details>` would just duplicate without adding value.
- i18n. The label string `"Categories"` is hardcoded — the codebase has no translation layer (mixed Korean/English hardcoded strings throughout), introducing one for two strings is overengineering.
