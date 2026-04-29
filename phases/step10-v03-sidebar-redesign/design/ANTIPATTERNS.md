# ANTIPATTERNS — v0.2 → v0.3 policy

This document is the SSOT for any v0.3 update to `docs/UI_GUIDE.md` (step 1 of this phase). It carries v0.2's seven banned patterns *verbatim* and adds a single new section for the v0.3 chromatic loosening — together with the explicit limits that prevent that loosening from drifting into AI-default territory.

Three tables:

1. The seven v0.1 → v0.2 banned patterns, reproduced as-is. None of these soften in v0.3.
2. The v0.2-introduced motifs and their limits, reproduced as-is. None of these change in v0.3.
3. The v0.3 chromatic extension (newly added) — what it admits, what it explicitly forbids.

## 1. v0.1 → v0.2 banned patterns (carried into v0.3 unchanged)

This table is a verbatim copy of `phases/step9-design-overhaul/design/ANTIPATTERNS.md` §"v0.1 → v0.2 (existing 7 anti-patterns)". Every row remains banned in v0.3.

| Anti-pattern | v0.1 policy | v0.2 policy | v0.3 policy | Rationale (why retain) |
|---|---|---|---|---|
| `backdrop-filter: blur()` (glass morphism) | banned | keep banned | **keep banned** | The most legible AI-template tell. Editorial direction has zero functional use for it; its only purpose is decorative atmosphere, and our sole atmosphere is the page color (`--color-bg-page`). v0.3 sidebar does *not* use a frosted backdrop — it sits on `--color-bg-sidebar` (a one-step tonal recess) with a single hairline right border. |
| Gradient text (`background-clip: text` on `h1` etc.) | banned | keep banned | **keep banned** | SaaS-landing cliché; clashes with letterpress serif headings — a serif `h1` rendered with a CSS gradient is instantly the "AI hero" cue we want to refuse. Folder names, breadcrumbs, rail headings in v0.3 stay solid color. |
| "Powered by AI" / generated badges | banned | keep banned | **keep banned** | Decoration, not function. No badge in v0.3 either. The only attribution surface remains the v0.2 footer mono line. |
| Box-shadow neon glow / pulse animation | banned | keep banned | **keep banned** | Distinctive surfaces in v0.3 still come from hairline borders + accent color, not glow. Token tier still exposes a single `--shadow-1` (1px hairline only); no glow scale exists, so call sites can't synthesize one. v0.3 introduces no new shadow tokens. |
| Purple / indigo brand color | banned | keep banned | **keep banned** | Iron-oxide (`#a83612` light / `#f0a373` dark) remains the primary accent; v0.3 adds **forest-moss** (`#4d6948` / `#9ec19a`) as the secondary accent — both warm earth tones. Purple/indigo single-tone branding remains explicitly forbidden, *and* purple/indigo are forbidden inside the new category accent slots (`--color-accent-cat-1` … `-5` are all warm earth tones — see §3 below). |
| Uniform `rounded-2xl` everywhere | banned | partial allow (radius scale = `2 / 4 / 8 px` only) | **keep partial allow (no v0.3 changes)** | The point is *intentional variance*, not "soft pills everywhere". Inline code uses `--radius-sm` (2px), chips/buttons use `--radius-md` (4px), embed aside / image / code block use `--radius-lg` (8px). v0.3 adds no new radius tokens. The avatar in `AvatarBlock` is a `rounded-full` SVG-style circle (one image, intentional choice — *not* a global pill applied to every element); folder rows, rail rows, breadcrumb dots all stay within the 2/4/8 scale. |
| Background gradient orbs (`blur-3xl` blobs) | banned | keep banned | **keep banned** | Atmosphere comes from the warm-cream / cool-ink page color alone. Layered backdrops, mesh gradients, noise overlays, and texture filters are forbidden on `--color-bg-page` *and* on `--color-bg-sidebar`. The sidebar's tonal recess is a single flat fill, not a gradient. |

## 2. v0.2-introduced motifs and limits (carried into v0.3 unchanged)

This table is a verbatim copy of `phases/step9-design-overhaul/design/ANTIPATTERNS.md` §"v0.2 — newly introduced motifs (with explicit limits)". Every row remains in force in v0.3.

| Motif | Where allowed | Limit / forbidden use | v0.3 status |
|---|---|---|---|
| **Side-margin notation grid** (12rem column on `lg+` for heading anchors, dates, tags) | `BaseLayout` main grid; `Note` heading anchors and meta mirror | Text and numerals only. Never decorative shapes, never illustrative artwork, never images. Collapses inline on `< lg`. | **Subsumed on the left** — v0.3 sidebar takes the left rail. The 12rem margin column may persist as a *right* gutter if a later step ships side-anchored note metadata; today it is unused on note pages. The token (`--margin-col-w`) is retained for future right-side use. |
| **Monospace accent** (JetBrains Mono / D2Coding for meta, kbd, language labels, brand mark, nav) | meta rows under `h1`, code blocks, language chip, brand mark, footer, nav | Never run body in mono. Never set `h1`–`h4` in mono (serif/sans only). Never style links inside body prose in mono — links sit in body context and inherit `--font-sans`. | **Unchanged** — v0.3 sidebar nav links and rail section headings (`▸ recent`, `▸ featured`) are mono uppercase per this rule; folder names in the tree and rail row titles stay sans body. |
| **Letterpress serif headings** (Source Serif 4 / Noto Serif KR for `h1`–`h3`) | `h1`, `h2`, `h3` in `Note` and page-title slots | Never serif for body, never serif for `h4+` (h4 stays sans for hierarchy contrast), never serif for UI chrome (nav, buttons, chips, footer). | **Unchanged** — `FolderIndex` page heading is `font-serif text-h1`; rail section headings are `font-mono text-meta` (treated as UI chrome, *not* h2/h3 in serif). The `AvatarBlock` nickname uses `font-sans text-h4` per the existing rule that h4 is sans. |
| **Hairline rules instead of shadows** (1px `--color-border` everywhere; single optional `--shadow-1` for sticky header on scroll) | section dividers, cards, embed aside, table rows, header on scroll | Never use shadow as elevation hint on cards / asides / chips — they get borders. No multi-step shadow scale exists at the token level. | **Unchanged** — the sidebar–main separation is a single right border on the sidebar, no shadow. Rail rows use `divide-y` hairlines. v0.3 introduces no new shadow tier. |
| **Paper-cream / cool-ink page color as sole atmosphere** (`--color-bg-page`) | every page in both modes | Never overlay gradients, mesh, orbs, noise, or texture filters on top of the page bg. The page color *is* the atmosphere; nothing else stacks on it. | **Extended carefully** — v0.3 adds one additional surface tier (`--color-bg-sidebar`) that sits beside the page bg, not on top. The rule "no overlays on the page bg" is unchanged. The new tier is itself a flat fill — no gradients, no textures, no overlays. |

## 3. v0.3 chromatic extension (newly introduced — with explicit limits)

The single thing v0.3 admits: **a wider chromatic system** — one secondary accent + five category accent slots + one new sidebar surface tier. This section names what is now allowed *and* the limits that prevent the loosening from drifting into the seven banned patterns above.

### 3a. What v0.3 newly admits

| New chromatic motif | What it adds | Where applied |
|---|---|---|
| **Secondary accent** (`--color-accent-2`, `-hover`, `-soft`) | One additional warm earth tone — forest-moss `#4d6948` / `#9ec19a` — for *identity / current-location* emphasis, parallel to but distinct from iron-oxide's *action* role. | `FeaturedRail` heading; `FolderTree` current-folder row (text + soft bg); optional `AvatarBlock` nickname accent line. **Nothing else.** |
| **Category accent slots** (`--color-accent-cat-1` … `-5`) | Five neutrally-named warm earth tones (iron oxide, ochre, moss, bronze, slate) for color-coding the first slug segment of each note. Slot indices carry no semantic meaning — slot→segment mapping is a deterministic build-time decision in `packages/core`. | Depth-0 dot in `FolderTree`; first-segment dot in `FolderIndex` breadcrumb; per-row dot in `RecentRail` and `FeaturedRail`. **Nothing else.** Dots are 6×6px circles, color via inline `style="background-color: var(--color-accent-cat-N)"`, never via class names that encode the slot. |
| **Sidebar surface tier** (`--color-bg-sidebar`) | One additional bg tier — a single tonal step warmer-darker than `--color-bg-page` (light) / lighter (dark) — for the navigational recess of the sidebar panel. | Sidebar panel only (lg+ rail and `< lg` drawer body). **Nowhere else.** No modal, no popover, no card uses this surface. |

### 3b. What v0.3 chromatic extension explicitly forbids

These limits are non-negotiable. Reviewers should reject any v0.3 PR that crosses them.

| Forbidden | Why |
|---|---|
| **Cool / saturated / non-warm category slots.** No blues, no purples, no neons, no fluorescent greens. Every `--color-accent-cat-N` must be a warm earth tone (red/orange/yellow/yellow-green/warm-brown/warm-charcoal). | The chromatic loosening was approved on the assumption that all new colors stay *warm earth tones* coordinated with the iron-oxide / cream / ink palette. Cool colors would re-introduce the AI-default rainbow we refused in v0.2. |
| **More than 5 category slots.** No `--color-accent-cat-6+` token, even if a vault has more first-level folders than 5. | When a sixth folder needs a slot, the slot-assignment hashing in `packages/core` reuses an existing slot. A larger ring would force the palette into hue territory that is no longer warm-coordinated. |
| **Per-slot hover / soft / active variants.** No `--color-accent-cat-1-hover`, `--color-accent-cat-1-soft`, etc. | Category dots have no hover state. Row hovers use `--color-bg-surface-strong` regardless of slot. Allowing per-slot variants would let call sites build per-category surface treatments (full-row tints, gradient backgrounds, "Project X is the purple one" branding) — which is the kind of multi-color brand system explicitly forbidden by §1's purple/indigo row. |
| **Gradients between accents.** No `linear-gradient(--color-accent, --color-accent-2)`, no animated color cycles, no mesh fills using the cat slots. | §1's "gradient text" and "background gradient orbs" rows still apply. Accents are flat fills — for text or for tiny dots — never gradient stops. |
| **New surface tiers beyond `--color-bg-sidebar`.** No `--color-bg-modal`, `--color-bg-popover`, `--color-bg-rail`, etc. | The v0.2 surface tier (page / surface / surface-strong / code) plus the new sidebar tier is the entire ladder. Adding more tiers would re-introduce the multi-elevation feeling the `--shadow-1`-only rule was designed to prevent. |
| **Texture, noise, gradient, or mesh on `--color-bg-sidebar`.** | Same as the rule for `--color-bg-page` in §1. The sidebar surface is a flat fill; the recess is the only effect. |
| **Radius-scale changes.** No `--radius-xl`, `--radius-2xl`, `--radius-full`, `--radius-pill`. | §1's "uniform `rounded-2xl`" row still applies. The avatar's `border-radius: 9999px` is a per-instance image treatment, not a token; a future PR cannot generalize it into a reusable "pill" token. |
| **Multi-step shadow tier.** No `--shadow-2`, `--shadow-md`, `--shadow-lg`. | §1's "neon glow / pulse" row still applies. The sidebar edge uses a 1px hairline border — never a shadow. |
| **Color-only state indicators.** Active / current-page state must combine `--color-accent-2` text *with* `--color-accent-2-soft` background (or `aria-current="page"` for assistive tech), never color alone. | WCAG 1.4.1 — information must not be conveyed by color alone. The v0.3 active row meets this via the bg-soft tint *and* the aria attribute. |
| **Color-coding private state.** No "lock icon" or grey tint or any visual signal that says "there's a private note here." | Privacy contract from `docs/UI_GUIDE.md` §14 (v0.2). A sixth category slot used for "hidden" would be a leak. The chromatic system is for *public structure*, not for hinting at filtered content. |

### 3c. Non-changes from v0.2

For absolute clarity — these rules from v0.2 are *not* loosened in v0.3 and apply unchanged:

- The seven banned patterns in §1.
- The five v0.2 motifs and their limits in §2.
- WCAG AA 4.5:1 minimum for body text and any text-bearing accent token (verified per-token in `TOKENS.md`).
- `prefers-reduced-motion: reduce` zeroes all motion durations.
- Self-host font policy — no Google Fonts / Bunny / any CDN.
- Privacy visual contract from v0.2 `UI_GUIDE.md` §14 — six items, all carried over verbatim.

## 4. Notes for downstream steps in this phase

- **Step 1** (`docs/UI_GUIDE.md` rewrite) must restate every "keep banned" row from §1 and every "v0.3 forbids" row from §3b so the user-facing guide remains the canonical reference for fork users — `phases/` documents are internal.
- **Step 2** (`tokens.css` extension) enforces several of these editorially via the token tier itself: only 5 cat slots are exposed, no per-slot hover variants exist, no second sidebar tier exists, no new shadow tier exists. Reviewers should reject new tokens that re-introduce a banned axis.
- **Step 4–7** (component implementations) treat §3b as a hard checklist. Any PR that adds a per-category surface treatment, a gradient between accents, or a new surface tier should be rejected at review.
- **Step 9** (privacy TDD) verifies the chromatic system does not leak private state via color — fixture must contain a private note in a folder also containing public notes, and the resulting public folder color must be identical regardless of how many private notes the folder holds.
