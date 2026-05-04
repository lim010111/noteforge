<!-- repo: lim010111/obsidian-blog -->

# noteforge

> Privacy-first Astro SSG for selective Obsidian vault publishing. **What you do not mark, does not exist.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![GitHub release](https://img.shields.io/github/v/release/lim010111/obsidian-blog?include_prereleases&sort=semver)](https://github.com/lim010111/obsidian-blog/releases)

**Languages**: English · [한국어](./README.ko.md)

`noteforge` publishes only the notes you opt in to: those with `public: true` in frontmatter or a `#public` tag anywhere in the body. The default is **private** — the opposite of Quartz's opt-out default. Threat model and scope: [docs/PRD.md](./docs/PRD.md).

## Quick start

```bash
git clone https://github.com/lim010111/obsidian-blog my-blog && cd my-blog
pnpm install
cp .env.example .env        # OBPUB_VAULT_PATH=<your vault absolute path>
pnpm --filter blog dev      # http://localhost:4321
pnpm --filter blog build    # apps/blog/dist + audit
```

## Publishing a note

Set frontmatter `public: true` **or** include a `#public` tag anywhere in the body — either is enough. With neither, the note never reaches the build output.

Inspect the publish verdict for any file:

```bash
pnpm obpub status packages/core/tests/fixtures/vault-mixed/public-note.md
# → public-note.md → PUBLIC (reason: frontmatter public: true)
```

## Privacy contract

The `private/**` folder is a tripwire: notes inside it stay private even with `public: true` (override requires `unsafeAllowPrivateFolder: true`). Frontmatter is filtered through an allowlist (`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category`) — fields outside it never reach the rendered HTML. `%%...%%` Obsidian comments are stripped at the discovery phase. See [docs/PRD.md](./docs/PRD.md) and [SECURITY.md](./SECURITY.md) for the full threat model.

## Documentation

- [docs/PRD.md](./docs/PRD.md) — Threat model, scope
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Modules, pipeline, dependency graph
- [docs/DEPLOY.md](./docs/DEPLOY.md) — Cloudflare Pages, GitHub Pages, and other static hosts
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) — Design tokens and layout guide
- [docs/adr/](./docs/adr/) — Architecture decision records
- [CHANGELOG.md](./CHANGELOG.md) — Release notes
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Dev workflow, TDD, PR checklist
- [SECURITY.md](./SECURITY.md) — Vulnerability reporting
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Contributor Covenant v2.1

## Status

**v0.71** — leaf-category sidebar alignment + casing preservation (pre-release). Built on the v0.7 categories nav mode and v0.6 TOC layer. See [CHANGELOG.md](./CHANGELOG.md) for the full history.

## License

[MIT](./LICENSE). Vault content is never stored, transmitted, analyzed, or telemetered by this project.
