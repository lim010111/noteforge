# MOODBOARD — v0.2 Design Direction

## Direction (one paragraph)

An **editorial-technical** reading surface — academic-paper rigor (side-margin notation, hairline rules, restrained chromatic accent) executed with engineering-log restraint (monospace meta, no decoration). Built on top of v0.1's "노트북·논문·위키" metaphor, but now with intentional polish: warm-cream / cool-ink page color, letterpress serif headings on humanist sans body, a single distinctive iron-oxide accent. The shift from v0.1 is **production-grade specificity**, not loosened restraint — we still refuse SaaS-landing motion, glass morphism, gradient text, and purple branding.

## References

| # | Reference | Steal | Don't |
|---|-----------|-------|------|
| 1 | **EdwardTufte.com / Tufte's books** | Side-margin notation column, asymmetric grid, hairline rules instead of shadows, footnote-as-margin-note tradition, restrained single warm accent. | Anachronistic Bembo-only typography, paper-yellow page color saturated to theme-park levels. |
| 2 | **Stripe Press** (press.stripe.com) | Letterpress serif headings on humanist sans body, generous prose measure, dignified-but-warm tone, the absence of motion on book pages. | Hardcover-cinematic landing hero, book covers as decorative anchors (we don't have books). |
| 3 | **Robin Sloan's website** (robinsloan.com) | Warm-cream page color, monospace meta lines, hand-edited feel without performative quirk, a personal-but-publishable tone. | Idiosyncratic one-off typography per post — we need a system that holds across many notes. |
| 4 | **Are.na editorial / channels** | Sans-body editorial layout, citation-first hierarchy, restrained chrome, the way meta sits beside content rather than under it. | Dense uniform card grids, the "infinite browsing" affordances — we are reading-first, not grazing-first. |
| 5 | **Linear changelog & docs** (linear.app) | Dark mode that feels designed-from-scratch (not a color invert), a single accent that survives both modes, hairline borders. | Product-screenshot hero density, SaaS-pitch motion sequences, gradient-orb backdrops. |
| 6 | **Vercel docs / Geist UI** | Monospace-accented inline metadata (kbd, language label chips, version pills), sharp 2–4px radii, content-first layout density. | Brand-colored "AI" promotional surfaces, code-block copy-button maximalism. |

## Core Visual Motifs

1. **Side-margin notation × monospace meta** — main reading column ~68ch with a ~12rem margin column on `lg+` holding heading anchors (`#`), dates, and tags. Margin column collapses inline on `< md`. Mono is reserved for meta, code, kbd, language labels, brand mark, and nav — never for body.
2. **Letterpress serif headings on humanist sans body** — `h1`–`h3` in a serif stack (Source Serif 4 / Noto Serif KR), body and `h4+` in a humanist sans (Inter / Pretendard). The serif/sans/mono triad is the system; no fourth family.
3. **Paper-warm / Deep-ink backgrounds as the sole atmosphere** — warm-cream `#f9f6f1` (light), cool-ink `#0f1115` (dark). No gradients, no orbs, no noise overlays, no texture filters. The page color *is* the atmosphere.
