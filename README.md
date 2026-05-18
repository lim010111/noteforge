> [English](README.md) · [한국어](README.ko.md)

<h1 align="center">noteforge</h1>

<p align="center">
  <em>A privacy-first Astro SSG that publishes <strong>only the Obsidian notes you opt in to publish</strong>.</em>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D22.6-339933?logo=node.js&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-10.x-F69220?logo=pnpm&logoColor=white">
  <img alt="Astro" src="https://img.shields.io/badge/astro-5.x-BC52EE?logo=astro&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-strict-3178C6?logo=typescript&logoColor=white">
</p>

---

## What is noteforge?

**noteforge** turns an Obsidian vault into a static site, but inverts the
default of every alternative: nothing is public until you say so. Mark a note
with `public: true` in its frontmatter or tag it `#public`, and only those
notes — together with the attachments they reference — appear in the build.

The pipeline treats every other leakage surface as a first-class concern:

- `[[Note]]` links to private targets are rewritten to plain text (no title leak).
- `![[Note]]` embeds of private targets are removed from the AST entirely.
- `%%comment%%` Obsidian comments are stripped before rendering.
- Frontmatter is filtered to an explicit allowlist before reaching HTML / meta.
- Private folders (`private/**`) are a tripwire that `public: true` cannot bypass.
- The post-build audit scans `dist/` independently and fails the build on any leak.

If Quartz's "publish everything by default" model makes you nervous, this is
the opposite shape of the same idea.

## Why?

| Tool                 | Default     | Notable gap                                                                |
|----------------------|-------------|----------------------------------------------------------------------------|
| Obsidian Publish     | opt-in      | Paid, hosted, lock-in.                                                     |
| Quartz v4            | opt-**out** | Private titles leak through graph / backlinks of public notes.             |
| Digital Garden       | opt-in      | No coverage of transclusions, comments, frontmatter, attachments.          |
| **noteforge**        | **opt-in**  | Every leakage path is part of the contract; post-build audit fails on leak.|

See [`docs/PRD.md`](./docs/PRD.md) for the full positioning, and
[`docs/adr/0001-privacy-first-opt-in.md`](./docs/adr/0001-privacy-first-opt-in.md)
for the decision record behind the opt-in default.

## Features

- **Opt-in publishing** — `public: true` frontmatter *or* `#public` tag.
  Defaults defined in [`packages/core/src/config.ts`](./packages/core/src/config.ts):
  `requireExplicitOptIn: true`, `frontmatterKey: 'public'`, `publicTag: 'public'`.
- **Frontmatter allowlist** — `title`, `description`, `date`, `updated`, `tags`,
  `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`,
  `lang`, `featured`, `category`. Anything else is dropped before HTML / `<meta>` /
  feeds. ([`docs/adr/0002-allowlist-frontmatter.md`](./docs/adr/0002-allowlist-frontmatter.md))
- **`private/**` tripwire** — a path-based hard rule; `public: true` does not
  override it. The override (`unsafeAllowPrivateFolder: true`) exists but is
  explicit and noisy.
- **Wikilink / transclusion gating** — `[[Note]]` and `![[Note]]` resolved
  through `@noteforge/core`'s `linkRewriter` and `transclude` passes.
- **Attachment closure** — `dist/` includes only attachments that public notes
  actually reference, with an allowlisted extension. Cover / thumbnail images
  in frontmatter pass through the same gate.
- **Markdown extras** — Obsidian-style callouts (13 official types + aliases,
  foldable variants), KaTeX, autolinked headings, syntax highlight via Shiki.
- **Live dev server** — chokidar watcher + Astro Content Layer invalidation;
  HMR reflects vault edits without restart.
- **Post-build audit** — `obpub audit` scans `dist/` for leaks (private titles,
  blocklisted tags, `%%...%%` residue, non-allowlist frontmatter, out-of-closure
  attachments). Failures non-zero exit, so CI / wrappers can gate releases.
- **Self-hosted assets** — `vendor:assets` script vendors fonts + KaTeX locally
  before each build so the site has no third-party font / CDN dependency.
- **Reference theme** — `@noteforge/theme-default` (Astro + Tailwind v4), with
  light/dark toggle, sidebar folder tree, table of contents, and a graph view.

## Quickstart

Requires **Node 22.6+** (LTS 22.11 recommended; see [`.nvmrc`](./.nvmrc)) and
**pnpm 10.x**.

```bash
# 1. clone and install
git clone https://github.com/lim010111/noteforge.git
cd noteforge
pnpm install

# 2. point at your Obsidian vault
cp .env.example .env
# then edit .env and set OBPUB_VAULT_PATH to the absolute path of your vault

# 3. mark a note as public
#    in any *.md inside your vault, add this frontmatter:
#      ---
#      public: true
#      ---
#    or add `#public` somewhere in the body / tags.

# 4. run the dev server
pnpm --filter blog dev
```

Open the URL Astro prints (usually `http://localhost:4321/`). Toggle
`public: true` in a note and watch the page appear / disappear without
restarting the dev server.

To verify a single note's classification:

```bash
pnpm obpub status "path/to/Some Note.md"
```

To produce a static site:

```bash
pnpm --filter blog build
```

The build runs the post-build audit automatically; if any leakage signal is
found, the build fails with a non-zero exit code and the offending evidence
is printed to stderr.

## Project structure

This is a pnpm-workspaces monorepo. Roles are kept separable so the privacy
core can be reused outside Astro later.

```
noteforge/
├── packages/
│   ├── core/                # @noteforge/core — framework-independent engine
│   ├── astro-integration/   # @noteforge/astro — Content Layer + watcher
│   ├── theme-default/       # @noteforge/theme-default — reference theme
│   └── cli/                 # @noteforge/cli — `obpub` binary
├── apps/
│   └── blog/                # dogfood site (uses all of the above)
├── docs/                    # PRD, ARCHITECTURE, ADR, DEPLOY, UI_GUIDE
└── evals/                   # agent-driven regression placeholder
```

Each package owns one responsibility:

| Package                       | Role                                                                                          |
|-------------------------------|-----------------------------------------------------------------------------------------------|
| `@noteforge/core`             | Vault discovery → classify → link rewrite → render. The single privacy decision point.        |
| `@noteforge/astro`            | Astro integration: Content Layer loader, chokidar watcher, MDX wikilink bridge.               |
| `@noteforge/theme-default`    | Astro + Tailwind v4 reference theme. Components consume core; no privacy logic of its own.    |
| `@noteforge/cli`              | `obpub` commands: `dev`, `build`, `audit`, `status`. Independent re-verification of `dist/`.  |
| `apps/blog`                   | Dogfood site; carries the SSOT `noteforge.config.ts`.                                         |

The pipeline phases (`A. Discovery → B. Classify → C. Render → D. Audit`) are
described in detail in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## CLI reference

The CLI is `obpub`, exposed both as a workspace script and as a built binary
in `packages/cli/dist/bin.js` (after `pnpm --filter @noteforge/cli build`).

```bash
pnpm obpub <command> [options]
# or, after building:
node packages/cli/dist/bin.js <command> [options]
```

| Command                     | Purpose                                                                |
|-----------------------------|------------------------------------------------------------------------|
| `obpub dev`                 | Wrap `astro dev` with HMR. Extra args pass through.                    |
| `obpub build`               | `astro build`, then run the post-build audit. `--no-audit` to skip.    |
| `obpub audit`               | Scan a `dist/` directory for leaks. `--strict` and `--json` supported. |
| `obpub status <file>`       | Print `PUBLIC` / `PRIVATE` for a given note with the reason. `--json`. |

Global flags: `-c, --config <path>` to override the config file location.

## Configuration

The single source of truth lives at `apps/blog/noteforge.config.ts`. It is
typed against the schema in `@noteforge/core` and validated with zod, so
incorrect shape fails fast at load time, not at render time.

Required environment variable:

| Variable            | Purpose                                                              |
|---------------------|----------------------------------------------------------------------|
| `OBPUB_VAULT_PATH`  | Absolute path to your Obsidian vault. Set in `.env` or your shell.   |

Minimal config:

```ts
// apps/blog/noteforge.config.ts
import { defineConfig } from '@noteforge/core';

export default defineConfig({
  site: {
    title: 'My Notes',
    url: 'https://example.pages.dev',
    author: 'Your Name',
    social: { github: 'https://github.com/your-name' }, // empty string = "needs setup" stub icon
  },
  vaults: [
    {
      id: 'primary',
      path: process.env.OBPUB_VAULT_PATH!,
      urlPrefix: '/',
      theme: '@noteforge/theme-default',
      ignore: ['Templates/**', 'Excalidraw/**', 'attachments/**'],
    },
  ],
  publishing: { requireExplicitOptIn: true },
  privateLinkBehavior: 'strip-to-text',
});
```

Notable advanced toggles (all optional):

- `publishing.frontmatterAllowlist` / `tagBlocklist` — extend the defaults.
- `attachments.uploadDir` / `uploadMaxBytes` / `allowedExtensions` — closure scope.
- `nav.mode` — `'folder'` (default) or `'category'` for the sidebar tree.
- `unsafeAllowPrivateFolder` — disables the `private/**` tripwire; **only set
  this if you are certain.**

The MVP enforces **one vault per project** (the schema rejects more than one
entry). Multi-vault support is on the roadmap (see `docs/PRD.md`).

## Deploy

`apps/blog/dist/` is a plain Astro static build, so any static host works.
The reference path is **Cloudflare Pages**, deployed by Direct Upload from a
**local build** — never from CI, because the vault path is local to your
machine.

```bash
pnpm install
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=noteforge
```

GitHub Pages, Vercel (`vercel deploy --prebuilt`), and Netlify are covered in
[`docs/DEPLOY.md`](./docs/DEPLOY.md), along with the rationale for not wiring
up automatic CI deploys.

## Privacy contract & audit

Because privacy is the load-bearing feature, three regression mechanisms run
together:

1. **Single decision point** — `packages/core/src/privacy/classify.ts` is the
   only place `isPublic()` is computed. ESLint blocks `@noteforge/core/<subpath>`
   imports so consumers cannot reimplement it sideways.
2. **Canary fixtures** — `packages/core/tests/fixtures/vault-mixed/` carries
   the strings `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, and
   `FOLDER_TREE_DO_NOT_LEAK_8a4f2` in private content. Vitest asserts they
   appear **zero times** in rendered output.
3. **Independent post-build audit** — `obpub audit` re-scans `dist/` against
   the same rules without sharing code with the core pipeline. Defense in depth.

If you find a leak path that is not blocked, please report it through
[`SECURITY.md`](./SECURITY.md) (GitHub private vulnerability reporting), not
the public issue tracker, and prefer synthetic fixtures over your real vault.

## Development

```bash
pnpm install
pnpm -r typecheck                    # TypeScript strict, all packages
pnpm lint                            # ESLint flat config
pnpm test                            # Vitest, all workspaces
pnpm --filter blog build             # build + audit, end-to-end
pnpm validate:context-paths          # checks CLAUDE.md / AGENTS.md path references
```

Before opening a PR, run all four of these. The full checklist and
TDD-for-privacy expectations live in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Documentation map

| Path                                       | What it covers                                                       |
|--------------------------------------------|----------------------------------------------------------------------|
| [`docs/PRD.md`](./docs/PRD.md)             | Goals, target users, MVP scope, success metrics.                     |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Monorepo layout, pipeline phases, dataflow, framework boundaries. |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md)       | Cloudflare Pages + alternative static hosts. Local-build constraint. |
| [`docs/UI_GUIDE.md`](./docs/UI_GUIDE.md)   | Theme contract, design tokens, motion rules.                         |
| [`docs/adr/`](./docs/adr/)                 | Architecture Decision Records, numbered, dated.                      |
| [`CHANGELOG.md`](./CHANGELOG.md)           | Keep-a-Changelog history, with a Privacy / Security note per release.|
| [`SECURITY.md`](./SECURITY.md)             | Threat scope, reporting channel, response targets.                   |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)     | Dev environment, commit convention, PR checklist.                    |

## Status

This project is in the **0.x** line — interfaces (config schema, theme
component props, CLI flags) may shift between minor releases. The privacy
contract itself is intended to be the stable surface across the 0.x line;
any change there is called out in `CHANGELOG.md` under **Privacy / Security**.

## License

[MIT](./LICENSE) — Copyright (c) 2026 woohyun and noteforge contributors.
