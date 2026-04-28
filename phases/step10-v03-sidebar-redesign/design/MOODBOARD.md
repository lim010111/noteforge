# MOODBOARD — v0.3 Sidebar Redesign

## Direction (one paragraph)

v0.3 is **v0.2 editorial-technical with a navigational spine**. Same warm-cream / cool-ink page color as the sole atmosphere, same serif/sans/mono triad (Source Serif 4 / Inter / JetBrains Mono with KR mirrors), same hairline-elevation discipline. What changes is the *page architecture*: a persistent left sidebar carries an avatar+nickname identity block and a JS-less folder tree, the home page opens with two horizontal rails (Recent + Featured) instead of a flat chronological list, and the chromatic system widens just far enough to give the folder tree a quiet color-coded shape. Every v0.2 anti-pattern (glass morphism, gradient text, "AI" badges, neon-glow shadows, purple/indigo branding, uniform `rounded-2xl`, gradient-orb backdrops) remains banned. The shift is **navigational depth**, not **decorative loosening**.

## What stays from v0.2 (must not change)

- `--color-bg-page` warm-cream `#f9f6f1` (light) / cool-ink `#0f1115` (dark) as the only atmosphere — no overlays.
- Serif/sans/mono triad — same self-host policy under `apps/blog/public/fonts/`.
- Iron-oxide `#a83612` / `#f0a373` remains the **primary** accent (links, focus ring, heading anchor `#`).
- 8-base spacing scale, sharp 2/4/8 radius scale, single `--shadow-1` (sticky header on scroll only).
- Privacy visual contract from v0.2 §14 — strip-to-text wikilinks, AST-removed embeds, allowlist frontmatter, filtered backlinks/graph.
- All seven banned anti-patterns from `phases/step9-design-overhaul/design/ANTIPATTERNS.md` stay banned (see §3 of `ANTIPATTERNS.md` in this folder for the verbatim table).

## References

| # | Reference | Steal | Don't |
|---|-----------|-------|------|
| 1 | **Obsidian's own desktop sidebar** | Avatar+vault-name at top, indented folder tree below, current-folder highlight is a tinted row not a heavy fill, chevrons rotate without cards. | Multi-pane workspace with tabs / split view — we are reading-only and stay one column on the right. |
| 2 | **Are.na "channel" sidebars** | Quiet color dots beside categories, mono caps for meta, hairline dividers between groups, density without crowding. | Channel-card piles in the main column — our right side is editorial reading, not card grazing. |
| 3 | **Stripe Press → Stripe Docs nav** (press.stripe.com / docs.stripe.com) | Persistent left rail with restrained hover state, current page highlighted by *color* not *shadow*, mono labels above link groups. | Dense product-doc nav with versions/regions selectors — we have one vault, one tree. |
| 4 | **Linear changelog left rail** (linear.app/changelog) | Hairline border between sidebar and main, single-step recess for the sidebar surface, nickname/handle treated as quiet identity not "logged-in user" chrome. | Branded color blocks behind the avatar — we want the page color to read through. |
| 5 | **Robin Sloan's RSS list** (robinsloan.com) | Two-rail home (currently-writing + long-standing) with mono section headings, hand-edited feel, items as bordered rows not lifted cards. | Idiosyncratic per-post layouts — our rails must hold across many notes. |
| 6 | **Substack archive page in reader-default theme** | Recent rail as a vertical list of bordered rows, not a card grid; Featured rail's affordance comes from copy + a small dot, not a "premium" surface treatment. | Cover-image hero per post — covers stay frontmatter-allowlisted but the rail does not stage them as heroes. |

## Core visual motifs (v0.3 new)

1. **Left sidebar (16rem on lg+) as the navigational spine** — persistent across every route, recessed by one tonal step from the page color, separated from main by a single hairline border. On `< lg` the sidebar collapses into a JS-less `<details>` drawer triggered by the existing v0.2 mobile-menu pattern (no new toggle script).
2. **AvatarBlock as identity, not chrome** — round avatar + nickname (+ optional mono handle line) at the top of the sidebar. **Empty-when-absent**: if either `avatarSrc` or `nickname` is missing, the entire block does not render — no initials fallback, no placeholder silhouette, no "Anonymous" copy. (Privacy-adjacent: a placeholder is a signal that *someone* is hidden.)
3. **JS-less folder tree** — `<details>` on the chevron `▶` only; the folder name is a sibling `<a href="/<path>/">` that stays visible whether the folder is open or closed. Children `<ul>` is what actually toggles. CSS overrides the default `<details>` cascade so the link is always rendered. ARIA: `<nav aria-label="Folder tree">` + `<ul>` + `aria-current="page"` on the active row. **No `role="tree"` and no keyboard-arrow handler** — we are not committing to a full tree-widget contract. Tab/Enter/Space cover everything natively.
4. **Two-rail home** — `RecentRail` (10 items, chronological by `date` desc) then `FeaturedRail` (≤6 items, ordered by `frontmatter.featured` slug list). The rails are *vertical lists of hairline-bordered rows*, not card grids — they share the row treatment used on `FolderIndex` so two surfaces read as one system. **Empty Featured rail does not render** (privacy contract: a "Featured" heading with no content is a signal of filtered private notes).
5. **Quiet category accents** — first-level folder rows in the tree carry a small color dot in their accent slot. Each segment hashes deterministically to one of `--color-accent-cat-1`…`-5` (computed at build time, stable across runs). The accent reaches no further than the dot itself + the matching breadcrumb segment color on `FolderIndex`. Folder rows themselves stay body-colored.
6. **Sidebar surface tier as a single recess** — `--color-bg-sidebar` is one step warmer-darker than `--color-bg-page` in light, one step lighter in dark. The visual cue that "this is a navigational frame, not the main reading surface" comes from this single-step tonal shift plus the right-edge hairline. No second border, no inset shadow, no frosted backdrop.

## Wireframe interpretation — what we keep / change

### `refs/main_page.png` — home

| Wireframe element | What we keep | What we change |
|---|---|---|
| Round avatar at top-left | yes — `AvatarBlock` 64px circle in sidebar header, hairline border, no shadow | only renders when *both* `avatarSrc` and `nickname` are configured; otherwise the block is omitted entirely |
| `limwoohyun (github name)` text line | yes — sans `text-h4` nickname; optional second line below | optional second line is `text-meta` mono uppercase for the github handle, separated by tracking not parentheses |
| Indented `> AI / > Gemini / > Claude / …` tree | yes — `FolderTree` with `<details>` chevron + sibling link, depth indent `--space-3` (12px) per level | first-level folder rows carry the category accent dot; deeper levels do not (avoids over-coloring) |
| Two right-side stacks (Recent Post / 커스텀 Post 모음) | yes — `RecentRail` then `FeaturedRail` stacked vertically with a `border-t border-default` divider | the wireframe's bordered "card boxes" are diagrammatic — we render hairline-bordered rows (one row per entry), not card piles. Heavy cards would re-trigger v0.2's "uniform rounded card" anti-pattern. |
| Title-only items in each rail | yes — title is the headline | each row also carries a mono date (right-aligned on `lg+`, wraps under title on mobile) and a category dot for the first slug segment |
| `:` continuation glyph at bottom | yes — only when truncated | replaced with mono "→ all notes" / "→ all featured" link, not a literal ellipsis |

### `refs/parent_page.png` — folder index

| Wireframe element | What we keep | What we change |
|---|---|---|
| Same left sidebar | yes — `Sidebar` is identical across all routes | `aria-current="page"` lands on the folder name in the tree; that row gets the `--color-accent-soft` background |
| `AI / Claude` breadcrumb at top | yes — mono uppercase, `/` separator, last segment in `text-link` (iron-oxide) | each non-last segment is a link to its own folder index; the *first* segment additionally carries the category accent dot to mirror the tree |
| `opus-4.7 guide` / `opus-4.6 guide` rectangles | yes — child notes rendered as a list | rendered as hairline-bordered rows (same treatment as RecentRail), not boxed cards |
| (implied) child folders not shown in PNG but present in tree | new — `FolderIndex` lists immediate child *folders* above the child *notes* with `▸` glyph, mirroring Obsidian's open-folder view | this is the new bit beyond the wireframe — folders come first, then notes, separated by a hairline divider |
| `: :` ellipsis | yes — pagination affordance | only rendered when `children.length > rendering limit`; otherwise omitted |

## The single thing the user should remember

> **"The vault has a shape now."**
> v0.2 made each note look designed; v0.3 makes the *whole* readable as a structure the moment a reader lands. The right column is still the same dignified reading surface — we just gave it a frame.
