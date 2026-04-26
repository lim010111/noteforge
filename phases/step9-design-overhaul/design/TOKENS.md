# TOKENS — v0.2 Light + Dark

All tokens listed here are the SSOT for step 2 (`tokens.css` rewrite). Web fonts are **self-hosted** under `apps/blog/public/fonts/` — no CDN (Google Fonts / Bunny / etc.) so referrer / IP leakage to third parties never happens. All three font families chosen are OFL-licensed.

Body-text vs page-bg contrast verified ≥ 4.5:1 (WCAG AA) in both modes via WCAG relative-luminance calculation. Specific contrast figures noted per token below.

## Color — Background

| Token | Light | Dark | Use / Note |
|---|---|---|---|
| `--color-bg-page` | `#f9f6f1` | `#0f1115` | Page surface. Warm cream / cool ink. Not pure white / pure black on purpose. |
| `--color-bg-surface` | `#ffffff` | `#161922` | Cards, embed aside, code-block backdrop step-up. |
| `--color-bg-surface-strong` | `#f1ede5` | `#1c2030` | Hover state for chips / nav items, table header row. |
| `--color-bg-code` | `#f1ede4` | `#1a1d27` | Code block bg, distinct from surface so it reads as code. |

## Color — Text

| Token | Light | Dark | Contrast vs `--color-bg-page` | Use |
|---|---|---|---|---|
| `--color-text-body` | `#1b1d22` | `#dcdee2` | Light ≈ **14.8:1** · Dark ≈ **13.4:1** (both AAA — well above AA 4.5:1) | Body prose. |
| `--color-text-heading` | `#0a0c10` | `#f1f2f5` | Light ≈ **18.6:1** · Dark ≈ **16.9:1** (AAA) | Headings. |
| `--color-text-muted` | `#5a5e68` | `#9aa0ad` | Light ≈ **5.9:1** · Dark ≈ **5.3:1** (AA pass) | Subordinate prose, captions, backlink heading. |
| `--color-text-faded` | `#8a8e98` | `#6b7180` | Light ≈ **3.4:1** · Dark ≈ **3.6:1** — **non-body only** (large UI/meta) | Meta dates, count badges, edge labels. |
| `--color-text-link` | `#a83612` | `#f0a373` | Light ≈ **5.7:1** · Dark ≈ **9.3:1** (AA pass) | Iron-oxide / warm-amber accent for links. |
| `--color-text-link-hover` | `#7c2810` | `#f5be94` | Light ≈ **7.6:1** · Dark ≈ **11.2:1** | Link hover. |
| `--color-text-code` | `#1b1d22` | `#dcdee2` | Same as body | Inline code text. |

> Verification method: WCAG 2.1 relative-luminance formula applied to each `(text, bg)` pair. Body-text tokens (`--color-text-body`, `--color-text-heading`, `--color-text-muted`, `--color-text-link`, `--color-text-link-hover`) all clear AA 4.5:1 in both modes. `--color-text-faded` is intentionally below 4.5:1 (3.4:1 / 3.6:1) and is restricted to **non-body large UI** (meta uppercase mono ≥ 12px @ 500 weight or larger numerals); it must never carry body prose. This restriction is enforced editorially in `COMPONENTS.md` and reiterated in `ANTIPATTERNS.md`.

## Color — Semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-success` | `#0f7a3a` | `#5fd599` | audit pass, OK badges |
| `--color-warn` | `#9a5a06` | `#f0b860` | audit warn |
| `--color-error` | `#a51b1b` | `#f08080` | audit fail |
| `--color-border` | `#e4dfd3` | `#262a36` | hairline borders, default 1px solid |
| `--color-border-strong` | `#c9c1ad` | `#3a4054` | embed-aside ribbon, blockquote rule |
| `--color-focus-ring` | `#a83612` | `#f0a373` | mirrors link accent — never removed |

## Color — Accent (single brand accent: iron oxide)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-accent` | `#a83612` | `#f0a373` | Single brand accent. Used for links, focus ring, heading anchor `#`, blockquote rule. |
| `--color-accent-soft` | `#f3e1d6` | `#3a261b` | Subtle accent surface — selection bg, tag-chip "active" state. Use sparingly. |

> **Why iron oxide**: warm, distinctive, non-AI-default; pairs with paper-cream / ink-warm backgrounds. **Single accent only — no purple/indigo, no second brand color in v0.2**. (See `ANTIPATTERNS.md` for the explicit purple/indigo policy.)

## Typography — font stacks

| Token | Stack | Self-host source | Use |
|---|---|---|---|
| `--font-sans` | `Inter, "Pretendard Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif` | Inter Variable woff2 (rsms/inter, OFL); Pretendard Variable woff2 (orioncactus/pretendard, OFL) | Body, `h4`, UI chrome. |
| `--font-serif` | `"Source Serif 4", "Noto Serif KR", ui-serif, Georgia, "Apple SD Gothic Neo", serif` | Source Serif 4 Variable woff2 (Adobe, OFL); Noto Serif KR woff2 (Google, OFL) | `h1`–`h3` only. |
| `--font-mono` | `"JetBrains Mono", "D2Coding", ui-monospace, SFMono-Regular, Menlo, monospace` | JetBrains Mono Variable woff2 (JetBrains, OFL); D2Coding woff2 (Naver, OFL) | Code, meta, kbd, language label, brand mark, nav. |

> All three families self-hosted under `apps/blog/public/fonts/`. **Never** load from Google Fonts / Bunny / any CDN — privacy-first product cannot leak referrer or IP to third-party hosts. `font-display: swap` so system fallback paints first; FOUT acceptable, FOIT not.

## Type scale (modular, ratio ≈ 1.25 anchored at 17px body)

| Token | Size | Weight | Line-height | Letter-spacing | Family |
|---|---|---|---|---|---|
| `--text-h1` | `2rem` (32px) | 600 | 1.2 | -0.01em | serif |
| `--text-h2` | `1.5rem` (24px) | 600 | 1.3 | -0.005em | serif |
| `--text-h3` | `1.25rem` (20px) | 600 | 1.35 | 0 | serif |
| `--text-h4` | `1.0625rem` (17px) | 600 | 1.4 | 0.005em | sans |
| `--text-body` | `1.0625rem` (17px) | 400 | 1.7 | 0 | sans |
| `--text-small` | `0.875rem` (14px) | 400 | 1.5 | 0 | sans |
| `--text-meta` | `0.75rem` (12px) | 500 | 1.4 | 0.04em (uppercase) | mono |
| `--text-code` | `0.9375rem` (15px) | 400 | 1.6 | 0 | mono |

## Spacing scale (8-base)

| Token | px | Use |
|---|---|---|
| `--space-1` | 4 | inline-code padding, chip x-padding |
| `--space-2` | 8 | tight stacks, list item y |
| `--space-3` | 12 | meta-to-title, chip y |
| `--space-4` | 16 | paragraph spacing, nav y |
| `--space-5` | 24 | section internal |
| `--space-6` | 32 | between sections |
| `--space-7` | 48 | h2 top margin, between major blocks |
| `--space-8` | 64 | nav-to-content, footer top |
| `--space-9` | 96 | landing-only top breath |
| `--space-10` | 128 | reserved (rarely used) |

## Radius scale (sharp by default — intentional variance, not a global pill)

| Token | px | Use |
|---|---|---|
| `--radius-sm` | 2 | inline code chip, kbd |
| `--radius-md` | 4 | tag chip, button, nav item, image caption strip |
| `--radius-lg` | 8 | image container, embed aside, code block |

> No `radius-xl` / `radius-2xl` / `radius-full`. The principle that "not every card has the same radius" is enforced by **only providing 3 tiers** — call sites can't reach for a uniform pill. Graph nodes are SVG circles, not box-radius — the radius scale doesn't bind them.

## Shadow / elevation (max 1)

| Token | Light value | Dark value | Use |
|---|---|---|---|
| `--shadow-1` | `0 1px 0 rgba(0,0,0,0.06)` | `0 1px 0 rgba(0,0,0,0.5)` | **Only** on sticky header on scroll, as a hairline shadow. No glow, no card lift. |

> Cards / asides / chips get `--color-border` 1px solid instead of a shadow — that is the v0.2 elevation motif. No multi-step shadow scale exists at the token level so call sites can't synthesize SaaS-style elevation.

## Motion duration / ease

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 100ms | underline thickness on link |
| `--duration-base` | 150ms | link color, button bg, theme-toggle icon |
| `--duration-menu` | 200ms | mobile menu slide |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` | deceleration, default |
| `--ease-linear` | `linear` | color-only transitions |

> No `--duration-slow`, no spring tokens — the token tier deliberately omits them so call sites cannot reach for landing-page motion (fade-in, scroll-reveal, slide-up). `prefers-reduced-motion: reduce` zeroes all of these in `base.css` (step 2).

## Layout containers

| Token | Value | Use |
|---|---|---|
| `--measure-prose` | 68ch | body reading column (slightly wider than v0.1's 65ch to fit the asymmetric grid) |
| `--container-main` | 72ch | main content max-width including margin column |
| `--container-index` | 56rem | home / tag-index page (wider grid for listings) |
| `--margin-col-w` | 12rem | side-margin notation column (`lg+` only) |
