# 0014. Sticky-Header `--shadow-1` on Scroll — 4th Static-Contract JS Exception

## Status
Accepted · 2026-Q2 · v0.6

## Context
UI_GUIDE §3 (Hairline-elevation row) explicitly permits `--shadow-1` on one
surface beyond cards/asides: **"스크롤된 sticky 헤더"**. Up to v0.5, that
allowance was never wired up — `.site-header` carried only the 1px
`border-bottom`, so a long scroll left no depth cue separating the header
from content scrolling beneath it.

Pure CSS cannot detect a `position: sticky` element's stuck-state today.
`@supports (animation-timeline: scroll())` would close the gap but browser
support is too narrow for a v0.6 release contract. So the realistic options
are (a) keep the allowance unused, (b) add a sentinel + IntersectionObserver
shim, or (c) relax §9 to skip the shadow.

UI_GUIDE §3 also locks down the static-output contract: "다크모드 토글의
FOUC 방지 sync script 1개를 제외하고 `<head>`/페이지 안에 인터랙티브 JS를
새로 들이지 않는다." In practice three JS exceptions already ship:

1. **`themeInitScript`** — inline FOUC-prevention sync (named in §3).
2. **`bindThemeToggle`** — bundled handler for the theme button.
3. **TOC `IntersectionObserver` scroll-spy** — listed in §9 / 7-6.

The §3 wording singles out the FOUC script, but the post-v0.2 surface has
already grown by two for navigation reasons. Adding a fourth (sentinel
observer) is a meaningful, named expansion — not a casual addition — so it
gets an ADR.

## Decision
1. Render a 1×1px `<div class="site-header__sentinel">` in normal flow
   immediately above `<header class="site-header">` inside `<body>`.
2. Ship a ~10-line inline module script in `BaseLayout.astro` that
   `IntersectionObserver`'s the sentinel and toggles `body.is-scrolled`
   when the sentinel leaves the viewport.
3. CSS adds `transition: box-shadow var(--duration-base) var(--ease-out);`
   to `.site-header`; `body.is-scrolled .site-header { box-shadow: var(--shadow-1); }`.
4. Progressive enhancement only — without `IntersectionObserver` the header
   keeps its hairline border-bottom (v0.2 baseline).
5. No new motion token, no new shadow token, no `--shadow-2`. The shadow is
   the same `--shadow-1` already used by `.mobile-menu__panel` and `.note-toc`.
6. UI_GUIDE §9 motion table gains a row: "스크롤된 sticky 헤더 그림자 페이드
   (`--duration-base`)". UI_GUIDE §3 Hairline row footnote updated to point
   here.
7. The 5th JS exception is added to the static-output contract's named list.
   Any future addition should reuse the sentinel/observer pattern or earn its
   own ADR — JS surface must remain auditable.

## Alternatives considered
- **Pure-CSS `animation-timeline: scroll()`** — browser support insufficient
  (~70% as of 2026-Q1); failing back to no shadow defeats the point. Revisit
  once Safari ships stable support.
- **Scroll listener on `window`** — works but fires on every scroll tick;
  IntersectionObserver gives us a single boolean transition with no main-
  thread cost. The pattern also matches the existing ToC scroll-spy.
- **Skip the shadow** — preserves "no new JS" but leaves a UI_GUIDE allowance
  documented and unused, which is its own form of contract drift.
- **`--shadow-2` deeper-on-scroll variant** — explicitly rejected. The
  `--shadow-1`-only ceiling from §3 is load-bearing for the "no SaaS-style
  lift" anti-pattern. One shadow tier is enough.

## Consequences
- **+** UI_GUIDE §3's allowed scrolled-header shadow is finally wired up;
  long pages get a one-step depth cue without violating the "no glow / no
  multi-step elevation" anti-pattern.
- **+** Companion motion to A/B (theme toggle + mobile-menu icon swap)
  ships in the same PR, so §9 reads more honestly: every listed motion has
  a working implementation.
- **+** Sentinel pattern is reusable. If a future component needs "stuck
  state" CSS (e.g. a sticky TOC pill), it can copy the 10-line observer.
- **−** The static-output contract's exception list grows to 4. Documented
  in §3 by name to keep the audit surface explicit.
- **−** 1px sentinel adds a microscopic amount of layout — measured at 0
  CLS impact in dev builds, but worth mentioning.

## Related
- [docs/UI_GUIDE.md](../UI_GUIDE.md) — §3 anti-pattern table, §9 motion table
- [docs/ADR.md](../ADR.md) — inline ADR index
- 코드: `packages/theme-default/src/layouts/BaseLayout.astro` (sentinel +
  observer), `packages/theme-default/src/styles/layout.css` (`.site-header__sentinel`,
  `body.is-scrolled .site-header`)
