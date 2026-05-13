<!-- repo: lim010111/noteforge -->

# noteforge

> **언어**: [English](./README.md) · 한국어 · [简体中文](./README.zh.md)

Obsidian vault에서 **사용자가 명시적으로 표시한 노트만** 정적 블로그로 발행하는 privacy-first Astro SSG. 표시하지 않은 노트는 빌드 산출물에 일절 등장하지 않습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![CI](https://img.shields.io/github/actions/workflow/status/lim010111/noteforge/ci.yml?branch=main)](https://github.com/lim010111/noteforge/actions)
[![Release](https://img.shields.io/github/v/release/lim010111/noteforge?include_prereleases&sort=semver)](https://github.com/lim010111/noteforge/releases)

![발행된 noteforge 블로그 스크린샷 — `tools` > `cli` 트리가 보이는 CATEGORIES 사이드바, 메인 컬럼에 cli 카테고리 랜딩 페이지, 상단의 HOME / TOOLS / CLI 브레드크럼](./docs/assets/blog-categories-overview.png)

## 소개

`noteforge`는 명시적으로 표시한 노트만 공개합니다 — frontmatter 의 `public: true` 또는 본문의 `#public` 태그. 그 외 모든 노트의 기본값은 비공개이며, **사용자가 허용하지 않으면 vault 밖으로 한 줄도 나가지 않습니다.** Quartz 의 "모두 공개(opt-out)" 모델 — 깜빡한 `dg-publish: false` 하나로 잘못된 노트가 새는 — 과 정반대입니다.

프라이버시는 하나의 플래그가 아니라 파이프라인 전체입니다. frontmatter 는 allowlist 로 필터링되고, `%%comment%%` 는 다른 단계 시작 전에 제거되며, 비공개 노트의 `![[transclusion]]` 은 AST 에서 완전히 사라지고, post-build audit 이 `dist/` 를 다시 스캔해 누출(canary) 을 검증합니다. 위협 모델은 [docs/PRD.md](./docs/PRD.md) 와 [SECURITY.md](./SECURITY.md) 에 정리돼 있습니다.

## 핵심 기능

- **Opt-in 발행** — frontmatter `public: true` **또는** `#public` 태그. 판정 로직은 [`packages/core/src/privacy/classify.ts`](./packages/core/src/privacy/classify.ts) 한 곳에만 존재합니다.
- **`private/**` tripwire** — `private/` 폴더 안의 노트는 frontmatter 에 `public: true` 가 있어도 공개되지 않습니다. 우회는 config 에서 `unsafeAllowPrivateFolder: true` 를 명시해야 합니다.
- **Frontmatter allowlist** — `title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category` 만 렌더 HTML 에 도달합니다. 강제는 [`packages/core/src/privacy/frontmatterFilter.ts`](./packages/core/src/privacy/frontmatterFilter.ts) 가 담당.
- **코멘트 + transclusion 안전** — `%%...%%` 는 discovery 단계에서 즉시 제거. 비공개 타겟의 `![[Note]]` 는 AST 에서 삭제, 공개 타겟은 동일 파이프라인을 재귀 적용.
- **Post-build audit** — `obpub audit` 가 core 파이프라인과 독립적으로 `dist/` 를 검사합니다. 이 audit 에서 privacy 로직을 재구현하지 않는 것이 의도된 이중 검증입니다.
- **Obsidian 호환 작성** — wikilinks, callouts (공식 13 종 · foldable / 중첩), KaTeX, attachment closure, category / folder 기반 내비게이션.
- **HMR 개발 서버** — Obsidian 에서 노트를 수정하면 재시작 없이 바로 반영.

## 사전 준비

- 발행하려는 노트가 한 개 이상 들어 있는 [Obsidian](https://obsidian.md/) vault (또는 Markdown 폴더)
- [Node.js](https://nodejs.org/) **22.6+** — LTS 22.11 권장 ([`.nvmrc`](./.nvmrc) 제공)
- [pnpm](https://pnpm.io/installation) **10.x**
- [Git](https://git-scm.com/)

## 설치

```bash
# 1. 레포를 클론합니다.
git clone https://github.com/lim010111/noteforge my-blog && cd my-blog

# 2. 의존성을 설치합니다.
pnpm install

# 3. vault 위치를 알려줍니다.
cp .env.example .env
# .env 파일을 열어 OBPUB_VAULT_PATH 에 본인 Obsidian vault 의 절대 경로를
# 채워 주세요. macOS / Linux / WSL 예시는 .env.example 안에 있습니다.

# 4. 개발 서버를 띄웁니다.
pnpm --filter blog dev     # http://localhost:4321

# 5. 정적 사이트를 빌드합니다 (post-build privacy audit 자동 실행).
pnpm --filter blog build   # 산출물 → apps/blog/dist
```

> `--filter blog` 는 `blog` 워크스페이스 패키지(`apps/blog/`) 안에서 스크립트를 실행한다는 뜻입니다. 이 README 의 모든 `dev` / `build` 명령이 같은 방식으로 동작합니다.

개발 서버는 떴는데 노트가 보이지 않는다면 [문제 해결](#문제-해결) 섹션을 참고해 주세요.

## 사용법

### 노트 공개하기

Obsidian 에서 vault 안의 아무 노트나 열고 frontmatter 에 `public: true` 를 적거나 본문 어디든 `#public` 태그를 추가합니다. 둘 중 하나만 있으면 충분합니다.

```yaml
---
title: 첫 공개 노트
public: true
---

이 노트는 이제 공개됩니다.
```

파일을 저장하면 개발 서버가 다음 갱신 때 자동으로 반영합니다.

### 특정 노트의 공개 판정 이유 확인

```bash
pnpm obpub status "${OBPUB_VAULT_PATH}/path/to/your-note.md"
# → your-note.md → PUBLIC (reason: frontmatter public: true)
```

`obpub status` 는 빌드와 동일한 `classify` 함수를 호출하므로 출력 결과가 곧 실제 판정입니다.

### 사이트 정체성

사이트 메타데이터(제목, canonical URL, author, 소셜 링크)와 vault 별 규칙은 모두 [`apps/blog/noteforge.config.ts`](./apps/blog/noteforge.config.ts) 에 모여 있습니다. `pnpm install` 직후 `site` 블록부터 본인 값으로 바꿔 주세요. 그렇지 않으면 빌드 결과가 업스트림 데모 사이트 정체성으로 발행됩니다.

```ts
// apps/blog/noteforge.config.ts
export default defineConfig({
  site: {
    title: 'My Notes',                     // ← 본인의 블로그 제목
    url: 'https://noteforge.pages.dev',    // ← 배포 URL
    author: 'Your Name',
    social: {
      // '' = "설정 필요" stub (아이콘은 보이고, 클릭하면 안내 표시).
      // 'https://github.com/<your-username>' 로 교체하면 실제 링크가 됩니다.
      github: '',
    },
  },
  vaults: [
    {
      id: 'primary',
      path: vaultPath,                                  // ← OBPUB_VAULT_PATH 에서 주입됨
      ignore: ['Templates/**', 'Excalidraw/**'],        // ← 빌드에서 통째로 제외할 폴더
    },
  ],
});
```

주로 만지게 되는 옵션(`nav.mode`, `privateLinkBehavior`, `unsafeAllowPrivateFolder` 등) 설명은 모두 이 파일 안의 인라인 주석에 정리돼 있습니다.

### 카테고리

사이드바 구조와 발행 URL 은 `nav.mode` 가 결정합니다. 두 모드가 있고 기본값은 `'category'` 입니다.

**`category` 모드 (기본값)** — 각 노트의 `category` frontmatter 값이 사이드바 위치와 URL 을 결정합니다. vault 안에서 어떤 폴더에 있든 무관합니다.

```yaml
---
title: pnpm 워크스페이스 정리
public: true
category: tools/cli
---
```

위 노트는 사이드바의 `tools > cli` 트리에 들어가고, URL 은 `/tools/cli/<파일명>/` 이 됩니다. 다단 카테고리는 `/` 로 구분합니다. `category` 필드가 없는 노트는 사이드바 맨 아래의 **Uncategorized** 그룹으로 묶입니다.

![Obsidian 편집기에서 frontmatter 에 `tags: - public` 과 `category: tools/cli` 가 적힌 노트](./docs/assets/category-mode-obsidian_example.png)

**`folder` 모드** — vault 의 폴더 구조가 그대로 사이드바와 URL 이 됩니다. `category` 필드 없이 디스크 폴더 계층 = 사이트 카테고리. 사용하려면 config 에 `nav: { mode: 'folder' }` 를 명시합니다.

![Obsidian 파일 탐색기에서 vault 폴더 구조 `tools` > `cli` > "pnpm 워크스페이스 정리"](./docs/assets/folder-mode-obsidian_example.png)

위 두 예시는 동일한 사이드바 트리와 URL 로 렌더됩니다.

![noteforge 블로그의 CATEGORIES 사이드바에 `tools` > `cli` 가 표시되고, "cli" 페이지에서 "pnpm 워크스페이스 정리" 노트가 HOME / TOOLS / CLI 브레드크럼과 함께 보이는 모습](./docs/assets/blog-categories-overview.png)

## 프라이버시 강제 방식

- **`private/**` tripwire** — `private/` 폴더 안의 노트는 frontmatter `public: true` 가 있어도 공개되지 않습니다. 유일한 우회는 config 의 `unsafeAllowPrivateFolder: true` 이며, 의도적으로 명시해야 동작합니다.
- **Frontmatter allowlist** — 위 목록 밖의 필드는 노트가 어떻게 선언했든 렌더 HTML 에 도달하지 못합니다.
- **코멘트 제거** — `%%...%%` 는 discovery 단계에서 즉시 제거되어 이후 파이프라인 어디에도 남지 않습니다.
- **Transclusion 차단** — 비공개 타겟의 `![[Note]]` 는 AST 에서 삭제. 공개 타겟은 동일 파이프라인을 재귀 적용.
- **Post-build audit** — `pnpm obpub audit` 가 `@noteforge/cli` 의 독립 룰셋으로 `dist/` 를 재검증하므로, core 의 회귀도 잡힙니다.

테스트 fixture 에 심어둔 canary 문자열(`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, `FOLDER_TREE_DO_NOT_LEAK_8a4f2`) 은 렌더 HTML 에 **0 회** 등장해야 한다는 어설션이 걸려 있습니다. 전체 위협 모델은 [docs/PRD.md](./docs/PRD.md), 신고 채널과 책임 범위는 [SECURITY.md](./SECURITY.md) 를 참고해 주세요.

## 배포

`pnpm --filter blog build` 가 만든 `apps/blog/dist/` 는 어떤 정적 호스트라도 그대로 서빙할 수 있는 완성된 정적 사이트입니다. 공식 문서화된 경로는 **Cloudflare Pages Direct Upload** 방식입니다.

```bash
npm i -g wrangler
wrangler login
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=<프로젝트-이름>
```

GitHub Pages, Netlify 등 다른 정적 호스트도 동작하지만 본 레포 문서에서는 다루지 않습니다. 빌드가 사용자 머신의 절대 vault 경로에 의존하기 때문에 CI 러너에서 돌릴 수 없기 때문입니다. 커스텀 도메인 포함 전체 절차는 [docs/DEPLOY.md](./docs/DEPLOY.md) 를 참고하세요.

## 문제 해결

**`public: true` 를 달았는데도 노트가 안 보입니다.** 먼저 `pnpm obpub status <노트-절대경로>.md` 로 어떻게 분류됐는지 확인하세요. 가장 흔한 원인 — 노트가 `private/**` 폴더 안에 있어 frontmatter 가 무력화됨 (tripwire), `apps/blog/noteforge.config.ts` 의 `ignore` 글롭에 매칭됨, 개발 서버가 변경을 아직 못 잡음. 노트를 다시 저장해 보거나 `pnpm --filter blog dev` 를 재시작해 보세요.

**시작 시 `OBPUB_VAULT_PATH` 가 설정되지 않았다는 오류가 납니다.** vault 경로를 못 찾는 상태입니다. 레포 루트에 `.env` 파일이 있는지, `OBPUB_VAULT_PATH` 가 절대 경로(`~/...` 같은 홈 표기 금지) 인지 확인하세요. WSL 사용자는 윈도우 vault 가 `/mnt/c/Users/...` 경로로 보입니다. `pnpm --filter blog dev` 를 실행한 셸 세션이 그 환경변수를 상속해야 하므로, 다른 터미널에서 설정했다면 개발 서버를 재시작해 주세요.

## 아키텍처

`noteforge` 는 4개 패키지와 1개 도그푸드 앱으로 구성된 pnpm 워크스페이스 모노레포입니다.

| 패키지 | 역할 |
|--------|------|
| [`@noteforge/core`](./packages/core) | 프레임워크 독립 privacy 파이프라인. `isPublic`, frontmatter allowlist, transclusion, attachment closure 의 단일 소스. |
| [`@noteforge/astro`](./packages/astro-integration) | Astro 5 Content Layer loader + chokidar watcher. core 를 dev / build 사이클에 연결. |
| [`@noteforge/theme-default`](./packages/theme-default) | 레퍼런스 Astro 테마. 이미 필터된 결과물만 소비하며 raw vault 접근 금지. |
| [`@noteforge/cli`](./packages/cli) | `obpub` CLI (`dev` / `build` / `audit` / `status`). |
| [`apps/blog`](./apps/blog) | 레포에 포함된 도그푸드 사이트. |

모듈 지도는 [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), 패키지별 책임 경계는 각 디렉터리의 `CLAUDE.md` 참고.

## 기여

기여를 환영합니다. 전체 워크플로 · TDD 규칙 · PR 체크리스트는 [CONTRIBUTING.md](./CONTRIBUTING.md) 에 정리돼 있습니다. 요약하자면:

```bash
pnpm install
pnpm -r typecheck && pnpm lint && pnpm test && pnpm --filter blog build
```

`packages/core/src/privacy/**` 를 건드리는 PR 은 canary 어설션을 통과해야 하며, 일반 기능 PR 과 별도로 리뷰합니다.

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

**v0.8.1** — 첫 안정 릴리스 라인입니다. 전체 변경 이력은 [CHANGELOG.md](./CHANGELOG.md) 를 참고해 주세요.

## 라이선스

[MIT 라이선스](./LICENSE) 로 배포됩니다. 이 프로젝트는 vault 콘텐츠를 저장 · 전송 · 분석하지 않으며, 어떤 텔레메트리도 수집하지 않습니다.
