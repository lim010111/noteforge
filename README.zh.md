<!-- repo: lim010111/noteforge -->

# noteforge

> **语言**: [English](./README.md) · [한국어](./README.ko.md) · 简体中文

一个 privacy-first 的 Astro 静态站点生成器，**只发布你亲手 opt-in 的 Obsidian 笔记**。没标记的，绝不会出现在构建产物里。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![CI](https://img.shields.io/github/actions/workflow/status/lim010111/noteforge/ci.yml?branch=main)](https://github.com/lim010111/noteforge/actions)
[![Release](https://img.shields.io/github/v/release/lim010111/noteforge?include_prereleases&sort=semver)](https://github.com/lim010111/noteforge/releases)

![已发布的 noteforge 博客截图：左侧 CATEGORIES 侧边栏显示 `tools` > `cli`，主栏是 `cli` 分类的着陆页，顶部面包屑为 HOME / TOOLS / CLI](./docs/assets/blog-categories-overview.png)

## 关于

`noteforge` 只发布你显式标记的笔记 —— frontmatter 里写了 `public: true`，或正文带有 `#public` 标签。其他所有笔记默认私有，**未经允许任何内容都不会离开你的 vault**。这与 Quartz 的 opt-out 模型（默认全部发布，一个被遗忘的 `dg-publish: false` 就能泄露错误的笔记）完全相反。

隐私不是一个开关，而是整条流水线。frontmatter 经过 allowlist 过滤，`%%comments%%` 在任何其他步骤之前就被剥离，私有笔记的 `![[transclusion]]` 直接从 AST 中删除，post-build audit 还会扫描 `dist/` 以验证 canary 字符串没有泄漏。完整威胁模型见 [docs/PRD.md](./docs/PRD.md) 与 [SECURITY.md](./SECURITY.md)。

## 功能

- **Opt-in 发布** — frontmatter `public: true` **或** `#public` 标签。两条规则都在 [`packages/core/src/privacy/classify.ts`](./packages/core/src/privacy/classify.ts) 一处定义，绝不在别处重复。
- **`private/**` tripwire** — 任何位于 `private/` 文件夹下的笔记都保持私有，即便 frontmatter 写着 `public: true`。绕开它必须在配置中明确写 `unsafeAllowPrivateFolder: true`。
- **Frontmatter allowlist** — 只有 `title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category` 才能到达渲染后的 HTML。强制由 [`packages/core/src/privacy/frontmatterFilter.ts`](./packages/core/src/privacy/frontmatterFilter.ts) 负责。
- **注释与 transclusion 安全** — `%%...%%` 在 discovery 阶段就被移除；指向私有笔记的 `![[Note]]` 直接从 AST 删除，指向公开笔记的则递归走同一条流水线。
- **Post-build audit** — `obpub audit` 独立于 core 流水线扫描 `dist/`。这条 audit 中重新实现隐私逻辑是被明确禁止的（这是有意的双重检查）。
- **Obsidian 兼容写作** — wikilinks、callouts（官方 13 种 · 可折叠 / 嵌套）、KaTeX、attachment closure、基于 category 或 folder 的导航。
- **HMR 开发服务器** — 在 Obsidian 中修改一篇笔记，无需重启即可看到变化。

## 前置要求

- 一个 [Obsidian](https://obsidian.md/) vault（或任何 Markdown 文件夹），里面至少有一篇你想发布的笔记
- [Node.js](https://nodejs.org/) **22.6+** —— 推荐 LTS 22.11，仓库已附带 [`.nvmrc`](./.nvmrc)
- [pnpm](https://pnpm.io/installation) **10.x**
- [Git](https://git-scm.com/)

## 安装

```bash
# 1. 克隆仓库
git clone https://github.com/lim010111/noteforge my-blog && cd my-blog

# 2. 安装依赖
pnpm install

# 3. 告诉 noteforge 你的 vault 在哪里
cp .env.example .env
# 打开 .env，把 OBPUB_VAULT_PATH 设为你的 Obsidian vault 的绝对路径。
# 文件里给出了 macOS、Linux 和 WSL 的示例。

# 4. 启动开发服务器
pnpm --filter blog dev     # http://localhost:4321

# 5. 构建静态站点（会运行一次 post-build privacy audit）
pnpm --filter blog build   # 产物 → apps/blog/dist
```

> `--filter blog` 表示在 `blog` workspace 包（`apps/blog/`）里执行脚本。本 README 的所有 `dev` / `build` 命令都是相同方式。

如果开发服务器起来了但看不到任何笔记，请直接跳到[故障排查](#故障排查)。

## 用法

### 发布一篇笔记

打开 vault 里的任意笔记，要么在 frontmatter 中写 `public: true`，要么在正文任何位置加 `#public` 标签 —— 任一即可：

```yaml
---
title: 我的第一篇公开笔记
public: true
---

这篇笔记现在已公开。
```

保存文件，开发服务器会在下次刷新时自动反映。

### 查看某篇笔记的判定原因

```bash
pnpm obpub status "${OBPUB_VAULT_PATH}/path/to/your-note.md"
# → your-note.md → PUBLIC (reason: frontmatter public: true)
```

`obpub status` 调用的是与构建相同的 `classify` 函数，因此输出即为权威判定。

### 站点身份

站点元数据（标题、canonical URL、author、社交链接）与各 vault 的规则都在 [`apps/blog/noteforge.config.ts`](./apps/blog/noteforge.config.ts) 中。请先编辑 `site` 区块 —— 否则你的构建会以上游 demo 站点的身份发布：

```ts
// apps/blog/noteforge.config.ts
export default defineConfig({
  site: {
    title: 'My Notes',                     // ← 你的博客标题
    url: 'https://noteforge.pages.dev',    // ← 你的部署 URL
    author: 'Your Name',
    social: {
      // '' = "待设置" 占位（图标仍可见，点击会显示提示）。
      // 准备好之后替换成 'https://github.com/<your-username>'。
      github: '',
    },
  },
  vaults: [
    {
      id: 'primary',
      path: vaultPath,                                  // ← 从 OBPUB_VAULT_PATH 注入
      ignore: ['Templates/**', 'Excalidraw/**'],        // ← 完全跳过的文件夹
    },
  ],
});
```

该文件内联的注释覆盖了所有常用选项，包括 `nav.mode`、`privateLinkBehavior` 与 `unsafeAllowPrivateFolder` 覆盖开关。

### 分类

侧边栏树与每篇笔记的 URL 都由 `nav.mode` 控制。共支持两种模式，默认是 `'folder'`。

**`category` 模式** —— 每篇笔记 frontmatter 的 `category` 字段决定它在侧边栏中的位置，与它在 vault 中位于哪个文件夹无关。要使用此模式，在配置中设置 `nav: { mode: 'category' }`：

```yaml
---
title: pnpm workspace notes
public: true
category: tools/cli
---
```

上面这篇笔记会出现在侧边栏的 `tools > cli` 下，URL 为 `/tools/cli/<filename>/`。多级分类用 `/` 分隔。没有 `category` 字段的笔记会被归入侧边栏底部固定的 **Uncategorized** 分组。

![Obsidian 编辑器，笔记 frontmatter 含 `tags: - public` 与 `category: tools/cli`](./docs/assets/category-mode-obsidian_example.png)

**`folder` 模式（默认）** —— vault 的文件夹层级直接成为侧边栏与 URL，不需要写 `category` 字段。

![Obsidian 文件浏览器中的 vault 文件夹层级 `tools` > `cli` > "pnpm 워크스페이스 정리"](./docs/assets/folder-mode-obsidian_example.png)

上述两种例子在站点上渲染为完全相同的侧边栏树与 URL：

![noteforge 博客的 CATEGORIES 侧边栏显示 `tools` > `cli`，"cli" 着陆页列出 "pnpm 워크스페이스 정리" 并带 HOME / TOOLS / CLI 面包屑](./docs/assets/blog-categories-overview.png)

## 隐私是如何强制的

- **`private/**` tripwire** —— 位于 `private/` 文件夹下的任何笔记都保持私有，即使 frontmatter 写了 `public: true`。唯一的逃生口是配置中的 `unsafeAllowPrivateFolder: true`，且必须显式写出。
- **Frontmatter allowlist** —— 上述列表之外的字段绝不会出现在渲染后的 HTML 里，无论笔记如何声明。
- **注释剥离** —— Obsidian 的 `%%...%%` 在 discovery 阶段就被移除，比流水线其余任何步骤都更早。
- **Transclusion 把关** —— 指向私有笔记的 `![[Note]]` 从 AST 删除；指向公开笔记的则递归走同一条流水线。
- **Post-build audit** —— `pnpm obpub audit` 用 `@noteforge/cli` 的独立规则集再次检查 `dist/`，因此 core 的回归同样会被捕获。

测试 fixture 中埋的 canary 字符串（`DO_NOT_LEAK_BANANA_6f3c1`、`CLAUDE_COMMENT_LEAK_77b`、`FOLDER_TREE_DO_NOT_LEAK_8a4f2`）被断言为在渲染后的 HTML 中出现 **零次**。完整威胁模型在 [docs/PRD.md](./docs/PRD.md)，举报渠道与责任范围在 [SECURITY.md](./SECURITY.md)。

## 部署

`pnpm --filter blog build` 生成的 `apps/blog/dist/` 是一个任何静态主机都能直接托管的完整静态站点。仓库文档化的路径是 **Cloudflare Pages 的 Direct Upload**：

```bash
npm i -g wrangler
wrangler login
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=<your-project-name>
```

GitHub Pages、Netlify 等其它静态主机同样可用，只是不在仓库文档范围内 —— 因为构建运行在你本地机器上（你的绝对 vault 路径在 CI runner 中不存在）。Cloudflare 完整流程（含自定义域名）见 [docs/DEPLOY.md](./docs/DEPLOY.md)。

## 故障排查

**我标了 `public: true`，但笔记没出现。** 先用 `pnpm obpub status <笔记绝对路径>.md` 看看判定结果。常见原因：笔记位于 `private/**` 文件夹下（tripwire 覆盖 frontmatter）、文件命中了 `apps/blog/noteforge.config.ts` 的 `ignore` glob、开发服务器还没拾起变化 —— 再保存一次，或重启 `pnpm --filter blog dev`。

**启动时报 `OBPUB_VAULT_PATH` 未设置。** noteforge 找不到你的 vault。确认仓库根目录有 `.env`，且 `OBPUB_VAULT_PATH` 指向一个绝对路径（不能是 `~/...`）。WSL 用户的 Windows vault 可通过 `/mnt/c/Users/...` 访问。运行 `pnpm --filter blog dev` 的 shell 必须继承该环境变量，所以如果在另一个终端导出，请重启开发服务器。

## 架构

`noteforge` 是一个 pnpm workspace monorepo，包含四个包加一个 dogfood 应用：

| 包 | 角色 |
|----|------|
| [`@noteforge/core`](./packages/core) | 框架无关的隐私流水线。`isPublic`、frontmatter allowlist、transclusion、attachment closure 的单一来源。 |
| [`@noteforge/astro`](./packages/astro-integration) | Astro 5 Content Layer loader + chokidar watcher。把 core 接入 dev / build 生命周期。 |
| [`@noteforge/theme-default`](./packages/theme-default) | 参考 Astro 主题。只消费已过滤的输出，禁止直接读 raw vault。 |
| [`@noteforge/cli`](./packages/cli) | `obpub` CLI（`dev` / `build` / `audit` / `status`）。 |
| [`apps/blog`](./apps/blog) | 仓库内的 dogfood 站点。 |

模块全景见 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)，各包的责任边界见各目录下的 `CLAUDE.md`。

## 贡献

欢迎贡献。完整工作流、TDD 规则与 PR 清单见 [CONTRIBUTING.md](./CONTRIBUTING.md)。简版：

```bash
pnpm install
pnpm -r typecheck && pnpm lint && pnpm test && pnpm --filter blog build
```

涉及 `packages/core/src/privacy/**` 的 PR 必须保持 canary 断言通过，且与普通功能 PR 分开审阅。

## 文档

- [docs/PRD.md](./docs/PRD.md) —— 威胁模型，覆盖范围与不覆盖的部分
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) —— 模块、流水线、依赖图
- [docs/DEPLOY.md](./docs/DEPLOY.md) —— Cloudflare Pages、GitHub Pages 及其它静态主机
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) —— 设计 token 与布局指南
- [docs/adr/](./docs/adr/) —— 架构决策记录（ADR）
- [CHANGELOG.md](./CHANGELOG.md) —— 发布日志
- [CONTRIBUTING.md](./CONTRIBUTING.md) —— 开发工作流、TDD、PR 清单
- [SECURITY.md](./SECURITY.md) —— 安全问题上报方式
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) —— Contributor Covenant v2.1

## 状态

**v0.8.1** —— 首个稳定线。完整历史见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

以 [MIT 许可证](./LICENSE) 发布。本项目不存储、不传输、不分析你的 vault 内容，也不发送任何遥测。
