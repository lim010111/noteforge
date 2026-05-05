<!-- repo: lim010111/noteforge -->

# noteforge

> Obsidian vault에서 직접 고른 노트만 정적 블로그로 배포하는 프로젝트입니다. **Privacy-first** — 명시적으로 공개 표시를 한 노트가 아니면 결과물 어디에도 등장하지 않습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![GitHub release](https://img.shields.io/github/v/release/lim010111/noteforge?include_prereleases&sort=semver)](https://github.com/lim010111/noteforge/releases)

**언어**: [English](./README.md) · 한국어 · [简体中文](./README.zh.md)

frontmatter에 `public: true`를 적었거나 본문 어디든 `#public` 태그가 들어 있는 노트만 발행됩니다. 그 외에는 모두 비공개로 남습니다. opt-out 방식인 Quartz와 달리, 사용자가 명시적으로 허용한 노트만 공개되는 opt-in 모델을 따릅니다. 위협 모델과 프로젝트 범위는 [docs/PRD.md](./docs/PRD.md)에서 확인하실 수 있습니다.

![발행된 noteforge 블로그 스크린샷 — `tools` > `cli` 트리가 보이는 CATEGORIES 사이드바, 메인 컬럼에 cli 카테고리 랜딩 페이지, 상단의 HOME / TOOLS / CLI 브레드크럼](./docs/assets/blog-categories-overview.png)

## 사전 준비

클론 전에 아래 환경이 갖춰져 있어야 합니다.

- [Obsidian](https://obsidian.md/) vault (또는 Markdown 파일이 모인 폴더)
- [Node.js](https://nodejs.org/) **22.6+** — LTS 22.11 권장 (`.nvmrc` 제공)
- [pnpm](https://pnpm.io/installation) **10.x**
- [Git](https://git-scm.com/)

## 빠른 시작

```bash
# 1. 원하는 디렉터리에 클론합니다.
git clone https://github.com/lim010111/noteforge my-blog && cd my-blog

# 2. 의존성을 설치합니다.
pnpm install

# 3. vault 위치를 알려줍니다.
cp .env.example .env
#    .env 파일을 열어 OBPUB_VAULT_PATH 에 본인 Obsidian vault 의 절대 경로를
#    채워 주세요. macOS / Linux / WSL 예시는 .env.example 안에 있습니다.

# 4. 개발 서버를 띄웁니다.
pnpm --filter blog dev      # http://localhost:4321 에서 실행됩니다.

# 5. (이후) 정적 사이트를 빌드합니다.
pnpm --filter blog build    # apps/blog/dist 에 산출 + privacy audit 자동 실행
```

> `--filter blog` 는 pnpm 워크스페이스 패키지 `blog`(`apps/blog/`) 안에서 스크립트를 실행한다는 뜻입니다. 이 README 의 모든 `dev` / `build` 명령은 같은 방식으로 동작합니다.

개발 서버는 떴는데 노트가 보이지 않는다면 [문제 해결](#문제-해결) 섹션을 참고해 주세요.

## 노트 공개하기

Obsidian 에서 vault 안의 아무 노트나 열고 frontmatter 에 `public: true` 를 적거나, 본문 어디든 `#public` 태그를 추가합니다. 둘 중 하나만 있어도 충분합니다. 저장하면 개발 서버가 다음 갱신 때 자동으로 반영합니다.

```yaml
---
title: 첫 공개 노트
public: true
---

이 노트는 이제 공개됩니다.
```

특정 노트가 왜 공개 또는 비공개로 판정됐는지 확인하려면 status 명령을 사용하세요. 경로는 셸 기준 상대 경로 또는 절대 경로 모두 받습니다.

```bash
pnpm obpub status "$OBPUB_VAULT_PATH/path/to/your-note.md"
# → your-note.md → PUBLIC (reason: frontmatter public: true)
```

## 사이트 커스터마이즈

사이트 정체성(제목, canonical URL, author, 소셜 링크)과 vault 별 동작(무시할 폴더, 테마)은 모두 **`apps/blog/noteforge.config.ts`** 에 모여 있습니다. `pnpm install` 직후에 이 파일을 열어 `site` 블록부터 본인 정보로 바꿔 주세요. 그렇지 않으면 빌드 결과가 업스트림 데모 사이트의 정체성으로 발행됩니다.

```ts
// apps/blog/noteforge.config.ts
export default defineConfig({
  site: {
    title: 'shine notes',                   // ← 본인의 블로그 제목
    url: 'https://noteforge.pages.dev',     // ← 배포 URL
    author: 'shine',                        // ← 본인 이름
    social: {
      github: 'https://github.com/lim010111',
    },
  },
  vaults: [
    {
      id: 'shine',
      path: vaultPath,                      // ← OBPUB_VAULT_PATH 에서 주입됨
      ignore: ['Templates/**', 'Excalidraw/**'], // ← 빌드에서 통째로 제외할 폴더
    },
  ],
  // ... 그 외 옵션은 파일 내 인라인 주석을 참고하세요.
});
```

주로 만지게 되는 옵션 설명(`nav.mode`, `privateLinkBehavior`, `unsafeAllowPrivateFolder` 등)은 이 파일의 주석에 정리돼 있습니다.

## 카테고리 설정

사이드바 구조와 발행 URL은 `nav.mode` 설정으로 결정됩니다. 두 가지 모드가 있고, 기본값은 `'category'`입니다.

### `category` 모드 (기본값)

각 노트의 frontmatter에 적은 `category` 값을 기준으로 사이드바 트리와 URL이 만들어집니다. vault 안에서 파일이 어떤 폴더에 있든 사용자가 정한 카테고리 이름으로 묶이기 때문에, 파일을 정리하는 방식과 사이트의 카테고리 분류를 따로 가져갈 수 있습니다.

```yaml
---
title: pnpm 워크스페이스 정리
public: true
category: tools
---
```

위 노트는 사이드바의 `tools` 그룹으로 들어가고, URL은 `/tools/pnpm 워크스페이스 정리/`가 됩니다.

다단 카테고리를 쓰고 싶다면 슬래시(`/`)로 구분해 주세요. 예를 들어 `category: tools/cli`로 적으면 사이드바에는 `tools > cli` 트리로 표시되고 URL은 `/tools/cli/...`가 됩니다.

![Obsidian 편집기에서 "pnpm 워크스페이스 정리" 노트의 frontmatter에 `tags: - public`과 `category: tools/cli`가 적혀 있는 모습](./docs/assets/category-mode-obsidian_example.png)

노트가 vault 안에서 어떤 폴더에 있든 상관없습니다 — 사이트에서의 위치는 `category` 값이 결정합니다.

`category` 필드가 없는 노트는 사이드바 맨 아래의 **Uncategorized** 그룹으로 묶이며, URL은 파일명만 사용해 `/<파일명>/` 형태가 됩니다.

### `folder` 모드

vault의 폴더 구조가 그대로 사이드바와 URL에 반영되는 모드입니다. 노트마다 `category` frontmatter를 따로 적지 않아도 되고, 디스크 위의 폴더 계층이 곧 사이트의 분류가 됩니다.

![Obsidian 파일 탐색기에서 vault 폴더 구조 `tools` > `cli` > "pnpm 워크스페이스 정리"가 보이는 모습](./docs/assets/folder-mode-obsidian_example.png)

이 모드를 쓰려면 `noteforge.config.ts`에 다음과 같이 명시해 주세요.

```ts
// noteforge.config.ts
export default defineConfig({
  // ...
  nav: { mode: 'folder' },
});
```

vault를 정리해 둔 방식이 이미 사이트에 보여주고 싶은 구조와 일치할 때 편리합니다. 반대로 vault에서는 자유롭게 정리하되 사이트에서는 따로 묶고 싶다면 기본값인 `'category'` 모드가 더 어울립니다.

위 두 예시 — frontmatter의 `category: tools/cli`, 그리고 vault의 `tools/cli/` 폴더 — 는 같은 위치를 가리키며, 사이트에서는 동일한 사이드바 트리와 URL로 렌더링됩니다.

![noteforge 블로그의 CATEGORIES 사이드바에 `tools` > `cli`가 표시되고, "cli" 카테고리 페이지에서 "pnpm 워크스페이스 정리" 노트가 HOME / TOOLS / CLI 브레드크럼과 함께 보이는 모습](./docs/assets/blog-categories-overview.png)

## 프라이버시 보장 방식

`private/**` 폴더 안에 있는 노트는 frontmatter에 `public: true`가 있어도 절대로 공개되지 않습니다. 이 규칙을 우회하려면 설정에서 `unsafeAllowPrivateFolder: true`를 명시해야 합니다.

frontmatter는 미리 정해진 allowlist (`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category`) 안에 있는 필드만 결과 HTML에 등장합니다. 그 밖의 필드는 렌더링 단계에 도달하지 않습니다.

Obsidian의 `%%...%%` 코멘트는 파이프라인 가장 앞 단계(discovery)에서 제거되므로, 이후 어떤 단계에도 남아 있지 않습니다.

전체 위협 모델은 [docs/PRD.md](./docs/PRD.md)와 [SECURITY.md](./SECURITY.md)에서 보실 수 있습니다.

## 배포

`pnpm --filter blog build` 가 만든 `apps/blog/dist/` 는 어떤 정적 호스트라도 그대로 서빙할 수 있는 완성된 정적 사이트입니다. 공식적으로 문서화한 경로는 **Cloudflare Pages Direct Upload** 방식입니다.

```bash
npm i -g wrangler
wrangler login
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=<프로젝트-이름>
```

GitHub Pages, Netlify 등 다른 정적 호스트도 동작하지만 본 레포 문서에서는 다루지 않습니다. 빌드는 사용자 머신의 절대 vault 경로를 필요로 하므로 CI 러너에서 빌드를 돌릴 수 없기 때문입니다. 커스텀 도메인을 포함한 Cloudflare 전체 절차는 [docs/DEPLOY.md](./docs/DEPLOY.md) 에 있습니다.

## 문제 해결

**`public: true` 를 달았는데도 노트가 안 보입니다.** 먼저 `pnpm obpub status <노트-절대경로>.md` 로 어떻게 분류됐는지 확인해 주세요. 가장 흔한 원인은 다음과 같습니다 — 노트가 `private/**` 폴더 안에 있어 frontmatter 가 무력화된 경우(tripwire), `apps/blog/noteforge.config.ts` 의 `ignore` 글롭에 매칭되는 경우, 개발 서버가 변경을 아직 못 잡은 경우. 노트를 다시 저장해 보거나 `pnpm --filter blog dev` 를 재시작해 보세요.

**시작 시 `OBPUB_VAULT_PATH` 가 설정되지 않았다는 오류가 납니다.** vault 경로를 못 찾는 상태입니다. 레포 루트에 `.env` 파일이 있는지, 그리고 `OBPUB_VAULT_PATH` 가 절대 경로(`~/...` 같은 홈 표기 금지)인지 확인하세요. WSL 사용자는 윈도우 vault 가 `/mnt/c/Users/...` 경로로 보입니다. 또한 `pnpm --filter blog dev` 를 실행한 셸 세션이 그 환경변수를 상속해야 하므로, 다른 터미널에서 환경변수를 설정했다면 개발 서버를 재시작해 주세요.

## 문서

- [docs/PRD.md](./docs/PRD.md) — 위협 모델, 책임 범위와 비책임 범위
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 모듈 구조, 파이프라인, 의존 그래프
- [docs/DEPLOY.md](./docs/DEPLOY.md) — Cloudflare Pages, GitHub Pages, 그 외 정적 호스트
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) — 디자인 토큰과 레이아웃 가이드
- [docs/adr/](./docs/adr/) — 아키텍처 결정 기록 (ADR)
- [CHANGELOG.md](./CHANGELOG.md) — 릴리스 노트
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 워크플로, TDD, PR 체크리스트
- [SECURITY.md](./SECURITY.md) — 보안 이슈 신고 방법
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Contributor Covenant v2.1

## 현재 상태

**v0.8.1** — 첫 안정 릴리스 라인입니다. 전체 변경 이력은 [CHANGELOG.md](./CHANGELOG.md)를 참고해 주세요.

## 라이선스

[MIT](./LICENSE) 라이선스로 배포됩니다. 이 프로젝트는 vault의 콘텐츠를 저장하거나 외부로 전송하지 않으며, 어떤 분석이나 텔레메트리도 수집하지 않습니다.
