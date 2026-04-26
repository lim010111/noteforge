# ANTIPATTERNS — v0.1 → v0.2 policy

This document is the SSOT for `docs/UI_GUIDE.md` step 1 rewrite. Each row records v0.1 policy, v0.2 policy, and rationale. The 7 entries from v0.1's "AI 슬롭 안티패턴" table are kept first, then v0.2-introduced motifs and their limits.

## v0.1 → v0.2 (existing 7 anti-patterns)

| Anti-pattern | v0.1 policy | v0.2 policy | Rationale (why retain / loosen / forbid) |
|---|---|---|---|
| `backdrop-filter: blur()` (glass morphism) | banned | **keep banned** | The most legible AI-template tell. Editorial direction has zero functional use for it; its only purpose is decorative atmosphere, and our sole atmosphere is the page color (`--color-bg-page`). |
| Gradient text (background-clip: text on `h1` etc.) | banned | **keep banned** | SaaS-landing cliché; clashes with letterpress serif headings — a serif `h1` rendered with a CSS gradient is instantly the "AI hero" cue we want to refuse. |
| "Powered by AI" / generated badges | banned | **keep banned** | Decoration, not function. No badge in v0.2; if attribution is required in the future, a footer mono line suffices. |
| Box-shadow neon glow / pulse animation | banned | **keep banned** | Distinctive surfaces in v0.2 come from hairline borders + accent color, not glow. Token tier exposes a single `--shadow-1` (1px hairline only); no glow scale exists, so call sites can't synthesize one. |
| Purple / indigo brand color | banned | **keep banned** | We adopt **iron-oxide** (`#a83612` light / `#f0a373` dark) as the single accent — distinctive, warm, non-AI-default. Purple/indigo single-tone branding remains explicitly forbidden. Multi-color brand systems also forbidden in v0.2 (single accent only). |
| Uniform `rounded-2xl` everywhere | banned | **partial allow** (radius scale = `2 / 4 / 8 px` only) | The point is *intentional variance*, not "soft pills everywhere". Inline code uses `--radius-sm` (2px), chips/buttons use `--radius-md` (4px), embed aside / image / code block use `--radius-lg` (8px). No `rounded-xl` / `rounded-2xl` / `rounded-full` token exists (graph node circles are SVG, not box-radius — the radius scale doesn't bind them). |
| Background gradient orbs (`blur-3xl` blobs) | banned | **keep banned** | Atmosphere comes from the warm-cream / cool-ink page color alone. Layered backdrops, mesh gradients, noise overlays, and texture filters are forbidden on `--color-bg-page`. |

## v0.2 — newly introduced motifs (with explicit limits)

| New motif | Where allowed | Limit / forbidden use |
|---|---|---|
| **Side-margin notation grid** (12rem column on `lg+` for heading anchors, dates, tags) | `BaseLayout` main grid; `Note` heading anchors and meta mirror | Text and numerals only. Never decorative shapes, never illustrative artwork, never images. Collapses inline on `< lg`. |
| **Monospace accent** (JetBrains Mono / D2Coding for meta, kbd, language labels, brand mark, nav) | meta rows under `h1`, code blocks, language chip, brand mark, footer, nav | Never run body in mono. Never set `h1`–`h4` in mono (serif/sans only). Never style links inside body prose in mono — links sit in body context and inherit `--font-sans`. |
| **Letterpress serif headings** (Source Serif 4 / Noto Serif KR for `h1`–`h3`) | `h1`, `h2`, `h3` in `Note` and page-title slots | Never serif for body, never serif for `h4+` (h4 stays sans for hierarchy contrast), never serif for UI chrome (nav, buttons, chips, footer). |
| **Hairline rules instead of shadows** (1px `--color-border` everywhere; single optional `--shadow-1` for sticky header on scroll) | section dividers, cards, embed aside, table rows, header on scroll | Never use shadow as elevation hint on cards / asides / chips — they get borders. No multi-step shadow scale exists at the token level. |
| **Paper-cream / cool-ink page color as sole atmosphere** (`--color-bg-page`) | every page in both modes | Never overlay gradients, mesh, orbs, noise, or texture filters on top of the page bg. The page color *is* the atmosphere; nothing else stacks on it. |

## Notes for downstream steps

- Step 1 (`docs/UI_GUIDE.md` rewrite) must restate every "keep banned" row in `ANTIPATTERNS.md` so the user-facing guide remains the canonical reference for fork users — `phases/` documents are internal.
- Step 2 (`tokens.css` / `base.css`) enforces several of these editorially via the token tier itself: no `radius-xl+`, no shadow scale beyond `--shadow-1`, no `--duration-slow`, no second accent. Reviewers should reject new tokens that re-introduce a banned axis.
- Step 5 (`Graph` rewrite) is exempt from the radius rule (graph node `<circle>` is SVG, not `border-radius`) but inherits the single-accent rule for node hover color.
