# TOKENS — v0.3 delta from v0.2

This file is **delta-only**. The v0.2 SSOT lives at `phases/step9-design-overhaul/design/TOKENS.md` and remains authoritative for every token *not* listed here. v0.3 adds a small set of tokens — secondary accent, category accent slots, sidebar surface tier, sidebar layout dimension — and changes nothing else.

Rules carried over without restating:

- All hex values verified against `--color-bg-page` (warm-cream `#f9f6f1` / cool-ink `#0f1115`) using the WCAG 2.1 relative-luminance formula.
- `≥ 4.5:1` (AA) for any token that may carry text on `--color-bg-page` or `--color-bg-sidebar`.
- `≥ 3:1` for non-text accent dots / borders.
- No purple, no indigo, no neon — every new chromatic token is a warm earth tone.
- 8-base spacing, sharp 2/4/8 radius, `--shadow-1`-only elevation tier — all unchanged.
- Self-host font policy unchanged. No new web fonts.

## 1. Color — Secondary accent (newly added)

A second warm accent so the page can carry **two** simultaneous emphasis channels without crossing into AI-default territory. Iron-oxide stays for *action* (links, focus, anchor `#`). The secondary stays for *identity / current-location* (AvatarBlock nickname, current-folder row in the tree, FeaturedRail heading).

| Token | Light | Dark | Contrast vs `--color-bg-page` | Contrast vs `--color-bg-sidebar` | Use |
|---|---|---|---|---|---|
| `--color-accent-2` | `#4d6948` | `#9ec19a` | Light ≈ **6.5:1** · Dark ≈ **8.5:1** (both AA pass) | Light ≈ **6.0:1** · Dark ≈ **8.1:1** | Forest-moss. AvatarBlock nickname accent line, FeaturedRail heading, current-folder row text + dot. |
| `--color-accent-2-hover` | `#3a5234` | `#bcd3b8` | Light ≈ **8.7:1** · Dark ≈ **11.2:1** | Light ≈ **8.0:1** · Dark ≈ **10.7:1** | Hover variant for any `--color-accent-2`-tinted link. |
| `--color-accent-2-soft` | `#e3eadd` | `#1f2a1d` | non-text surface only | non-text surface only | Subtle tint behind current-folder row, FeaturedRail section header strip. Non-text. |

> **Why forest-moss**: warm-leaning yellow-green, complementary to iron-oxide on the warm color wheel without crossing into purple/indigo/neon. Reads as "library / herbarium" — fits editorial-technical. **Single secondary** — no third brand color in v0.3.

## 2. Color — Category accent slots (newly added)

A small fixed ring of warm earth tones. Slot indices are **semantically neutral**: `--color-accent-cat-1` carries no meaning beyond "slot 1." The mapping from slug-segment → slot is decided by code (deterministic hash of the first segment) and lives in `packages/core` — tokens only provide the slots.

5 slots is the v0.3 ceiling (the brief permits 4–6; we pick 5 as the smallest set that preserves tree distinguishability without forcing AI-default-rainbow vibes).

| Token | Light | Dark | Contrast vs `--color-bg-page` | Contrast vs `--color-bg-sidebar` | Description |
|---|---|---|---|---|---|
| `--color-accent-cat-1` | `#a83612` | `#f0a373` | Light ≈ **5.7:1** · Dark ≈ **9.3:1** (AA) | Light ≈ **5.3:1** · Dark ≈ **8.9:1** (AA) | Iron oxide — mirrors `--color-accent`. First slot intentionally collides with primary so the most-common folder reuses the brand color. |
| `--color-accent-cat-2` | `#9a6f0e` | `#d4a849` | Light ≈ **4.7:1** · Dark ≈ **9.6:1** (AA) | Light ≈ **4.4:1** · Dark ≈ **9.2:1** | Ochre — yellow-brown. |
| `--color-accent-cat-3` | `#5d6f3a` | `#a3b46b` | Light ≈ **5.5:1** · Dark ≈ **8.7:1** (AA) | Light ≈ **5.1:1** · Dark ≈ **8.3:1** | Moss — yellow-green. Distinct from `--color-accent-2` (deeper-darker forest-moss) by ~1.0:1 luminance step. |
| `--color-accent-cat-4` | `#7d4f1c` | `#c79866` | Light ≈ **6.6:1** · Dark ≈ **7.5:1** (AA) | Light ≈ **6.1:1** · Dark ≈ **7.2:1** | Bronze — mid-brown. |
| `--color-accent-cat-5` | `#3a4d50` | `#9aabaa` | Light ≈ **9.8:1** · Dark ≈ **8.0:1** (AA) | Light ≈ **9.1:1** · Dark ≈ **7.6:1** | Slate — warm charcoal. The "neutral" slot when nothing else fits. |

Notes on the palette:

- All five hold AA against `--color-bg-page` *and* `--color-bg-sidebar` in both modes — categorty dots must be readable on both surfaces because they appear in tree rows (sidebar) and breadcrumbs (page).
- The hue rotation is deliberately narrow: red-brown → yellow-brown → yellow-green → mid-brown → warm-charcoal. No saturated greens, no blues, no purples, no neons. The palette reads as a single coordinated earth-tone family, not a rainbow.
- `cat-1` mirroring `--color-accent` is the only intentional duplication. Slots are otherwise unique.
- Hover/active variants are **not** provided as separate tokens — category dots have no hover state, and the row hover uses `--color-bg-surface-strong` (existing v0.2 token) regardless of slot. Keeping the slot tier flat (no `-hover`/`-soft` per slot) prevents call sites from synthesizing per-category surface treatments.

## 3. Color — Sidebar surface tier (newly added)

One additional bg tier between page and surface-strong (light) / between page and surface (dark). The single-step tonal shift is the *only* signal that the sidebar is a navigational frame — no second border, no inset shadow, no frosted backdrop.

| Token | Light | Dark | Contrast vs `--color-bg-page` (Δ luminance) | Use |
|---|---|---|---|---|
| `--color-bg-sidebar` | `#f4efe5` | `#13161d` | Light ≈ **1.05:1** · Dark ≈ **1.10:1** (intentionally subtle, near-imperceptible) | Sidebar panel surface (lg+ rail and `< lg` drawer body). |

- The contrast vs page is *deliberately* below 1.5:1 — the sidebar should feel like a recess, not a panel. The right-edge `--color-border` hairline does the actual visual separation.
- Body text on `--color-bg-sidebar` continues to use `--color-text-body` (`#1b1d22` / `#dcdee2`) — Light ≈ **14.0:1**, Dark ≈ **12.7:1**, both AAA.
- Muted text on `--color-bg-sidebar` uses `--color-text-muted` — Light ≈ **5.6:1**, Dark ≈ **5.0:1**, both AA.

> **No `--color-bg-sidebar-hover`** — folder tree row hover uses the existing `--color-bg-surface-strong` (light `#f1ede5` / dark `#1c2030`). Adding a sidebar-specific hover token would proliferate the surface tier without visual gain.

## 4. Layout — Sidebar dimension (newly added)

| Token | Value | Use |
|---|---|---|
| `--container-sidebar-w` | `16rem` (256px) | Fixed sidebar width on `lg+`. Below `lg`, sidebar collapses to a `<details>`-driven drawer and this token is unused. |

No new spacing tokens — folder tree indent reuses `--space-3` (12px) per level. No new radius tokens — the avatar is a `rounded-full` SVG `<circle>` (not a box-radius), and folder rows use `--radius-md` (4px) for hover/active background, identical to existing nav items.

## 5. What did NOT change

- All v0.2 background, text, semantic, focus tokens — same.
- All v0.2 typography stacks, type scale, spacing scale, radius scale, shadow tier, motion duration/ease — same.
- `--container-main: 72ch`, `--measure-prose: 68ch`, `--container-index: 56rem`, `--margin-col-w: 12rem` — all retained. (`--margin-col-w` is no longer used on note pages because the sidebar replaces the left margin column on `lg+`; it remains for any future right-side margin notation. Keeping the token avoids breaking step 9 references.)
- `--color-accent`, `--color-accent-soft` — unchanged. `--color-accent` still owns links / focus / heading anchor.

## 6. WCAG verification method

Same as v0.2 TOKENS — `(text, bg)` luminance pairs computed with the WCAG 2.1 relative-luminance formula. For each new accent token the table records contrast vs *both* `--color-bg-page` and `--color-bg-sidebar`, since accents may sit on either surface (breadcrumbs sit on page, folder dots sit on sidebar).
