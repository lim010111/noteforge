<!-- repo: lim010111/noteforge -->

# noteforge

> A privacy-first Astro SSG that turns hand-picked notes from your Obsidian vault into a static blog. **What you don't mark, doesn't exist.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![GitHub release](https://img.shields.io/github/v/release/lim010111/noteforge?include_prereleases&sort=semver)](https://github.com/lim010111/noteforge/releases)

**Languages**: English · [한국어](./README.ko.md)

`noteforge` only publishes the notes you explicitly opt in — anything with `public: true` in its frontmatter, or a `#public` tag somewhere in the body. Everything else stays out of the build entirely. This is the opposite of Quartz's opt-out default: nothing leaves your vault unless you say it can. For the full threat model and what this project deliberately doesn't try to cover, see [docs/PRD.md](./docs/PRD.md).

## Quick start

```bash
git clone https://github.com/lim010111/noteforge my-blog && cd my-blog
pnpm install
cp .env.example .env        # OBPUB_VAULT_PATH=<absolute path to your vault>
pnpm --filter blog dev      # http://localhost:4321
pnpm --filter blog build    # apps/blog/dist + audit
```

## Publishing a note

To publish a note, either set `public: true` in its frontmatter or drop a `#public` tag anywhere in the body — either one is enough on its own. Without one of these, the note never reaches the build output.

You can also check why any single note will or won't be published:

```bash
pnpm obpub status packages/core/tests/fixtures/vault-mixed/public-note.md
# → public-note.md → PUBLIC (reason: frontmatter public: true)
```

## Categories

The sidebar structure and the URL of each published note are both controlled by `nav.mode`. There are two modes available, and the default is `'category'`.

### `category` mode (default)

Each note's `category` frontmatter field decides where it appears in the sidebar and what its URL looks like. Notes are grouped by the category name you set, regardless of which folder they happen to live in inside your vault — so how you organize files in Obsidian can stay separate from how readers see them grouped on the site.

```yaml
---
title: pnpm workspace notes
public: true
category: tools
---
```

The note above lands in the `tools` group in the sidebar, and its URL becomes `/tools/pnpm workspace notes/`.

For nested categories, separate levels with a slash (`/`). For example, `category: tools/cli` places the note under a `tools > cli` tree in the sidebar, with the URL `/tools/cli/...`.

![Obsidian editor showing a note "pnpm 워크스페이스 정리" with frontmatter `tags: - public` and `category: tools/cli`](./docs/assets/category-mode-obsidian_example.png)

The note can live anywhere inside your vault — the `category` field is what decides its place on the site.

Notes without a `category` field are gathered into an **Uncategorized** group pinned at the bottom of the sidebar, and their URLs use just the filename (`/<filename>/`).

### `folder` mode

In this mode, your vault's folder layout is used directly for both the sidebar and the URL. There's no need to add a `category` field to each note — your on-disk folder hierarchy becomes the site's category tree as-is.

![Obsidian file explorer showing the vault folder hierarchy `tools` > `cli` > "pnpm 워크스페이스 정리"](./docs/assets/folder-mode-obsidian_example.png)

To switch to this mode, set it explicitly in `noteforge.config.ts`:

```ts
// noteforge.config.ts
export default defineConfig({
  // ...
  nav: { mode: 'folder' },
});
```

This is handy when your vault is already organized the way you want the site to look. If you'd rather keep things loose inside the vault but group them differently for readers, the default `'category'` mode is the better fit.

The two examples above — `category: tools/cli` in frontmatter and a `tools/cli/` folder in the vault — describe the same destination. Both render to the same sidebar tree and URLs on the published blog:

![noteforge blog with CATEGORIES sidebar showing `tools` > `cli`, and a "cli" landing page listing "pnpm 워크스페이스 정리" with breadcrumb HOME / TOOLS / CLI](./docs/assets/blog-categories-overview.png)

## How privacy is enforced

The `private/**` folder is a tripwire: any note inside it stays private even when its frontmatter says `public: true`. Overriding this requires explicitly setting `unsafeAllowPrivateFolder: true` in your config.

Frontmatter is filtered through an allowlist (`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category`) — fields outside this list never reach the rendered HTML.

Obsidian's `%%...%%` comments are stripped during the discovery phase, before any other step in the pipeline runs, so they never make it downstream.

For the full threat model, see [docs/PRD.md](./docs/PRD.md) and [SECURITY.md](./SECURITY.md).

## Documentation

- [docs/PRD.md](./docs/PRD.md) — Threat model, what's in and out of scope
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Modules, pipeline, dependency graph
- [docs/DEPLOY.md](./docs/DEPLOY.md) — Cloudflare Pages, GitHub Pages, and other static hosts
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) — Design tokens and layout guide
- [docs/adr/](./docs/adr/) — Architecture decision records
- [CHANGELOG.md](./CHANGELOG.md) — Release notes
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Dev workflow, TDD, PR checklist
- [SECURITY.md](./SECURITY.md) — Reporting security issues
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Contributor Covenant v2.1

## Status

**v0.8.0** — first stable release. Builds on the v0.71 sidebar alignment, the v0.7 categories nav mode, and the v0.6 right-side TOC, with a release-readiness sweep on top (privacy-first DRY cleanup, hero-image hardening, a published security policy, and identity tidying). See [CHANGELOG.md](./CHANGELOG.md) for the full history.

## License

Released under [MIT](./LICENSE). This project never stores, transmits, analyzes, or sends telemetry from your vault content.
