<!-- repo: lim010111/obsidian-blog -->

# noteforge

> Obsidian vault에서 직접 고른 노트만 정적 블로그로 배포하는 SSG(Static Site Generation)입니다. **Privacy-first** — 명시적으로 공개 표시를 한 노트가 아니면 결과물 어디에도 등장하지 않습니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![GitHub release](https://img.shields.io/github/v/release/lim010111/obsidian-blog?include_prereleases&sort=semver)](https://github.com/lim010111/obsidian-blog/releases)

**언어**: [English](./README.md) · 한국어

frontmatter에 `public: true`를 적었거나 본문 어디든 `#public` 태그가 들어 있는 노트만 발행됩니다. 그 외에는 모두 비공개로 남습니다. opt-out 방식인 Quartz와 달리, 사용자가 명시적으로 허용한 노트만 공개되는 opt-in 모델을 따릅니다. 위협 모델과 프로젝트 범위는 [docs/PRD.md](./docs/PRD.md)에서 확인하실 수 있습니다.

## 빠른 시작

```bash
git clone https://github.com/lim010111/obsidian-blog my-blog && cd my-blog
pnpm install
cp .env.example .env        # OBPUB_VAULT_PATH=<vault 절대 경로>
pnpm --filter blog dev      # http://localhost:4321
pnpm --filter blog build    # apps/blog/dist + audit
```

## 노트 공개하기

노트의 frontmatter에 `public: true`를 적거나, 본문 어디든 `#public` 태그를 달면 됩니다. 둘 중 하나만 있어도 공개되고, 둘 다 없으면 비공개로 남습니다.

특정 노트가 왜 공개 또는 비공개로 판정됐는지 확인하고 싶다면 다음 명령으로 이유를 출력할 수 있습니다.

```bash
pnpm obpub status packages/core/tests/fixtures/vault-mixed/public-note.md
# → public-note.md → PUBLIC (reason: frontmatter public: true)
```

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

![Obsidian 편집기에서 "pnpm 워크스페이스 정리" 노트의 frontmatter에 `tags: - public`과 `category: tools/cli`가 적혀 있는 모습](./category-mode-obsidian_example.png)

노트가 vault 안에서 어떤 폴더에 있든 상관없습니다 — 사이트에서의 위치는 `category` 값이 결정합니다.

`category` 필드가 없는 노트는 사이드바 맨 아래의 **Uncategorized** 그룹으로 묶이며, URL은 파일명만 사용해 `/<파일명>/` 형태가 됩니다.

### `folder` 모드

vault의 폴더 구조가 그대로 사이드바와 URL에 반영되는 모드입니다. 노트마다 `category` frontmatter를 따로 적지 않아도 되고, 디스크 위의 폴더 계층이 곧 사이트의 분류가 됩니다.

![Obsidian 파일 탐색기에서 vault 폴더 구조 `tools` > `cli` > "pnpm 워크스페이스 정리"가 보이는 모습](./folder-mode-obsidian_example.png)

이 모드를 쓰려면 `obsidian-blog.config.ts`에 다음과 같이 명시해 주세요.

```ts
// obsidian-blog.config.ts
export default defineConfig({
  // ...
  nav: { mode: 'folder' },
});
```

vault를 정리해 둔 방식이 이미 사이트에 보여주고 싶은 구조와 일치할 때 편리합니다. 반대로 vault에서는 자유롭게 정리하되 사이트에서는 따로 묶고 싶다면 기본값인 `'category'` 모드가 더 어울립니다.

위 두 예시 — frontmatter의 `category: tools/cli`, 그리고 vault의 `tools/cli/` 폴더 — 는 같은 위치를 가리키며, 사이트에서는 동일한 사이드바 트리와 URL로 렌더링됩니다.

![noteforge 블로그의 CATEGORIES 사이드바에 `tools` > `cli`가 표시되고, "cli" 카테고리 페이지에서 "pnpm 워크스페이스 정리" 노트가 HOME / TOOLS / CLI 브레드크럼과 함께 보이는 모습](./blog_example.png)

## 프라이버시 보장 방식

`private/**` 폴더 안에 있는 노트는 frontmatter에 `public: true`가 있어도 절대로 공개되지 않습니다. 이 규칙을 우회하려면 설정에서 `unsafeAllowPrivateFolder: true`를 명시해야 합니다.

frontmatter는 미리 정해진 allowlist (`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category`) 안에 있는 필드만 결과 HTML에 등장합니다. 그 밖의 필드는 렌더링 단계에 도달하지 않습니다.

Obsidian의 `%%...%%` 코멘트는 파이프라인 가장 앞 단계(discovery)에서 제거되므로, 이후 어떤 단계에도 남아 있지 않습니다.

전체 위협 모델은 [docs/PRD.md](./docs/PRD.md)와 [SECURITY.md](./SECURITY.md)에서 보실 수 있습니다.

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

**v0.8.0** — 첫 안정 릴리스입니다. 사이드바 leaf-category 정렬(v0.71), categories 네비게이션 모드(v0.7), 우측 TOC 컬럼(v0.6) 위에 릴리스 준비 작업(privacy DRY 정리, hero 이미지 방어 강화, 보안 정책 문서화, identity 정비)을 얹은 단계입니다. 전체 변경 이력은 [CHANGELOG.md](./CHANGELOG.md)를 참고해 주세요.

## 라이선스

[MIT](./LICENSE) 라이선스로 배포됩니다. 이 프로젝트는 vault의 콘텐츠를 저장하거나 외부로 전송하지 않으며, 어떤 분석이나 텔레메트리도 수집하지 않습니다.
