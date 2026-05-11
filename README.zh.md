<!-- repo: lim010111/noteforge -->

# noteforge

> 一个 privacy-first 的 Astro 静态站点生成器，只把你亲手挑选的 Obsidian 笔记发布成静态博客。**没标记的，就不存在。**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![GitHub release](https://img.shields.io/github/v/release/lim010111/noteforge?include_prereleases&sort=semver)](https://github.com/lim010111/noteforge/releases)

**语言**: [English](./README.md) · [한국어](./README.ko.md) · 简体中文

`noteforge` 只发布你显式 opt-in 的笔记 —— frontmatter 里写了 `public: true`，或者正文中带有 `#public` 标签的笔记。其他所有内容都不会进入构建产物。这与 Quartz 的 opt-out 默认完全相反：除非你明确允许，否则任何内容都不会离开你的 vault。完整的威胁模型以及本项目刻意不覆盖的范围，请见 [docs/PRD.md](./docs/PRD.md)。

![已发布的 noteforge 博客截图：左侧 CATEGORIES 侧边栏显示 `tools` > `cli`，主栏是 `cli` 分类的着陆页，顶部面包屑为 HOME / TOOLS / CLI](./docs/assets/blog-categories-overview.png)

## 前置要求

克隆仓库前请确认你已具备：

- 一个 [Obsidian](https://obsidian.md/) vault（或任何包含 Markdown 文件的文件夹），里面至少有一篇你想发布的笔记
- [Node.js](https://nodejs.org/) **22.6+** —— 推荐 LTS 22.11（仓库已附带 `.nvmrc`）
- [pnpm](https://pnpm.io/installation) **10.x**
- [Git](https://git-scm.com/)

## 快速开始

```bash
# 1. 把仓库克隆到你想放的目录
git clone https://github.com/lim010111/noteforge my-blog && cd my-blog

# 2. 安装依赖
pnpm install

# 3. 告诉 noteforge 你的 vault 在哪里
cp .env.example .env
#    用编辑器打开 .env，把 OBPUB_VAULT_PATH 设置为你 Obsidian vault 的
#    绝对路径。.env.example 里有 macOS、Linux、WSL 的示例。

# 4. 启动开发服务器
pnpm --filter blog dev      # 默认在 http://localhost:4321 打开

# 5. （之后）构建用于部署的静态站点
pnpm --filter blog build    # 输出到 apps/blog/dist 并自动跑一遍 privacy audit
```

> `--filter blog` 这个参数告诉 pnpm 在 `blog` 工作区包（即 `apps/blog/`）内执行该脚本。本 README 中所有的 `dev` / `build` 命令都按这种方式工作。

如果开发服务器启动了但看不到任何笔记，请跳到 [问题排查](#问题排查) 一节。

## 发布一篇笔记

在 Obsidian 中打开 vault 里的任意笔记，要么在 frontmatter 里写上 `public: true`，要么在正文任意位置加一个 `#public` 标签 —— 二者满足其一即可。保存文件后，开发服务器会在下一次刷新时自动识别。

```yaml
---
title: 我的第一篇公开笔记
public: true
---

这篇笔记现在是公开的了。
```

如果想确认某篇笔记为什么会（或不会）被发布，可以用 status 命令。路径既可以相对于当前 shell，也可以是绝对路径：

```bash
pnpm obpub status "$OBPUB_VAULT_PATH/path/to/your-note.md"
# → your-note.md → PUBLIC (reason: frontmatter public: true)
```

## 自定义你的站点

站点身份信息（标题、canonical URL、作者、社交链接）以及每个 vault 的具体行为（要忽略的目录、主题）都集中在 **`apps/blog/noteforge.config.ts`** 里。`pnpm install` 之后请第一时间打开它，先把 `site` 字段改成你自己的内容 —— 否则构建产物会带着上游 demo 站点的身份发布出去：

```ts
// apps/blog/noteforge.config.ts
export default defineConfig({
  site: {
    title: 'My Notes',                      // ← 你的博客标题
    url: 'https://noteforge.pages.dev',     // ← 你部署后的 URL
    author: 'Your Name',                    // ← 你的名字
    social: {
      // '' = "需要设置" stub（图标可见，点击会提示该填到哪里）。
      // 把它替换成 'https://github.com/<your-username>' 即可启用真链接。
      github: '',
    },
  },
  vaults: [
    {
      id: 'primary',
      path: vaultPath,                      // ← 来自 OBPUB_VAULT_PATH
      ignore: ['Templates/**', 'Excalidraw/**'], // ← 完全忽略的文件夹
    },
  ],
  // ... 完整选项见文件中的内联注释
});
```

文件内的注释覆盖了你大概率会改动的全部选项，包括 `nav.mode`、`privateLinkBehavior`，以及 `unsafeAllowPrivateFolder` tripwire 覆写开关。

## 分类

侧边栏的层级结构以及每篇已发布笔记的 URL，都由 `nav.mode` 决定。一共有两种模式可选，默认值是 `'category'`。

### `category` 模式（默认）

每篇笔记 frontmatter 里的 `category` 字段决定它出现在侧边栏的什么位置、URL 长什么样。笔记按你设定的分类名分组，与它在 vault 里实际所在的文件夹无关 —— 这意味着你在 Obsidian 里整理文件的方式可以和读者在站点上看到的分组完全独立。

```yaml
---
title: pnpm 工作区笔记
public: true
category: tools
---
```

上面这篇笔记会出现在侧边栏的 `tools` 分组下，URL 变成 `/tools/pnpm 工作区笔记/`。

要使用嵌套分类，用斜杠 (`/`) 分隔层级。例如 `category: tools/cli` 会把笔记放到侧边栏的 `tools > cli` 树下，URL 为 `/tools/cli/...`。

![Obsidian 编辑器中显示一篇 "pnpm 워크스페이스 정리" 的笔记，frontmatter 里有 `tags: - public` 和 `category: tools/cli`](./docs/assets/category-mode-obsidian_example.png)

笔记本身可以放在 vault 内的任何位置 —— 决定它在站点上位置的是 `category` 字段。

没有 `category` 字段的笔记会被收进侧边栏底部的 **Uncategorized** 分组，URL 只用文件名（`/<filename>/`）。

### `folder` 模式

在这个模式下，vault 的目录结构会被直接用作侧边栏和 URL 的来源。每篇笔记不需要再加 `category` 字段 —— 你磁盘上的目录层级原样变成站点的分类树。

![Obsidian 文件浏览器显示 vault 目录层级 `tools` > `cli` > "pnpm 워크스페이스 정리"](./docs/assets/folder-mode-obsidian_example.png)

要切换到这个模式，请在 `noteforge.config.ts` 中显式设置：

```ts
// noteforge.config.ts
export default defineConfig({
  // ...
  nav: { mode: 'folder' },
});
```

如果你的 vault 已经按你想要的站点结构整理好了，这个模式很顺手。如果你更希望在 vault 内自由整理，但在站点上以另一种方式分组给读者，那默认的 `'category'` 模式更合适。

上面两个例子 —— frontmatter 里的 `category: tools/cli` 与 vault 中的 `tools/cli/` 文件夹 —— 描述的是同一个目的地。它们在已发布的博客中渲染出完全一致的侧边栏树和 URL：

![noteforge 博客的 CATEGORIES 侧边栏显示 `tools` > `cli`，"cli" 着陆页列出 "pnpm 워크스페이스 정리"，顶部面包屑为 HOME / TOOLS / CLI](./docs/assets/blog-categories-overview.png)

## 隐私是如何被强制保证的

`private/**` 文件夹是一道 tripwire：里面的任何笔记都保持私有，即使 frontmatter 中写了 `public: true` 也无效。要绕过这个规则，必须在配置里显式设置 `unsafeAllowPrivateFolder: true`。

frontmatter 会经过一份 allowlist 过滤（`title`、`description`、`date`、`updated`、`tags`、`aliases`、`cover`、`thumbnail`、`author`、`draft`、`public`、`slug`、`permalink`、`lang`、`featured`、`category`），不在这份白名单上的字段永远不会进入渲染后的 HTML。

Obsidian 的 `%%...%%` 注释会在 discovery 阶段（管线最前面）被剥离，因此不会出现在后续任何环节里。

完整的威胁模型见 [docs/PRD.md](./docs/PRD.md) 与 [SECURITY.md](./SECURITY.md)。

## 部署

`pnpm --filter blog build` 会在 `apps/blog/dist/` 生成一个完整的静态站点，任何静态托管平台都能直接 serve。本仓库正式记录的部署路径是 **通过 Direct Upload 部署到 Cloudflare Pages**：

```bash
npm i -g wrangler
wrangler login
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=<your-project-name>
```

GitHub Pages、Netlify 以及其他静态托管平台同样可用，只是没在本仓库的文档中覆盖 —— 因为构建是在你本地机器上跑的（你的绝对 vault 路径在 CI runner 上并不存在）。包含自定义域名的完整 Cloudflare 部署流程见 [docs/DEPLOY.md](./docs/DEPLOY.md)。

## 问题排查

**我标了 `public: true` 的笔记没有出现。** 跑一下 `pnpm obpub status <笔记的绝对路径>.md`，看它被怎么分类了。最常见的原因有：笔记落在 `private/**` 目录下（tripwire 会覆盖任何 frontmatter）、文件命中了 `apps/blog/noteforge.config.ts` 中的 `ignore` glob，或者开发服务器还没接到改动 —— 试着重新保存笔记，或者重启 `pnpm --filter blog dev`。

**启动时报错说 `OBPUB_VAULT_PATH` 没设置。** noteforge 找不到你的 vault。请确认 `.env` 文件就在仓库根目录下，并且 `OBPUB_VAULT_PATH` 是绝对路径（不能用 `~/...`）。在 WSL 上，Windows 里的 vault 通过 `/mnt/c/Users/...` 访问。运行 `pnpm --filter blog dev` 的 shell 会话必须能继承到这个变量，所以如果你在另一个终端里设置了它，请重启开发服务器。

## 文档

- [docs/PRD.md](./docs/PRD.md) — 威胁模型，以及范围内 / 范围外的内容
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 模块、管线与依赖关系图
- [docs/DEPLOY.md](./docs/DEPLOY.md) — Cloudflare Pages、GitHub Pages 以及其他静态托管
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) — 设计 token 与排版指南
- [docs/adr/](./docs/adr/) — 架构决策记录（ADR）
- [CHANGELOG.md](./CHANGELOG.md) — 发布日志
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 开发流程、TDD、PR 检查表
- [SECURITY.md](./SECURITY.md) — 安全问题上报方式
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Contributor Covenant v2.1

## 状态

**v0.8.1** —— 第一个稳定版本系列。完整历史见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

以 [MIT](./LICENSE) 协议发布。本项目从不存储、传输、分析你 vault 的内容，也不会发送任何遥测信息。
