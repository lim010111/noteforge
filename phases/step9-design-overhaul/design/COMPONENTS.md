# COMPONENTS — v0.2 Sketches

These sketches are SSOT for steps 3–5. Tokens referenced here are defined in `TOKENS.md` (step 2 transcribes them to CSS variables and Tailwind theme).

## `BaseLayout`

```html
<body class="bg-page text-body font-sans antialiased">
  <a class="skip-link">본문으로 건너뛰기</a>

  <header class="sticky top-0 z-30 bg-page/95 border-b border-default">
    <div class="mx-auto max-w-[var(--container-main)] px-4 md:px-6 flex items-center justify-between h-12">
      <a href="/" class="font-mono text-meta uppercase tracking-wider text-heading">noteforge</a>
      <nav class="hidden md:flex items-center gap-6 font-mono text-meta uppercase tracking-wider">
        <a href="/">notes</a>
        <a href="/tags">tags</a>
        <a href="/graph">graph</a>
      </nav>
      <div class="flex items-center gap-2">
        <button id="theme-toggle" aria-label="테마 전환"
                class="p-1.5 rounded-md hover:bg-surface-strong">[icon]</button>
        <button id="menu-toggle" aria-label="메뉴"
                class="md:hidden p-1.5 rounded-md hover:bg-surface-strong">[hamburger]</button>
      </div>
    </div>
  </header>

  <main id="main" class="mx-auto max-w-[var(--container-main)] px-4 md:px-6 py-8 md:py-12">
    …
  </main>

  <footer class="mt-16 border-t border-default">
    <div class="mx-auto max-w-[var(--container-main)] px-4 md:px-6 py-6
                font-mono text-meta uppercase tracking-wider text-muted
                flex flex-wrap gap-x-6 gap-y-2">
      <span>© 2026 — noteforge</span>
      <span>built {date}</span>
      <a href="/feed.xml">rss</a>
    </div>
  </footer>
</body>
```

- Brand mark: monospace, lowercase, `text-meta` uppercase tracking — sits at `text-heading` color.
- Nav: monospace, uppercase, `text-meta` size, gap-6 between items. Active item: `text-link` color.
- Theme toggle: icon button (sun/moon), 28×28 hit area, persists to `localStorage` and respects `prefers-color-scheme` on first visit.
- **Mobile (< 640px)**: nav collapses to slide-down sheet (`--duration-menu` 200ms). Brand mark + theme toggle + hamburger remain. Header height stays 48px.

## `Note` — article body

```html
<article class="prose mx-auto max-w-[var(--measure-prose)]">
  <header class="mb-7 not-prose">
    <h1 class="font-serif text-h1 text-heading">{title}</h1>
    <div class="mt-3 font-mono text-meta uppercase tracking-wider text-muted
                flex flex-wrap gap-x-4 gap-y-1">
      <time datetime="{date}">{date}</time>
      {updated && <span>updated {updated}</span>}
      {tags.map(t => <a href="/tags/{t}">#{t}</a>)}
    </div>
  </header>
  <!-- body — set:html note.body -->
</article>
```

- `h1` / `h2` / `h3`: `font-serif text-h{n} text-heading` with `mt-{7|6|5}` and `mb-{4|3|2}`.
- `h4`: `font-sans text-h4 text-heading mt-5 mb-2` — sans on purpose (hierarchy contrast vs serif h1–h3).
- Body `<p>`: `text-body leading-[1.7] my-4` — measure clamped by parent.
- Inline `<a>`: `text-link underline decoration-1 underline-offset-[3px] hover:decoration-2 hover:text-link-hover transition-[color,text-decoration-thickness] duration-fast`.
- Inline `<code>`: `font-mono text-code bg-code text-code rounded-sm px-1 py-[1px]`.
- `<pre>`: `relative font-mono text-code bg-code rounded-lg p-4 overflow-x-auto` with corner language chip:
  ```html
  <span class="absolute top-2 right-3 font-mono text-meta
               uppercase tracking-wider text-faded">{lang}</span>
  ```
- `<blockquote>`: `border-l-[3px] border-strong pl-5 my-6 italic text-muted` (no bg, no quote glyph).
- `<figure>` / `<img>`: `<img>` is `rounded-lg w-full` inside `<figure>` with `<figcaption class="mt-2 text-small text-muted text-center font-sans">{alt}</figcaption>`. If alt missing, build emits a warning and renders `<p class="text-small text-warn">[이미지 설명 누락]</p>` next to the figure.
- **Embed aside** (transcluded `![[Note]]` body): `<aside class="my-7 border-l-[3px] border-strong bg-surface rounded-lg p-5">{body}</aside>`.
- **Mobile (< 640px)**: prose measure shrinks to `min(100%, 65ch)`; `h1` → `text-[1.75rem]`; code blocks scroll horizontally; embed aside loses left padding by 1 step.

## `Note` — meta row

- Date / updated / tags rendered as a single mono row directly under `h1`, separated by `gap-x-4`. Category (if v0.3 introduces it) joins the same row.
- On `lg+`, this row is **also** anchored in the side-margin column (12rem left of prose) so it remains visible while scrolling. On `< lg`, only the inline row exists.
- Tag links inside the meta row inherit the link styling but render with a leading `#` (not as separate chips — chips are reserved for `TagList` / `TagPage`).

## Heading anchor (`#`)

- Each rendered heading gets a stable `id` (kebab-case slug from text).
- A sibling `<a class="heading-anchor" href="#{id}" aria-label="이 섹션 링크 복사">#</a>`:
  - On `lg+`, absolutely positioned in the margin column: `font-mono text-meta text-faded -ml-[2.5rem] opacity-0 group-hover:opacity-100 transition-opacity duration-base`.
  - On `< lg`, inline-end after the heading text, same hover reveal.
- Small vanilla-JS click handler (~30 lines, loaded once from `BaseLayout`): copies `location.origin + location.pathname + '#' + id` to clipboard, shows tiny mono "copied" inline for 1.5s. Respects `prefers-reduced-motion` (no fade — instant).
- **Mobile (< 640px)**: anchor is **always visible** (no hover state on touch). Tap-to-copy.

## `Backlinks`

```html
<aside class="mt-12 pt-6 border-t border-default" aria-label="백링크">
  <h2 class="font-mono text-meta uppercase tracking-wider text-muted">
    referenced by · 이 노트를 참조하는 노트
  </h2>
  <ul class="mt-3 space-y-1">
    {entries.map(e =>
      <li class="font-sans text-body">
        <span class="font-mono text-meta text-faded mr-2">→</span>
        <a href="/{e.slug}">{e.title}</a>
      </li>
    )}
  </ul>
</aside>
```

- Sits at the bottom of the article (after body, above footer). On `lg+`, an additional fixed-position anchor link in the margin column links down to it ("↓ backlinks (n)"); on `< lg`, only the bottom block.
- **Empty state: render NOTHING** (privacy contract — an empty "Backlinks" heading would imply private notes were filtered out).
- **Mobile (< 640px)**: same structure, font sizes unchanged.

## `TagList` (index page)

```html
<section class="space-y-5">
  <h1 class="font-serif text-h1 text-heading">tags</h1>
  <ul class="flex flex-wrap gap-2">
    {tags.map(t =>
      <li>
        <a href="/tags/{t.tag}"
           class="inline-flex items-baseline gap-1 px-2 py-1
                  rounded-md border border-default bg-surface
                  hover:bg-surface-strong
                  font-mono text-meta text-body">
          <span>#{t.tag}</span>
          <sup class="text-faded">{t.count}</sup>
        </a>
      </li>
    )}
  </ul>
</section>
```

- Tag chips: `rounded-md` (4px), border + bg, mono text. Hover: `bg-surface-strong`. Focus: `--color-focus-ring` outline.
- Active state (current tag on `TagPage`): `bg-accent-soft` background, accent text.
- **Mobile (< 640px)**: same wrap-grid, no change.

## `TagPage`

```html
<section class="space-y-6">
  <h1 class="font-serif text-h1 text-heading">#{tag}</h1>
  {entries.length > 0 ? (
    <ul class="space-y-3">
      {entries.map(e =>
        <li class="flex items-baseline gap-3 font-sans text-body">
          {e.date && <time class="font-mono text-meta uppercase tracking-wider
                                  text-faded shrink-0">{e.date}</time>}
          <span class="font-mono text-meta text-faded">→</span>
          <a href="/{e.slug}">{e.title}</a>
        </li>
      )}
    </ul>
  ) : (
    <p class="text-muted">이 태그를 가진 공개 노트가 없습니다.</p>
  )}
</section>
```

- Date column on left, `→` separator, title link. Date in mono uppercase, title in sans body.
- **Mobile (< 640px)**: date wraps under the title via `flex-wrap`.

## `Graph`

- Static SVG, `viewBox` from `computeCircularLayout` (existing).
- Node `<circle>`: `fill="currentColor" class="text-heading hover:text-link"` — inherits via CSS so both light and dark modes work without per-node fills.
- Edge `<line>`: `stroke="currentColor" class="text-faded" stroke-width="1"`.
- Wrapper `<figure class="font-mono text-meta">`: optional caption "n nodes · m edges" in mono uppercase.
- Empty state: `<p class="text-muted">아직 공개된 글이 없습니다.</p>` (matches v0.1 copy).
- Privacy: private nodes are already removed in the data layer (Phase C). The visual layer has zero filtering responsibility.
- **Mobile (< 640px)**: SVG `width="100%" height="auto"` — keeps aspect ratio; touch-tap nodes navigate.

## `NotFound` (404)

```html
<section class="mx-auto max-w-[var(--measure-prose)] py-16
                grid grid-cols-1 lg:grid-cols-[8rem_1fr] gap-8 items-baseline">
  <div class="font-mono text-[5rem] leading-none text-faded select-none">404</div>
  <div>
    <h1 class="font-serif text-h1 text-heading">페이지를 찾을 수 없습니다</h1>
    <p class="mt-4 text-body">요청하신 페이지가 존재하지 않거나, 더 이상 공개되지 않습니다.</p>
    <p class="mt-3 font-mono text-meta uppercase tracking-wider">
      <a href="/">→ home</a>
    </p>
  </div>
</section>
```

- **Copy is fixed** (privacy: must NOT disclose whether a note ever existed). Only visuals change. No "삭제됨" / "이전에 있었으나" wording.
- Big mono `404` numeral as side-margin element on `lg+`, stacked above title on mobile.
- **Mobile (< 640px)**: stacked single column, "404" sits above title at `text-[3.5rem]`.
