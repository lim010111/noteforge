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

![Screenshot of a published noteforge blog: a CATEGORIES sidebar showing `tools` > `cli`, with the `cli` category landing page in the main column and a HOME / TOOLS / CLI breadcrumb at the top](./docs/assets/blog-categories-overview.png)

## Prerequisites

Before cloning, make sure you have:

- An [Obsidian](https://obsidian.md/) vault (or any folder of Markdown files) with at least one note you want to publish
- [Node.js](https://nodejs.org/) **22.6+** — LTS 22.11 recommended (`.nvmrc` is provided)
- [pnpm](https://pnpm.io/installation) **10.x**
- [Git](https://git-scm.com/)

## Quick start

```bash
# 1. Clone this repo into a directory of your choice
git clone https://github.com/lim010111/noteforge my-blog && cd my-blog

# 2. Install dependencies
pnpm install

# 3. Tell noteforge where your vault lives
cp .env.example .env
#    Open .env in your editor and set OBPUB_VAULT_PATH to the absolute
#    path of your Obsidian vault. .env.example shows examples for macOS,
#    Linux, and WSL.

# 4. Start the dev server
pnpm --filter blog dev      # opens http://localhost:4321

# 5. (Later) Build the static site for hosting
pnpm --filter blog build    # outputs to apps/blog/dist + runs a privacy audit
```

> The `--filter blog` flag tells pnpm to run the script inside the `blog` workspace package (`apps/blog/`). Every `dev`/`build` command in this README works the same way.

If the dev server starts but no notes appear, jump to [Troubleshooting](#troubleshooting).

## Publishing a note

In Obsidian, open any note in your vault and either set `public: true` in its frontmatter or drop a `#public` tag anywhere in the body — either one is enough on its own. Save the file, and the dev server picks it up on the next reload.

```yaml
---
title: My first published note
public: true
---

This note is now public.
```

To check why a specific note will (or won't) be published, use the status command. The path can be relative to your shell or absolute:

```bash
pnpm obpub status "$OBPUB_VAULT_PATH/path/to/your-note.md"
# → your-note.md → PUBLIC (reason: frontmatter public: true)
```

## Customize your site

Site identity (title, canonical URL, author, social links) and per-vault behavior (ignored folders, theme) live in **`apps/blog/noteforge.config.ts`**. Open it right after `pnpm install` and edit the `site` block first — otherwise the build is branded as the upstream demo site:

```ts
// apps/blog/noteforge.config.ts
export default defineConfig({
  site: {
    title: 'shine notes',                   // ← your blog title
    url: 'https://noteforge.pages.dev',     // ← your deployed URL
    author: 'shine',                        // ← your name
    social: {
      github: 'https://github.com/lim010111',
    },
  },
  vaults: [
    {
      id: 'shine',
      path: vaultPath,                      // ← from OBPUB_VAULT_PATH
      ignore: ['Templates/**', 'Excalidraw/**'], // ← folders to skip entirely
    },
  ],
  // ... see the file for the full set of options
});
```

The inline comments in that file cover every option you're likely to touch, including `nav.mode`, `privateLinkBehavior`, and the `unsafeAllowPrivateFolder` tripwire override.

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

## Deploying

`pnpm --filter blog build` produces a fully static site in `apps/blog/dist/` that any static host can serve. The supported, documented path is **Cloudflare Pages via Direct Upload**:

```bash
npm i -g wrangler
wrangler login
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=<your-project-name>
```

GitHub Pages, Netlify, and other static hosts work too — they just aren't covered in this repo's docs because the build runs locally on your machine (your absolute vault path won't exist on a CI runner). See [docs/DEPLOY.md](./docs/DEPLOY.md) for the full Cloudflare walkthrough including custom domains.

## Troubleshooting

**The note I marked `public: true` doesn't show up.** Run `pnpm obpub status <absolute-path-to-note>.md` to see how it was classified. The most common causes: the note lives under a `private/**` folder (a tripwire that overrides any frontmatter), the file matches an `ignore` glob in `apps/blog/noteforge.config.ts`, or the dev server hasn't picked up the change yet — try saving the note again, or restart `pnpm --filter blog dev`.

**Startup fails complaining that `OBPUB_VAULT_PATH` is unset.** noteforge can't find your vault. Confirm `.env` exists at the repo root and that `OBPUB_VAULT_PATH` points to an absolute path (not `~/...`). On WSL, your Windows vault is reachable through `/mnt/c/Users/...`. The shell session running `pnpm --filter blog dev` must inherit the variable, so if you set it in a different terminal, restart the dev server.

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

**v0.8.1** — first stable line. See [CHANGELOG.md](./CHANGELOG.md) for the full history.

## License

Released under [MIT](./LICENSE). This project never stores, transmits, analyzes, or sends telemetry from your vault content.
