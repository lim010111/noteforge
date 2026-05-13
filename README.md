<!-- repo: lim010111/noteforge -->

# noteforge

> **Languages**: English · [한국어](./README.ko.md) · [简体中文](./README.zh.md)

A privacy-first Astro static site generator that publishes **only the Obsidian notes you explicitly opt in**. What you don't mark, doesn't ship.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![CI](https://img.shields.io/github/actions/workflow/status/lim010111/noteforge/ci.yml?branch=main)](https://github.com/lim010111/noteforge/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lim010111/noteforge?include_prereleases&sort=semver)](https://github.com/lim010111/noteforge/releases)

![Screenshot of a published noteforge blog: a CATEGORIES sidebar showing `tools` > `cli`, with the `cli` category landing page in the main column and a HOME / TOOLS / CLI breadcrumb at the top](./docs/assets/blog-categories-overview.png)

## About

`noteforge` publishes only the notes you explicitly mark — `public: true` in frontmatter, or a `#public` tag in the body. The default for every other note is private, and **nothing leaves the vault unless you say so**. This inverts Quartz's opt-out model, where the default is "publish everything" and a forgotten `dg-publish: false` can leak the wrong note.

Privacy isn't a flag — it's the whole pipeline. Frontmatter is filtered through an allowlist, `%%comments%%` are stripped before any other step runs, `![[transclusions]]` of private notes are deleted from the AST, and a post-build audit scans `dist/` for canary leaks. The threat model is enumerated in [docs/PRD.md](./docs/PRD.md) and [SECURITY.md](./SECURITY.md).

## Features

- **Opt-in publishing** — `public: true` frontmatter **or** `#public` tag. Both rules live in [`packages/core/src/privacy/classify.ts`](./packages/core/src/privacy/classify.ts) and nowhere else.
- **`private/**` tripwire** — any note under a `private/` folder stays private even when frontmatter says `public: true`. Bypassing it requires `unsafeAllowPrivateFolder: true` in config.
- **Frontmatter allowlist** — only `title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category` reach rendered HTML. Enforced by [`packages/core/src/privacy/frontmatterFilter.ts`](./packages/core/src/privacy/frontmatterFilter.ts).
- **Comment + transclusion safety** — `%%...%%` removed in the discovery phase; private `![[Note]]` transclusions deleted from the AST; public ones recurse through the same pipeline.
- **Post-build audit** — `obpub audit` scans `dist/` independently of the core pipeline. Re-implementing privacy logic in this audit is forbidden by design (intentional double-check).
- **Obsidian-compatible authoring** — wikilinks, callouts (13 official kinds, foldable + nested), KaTeX, attachment closure, category-based or folder-based navigation.
- **HMR dev server** — change a note in Obsidian, see it reflected without restarting.

## Prerequisites

- An [Obsidian](https://obsidian.md/) vault (or any folder of Markdown files) with at least one note you want to publish
- [Node.js](https://nodejs.org/) **22.6+** — LTS 22.11 recommended; a [`.nvmrc`](./.nvmrc) is provided
- [pnpm](https://pnpm.io/installation) **10.x**
- [Git](https://git-scm.com/)

## Installation

```bash
# 1. Clone the repo
git clone https://github.com/lim010111/noteforge my-blog && cd my-blog

# 2. Install dependencies
pnpm install

# 3. Point noteforge at your vault
cp .env.example .env
# Open .env and set OBPUB_VAULT_PATH to the absolute path of your
# Obsidian vault. Examples for macOS, Linux, and WSL are in the file.

# 4. Start the dev server
pnpm --filter blog dev     # http://localhost:4321

# 5. Build for static hosting (runs a post-build privacy audit)
pnpm --filter blog build   # output → apps/blog/dist
```

> `--filter blog` runs the script inside the `blog` workspace package (`apps/blog/`). Every `dev` / `build` command in this README works the same way.

If the dev server starts but no notes appear, jump to [Troubleshooting](#troubleshooting).

## Usage

### Publishing a note

Open any note in your vault and either set `public: true` in frontmatter or drop a `#public` tag anywhere in the body — either one is sufficient on its own:

```yaml
---
title: My first published note
public: true
---

This note is now public.
```

Save the file; the dev server picks it up on next reload.

### Why is (or isn't) a note public?

```bash
pnpm obpub status "${OBPUB_VAULT_PATH}/path/to/your-note.md"
# → your-note.md → PUBLIC (reason: frontmatter public: true)
```

`obpub status` calls the same `classify` function the build does, so its answer is authoritative.

### Site identity

Site metadata (title, canonical URL, author, social links) and per-vault rules live in [`apps/blog/noteforge.config.ts`](./apps/blog/noteforge.config.ts). Edit the `site` block first — otherwise your build is branded as the upstream demo:

```ts
// apps/blog/noteforge.config.ts
export default defineConfig({
  site: {
    title: 'My Notes',                     // ← your blog title
    url: 'https://noteforge.pages.dev',    // ← your deployed URL
    author: 'Your Name',
    social: {
      // '' = "needs setup" stub (icon visible, click opens a hint).
      // Replace with 'https://github.com/<your-username>' when ready.
      github: '',
    },
  },
  vaults: [
    {
      id: 'primary',
      path: vaultPath,                                  // ← from OBPUB_VAULT_PATH
      ignore: ['Templates/**', 'Excalidraw/**'],        // ← folders skipped entirely
    },
  ],
});
```

Inline comments in that file cover every option, including `nav.mode`, `privateLinkBehavior`, and the `unsafeAllowPrivateFolder` override.

### Categories

The sidebar tree and the URL of each note are both controlled by `nav.mode`. Two modes are supported; the default is `'category'`.

**`category` mode (default)** — each note's `category` frontmatter field decides where it appears, regardless of which folder it lives in:

```yaml
---
title: pnpm workspace notes
public: true
category: tools/cli
---
```

The note above lands under `tools > cli` in the sidebar and at `/tools/cli/<filename>/`. Nested categories use `/` as the separator. Notes without a `category` field are gathered into a pinned **Uncategorized** group at the bottom.

![Obsidian editor showing a note with frontmatter `tags: - public` and `category: tools/cli`](./docs/assets/category-mode-obsidian_example.png)

**`folder` mode** — your vault's folder layout becomes the sidebar and the URL as-is, with no `category` field needed. Switch by setting `nav: { mode: 'folder' }` in the config.

![Obsidian file explorer showing the vault folder hierarchy `tools` > `cli` > "pnpm 워크스페이스 정리"](./docs/assets/folder-mode-obsidian_example.png)

Both examples above render to identical sidebar trees and URLs on the published site:

![noteforge blog with CATEGORIES sidebar showing `tools` > `cli`, and a "cli" landing page listing "pnpm 워크스페이스 정리" with breadcrumb HOME / TOOLS / CLI](./docs/assets/blog-categories-overview.png)

## How privacy is enforced

- **`private/**` tripwire** — any note inside a `private/` folder stays private even when its frontmatter says `public: true`. The only escape hatch is `unsafeAllowPrivateFolder: true` in your config, and it requires the explicit comment in the config file to ship.
- **Frontmatter allowlist** — fields outside the list above never reach rendered HTML, regardless of what the note declares.
- **Comment stripping** — Obsidian's `%%...%%` comments are removed during the discovery phase, before any other step in the pipeline runs.
- **Transclusion gating** — `![[Note]]` to a private target is deleted from the AST. Public targets recurse through the same pipeline.
- **Post-build audit** — `pnpm obpub audit` re-checks `dist/` against a separate set of rules from `@noteforge/cli`, so a regression in core would still get caught.

Canary strings (`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, `FOLDER_TREE_DO_NOT_LEAK_8a4f2`) are planted in the test fixtures and asserted to appear **zero times** in the rendered HTML. The full threat model lives in [docs/PRD.md](./docs/PRD.md); the reporting channel and in/out-of-scope categories are in [SECURITY.md](./SECURITY.md).

## Deploying

`pnpm --filter blog build` produces a fully static site in `apps/blog/dist/` that any static host can serve. The documented path is **Cloudflare Pages via Direct Upload**:

```bash
npm i -g wrangler
wrangler login
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=<your-project-name>
```

GitHub Pages, Netlify, and other static hosts work too — they just aren't covered in this repo's docs, because the build runs locally on your machine (your absolute vault path won't exist on a CI runner). See [docs/DEPLOY.md](./docs/DEPLOY.md) for the full Cloudflare walkthrough including custom domains.

## Troubleshooting

**The note I marked `public: true` doesn't show up.** Run `pnpm obpub status <absolute-path-to-note>.md` to see how it was classified. Common causes: the note lives under a `private/**` folder (tripwire overrides frontmatter), the file matches an `ignore` glob in `apps/blog/noteforge.config.ts`, or the dev server hasn't picked up the change yet — save the note again or restart `pnpm --filter blog dev`.

**Startup fails with `OBPUB_VAULT_PATH` unset.** noteforge can't find your vault. Confirm `.env` exists at the repo root and that `OBPUB_VAULT_PATH` points to an absolute path (not `~/...`). On WSL, your Windows vault is reachable through `/mnt/c/Users/...`. The shell session running `pnpm --filter blog dev` must inherit the variable — if you exported it in a different terminal, restart the dev server.

## Architecture

`noteforge` is a pnpm workspace monorepo with four packages plus a dogfood app:

| Package | Role |
|---------|------|
| [`@noteforge/core`](./packages/core) | Framework-independent privacy pipeline. Single source of truth for `isPublic`, frontmatter allowlist, transclusion, attachment closure. |
| [`@noteforge/astro`](./packages/astro-integration) | Astro 5 Content Layer loader + chokidar watcher. Adapts core to the dev / build lifecycle. |
| [`@noteforge/theme-default`](./packages/theme-default) | Reference Astro theme. Consumes already-filtered output only — no raw vault access. |
| [`@noteforge/cli`](./packages/cli) | The `obpub` CLI (`dev` / `build` / `audit` / `status`). |
| [`apps/blog`](./apps/blog) | Dogfood site that ships in the repo. |

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the module map and the per-package `CLAUDE.md` files for ownership boundaries.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow, TDD rules, and PR checklist. The short version:

```bash
pnpm install
pnpm -r typecheck && pnpm lint && pnpm test && pnpm --filter blog build
```

Privacy-related PRs (anything touching `packages/core/src/privacy/**`) must keep the canary assertions green and are reviewed separately from feature PRs.

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

**v0.8.1** — first stable line. Full history in [CHANGELOG.md](./CHANGELOG.md).

## License

Released under the [MIT License](./LICENSE). This project never stores, transmits, analyzes, or sends telemetry from your vault content.
