<!-- repo: lim010111/obsidian-blog -->

# noteforge

> Obsidian vault를 선택적으로 공개하는 정적 블로그 SSG. **Privacy-first**: 표시하지 않은 것은 존재조차 드러내지 않는다.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.6-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-f69220.svg)](https://pnpm.io/)
[![Astro](https://img.shields.io/badge/Astro-5.x-ff5d01.svg)](https://astro.build/)
[![GitHub release](https://img.shields.io/github/v/release/lim010111/obsidian-blog?include_prereleases&sort=semver)](https://github.com/lim010111/obsidian-blog/releases)

**언어**: [English](./README.md) · 한국어

`public: true` frontmatter 또는 본문 어디든 `#public` 태그가 있는 노트만 발행한다. 기본값은 **비공개** — Quartz의 opt-out 기본값과 정반대. Threat model · 책임 범위는 [docs/PRD.md](./docs/PRD.md).

## 빠른 시작

```bash
git clone https://github.com/lim010111/obsidian-blog my-blog && cd my-blog
pnpm install
cp .env.example .env        # OBPUB_VAULT_PATH=<your vault absolute path>
pnpm --filter blog dev      # http://localhost:4321
pnpm --filter blog build    # apps/blog/dist + audit
```

## 노트 공개

frontmatter `public: true` 또는 본문 어딘가에 `#public` 태그 — 둘 중 **하나만** 있어도 공개, 없으면 비공개.

특정 노트의 판정 이유 확인:

```bash
pnpm obpub status packages/core/tests/fixtures/vault-mixed/public-note.md
# → public-note.md → PUBLIC (reason: frontmatter public: true)
```

## Privacy 계약

`private/**` 폴더는 tripwire — frontmatter `public: true`가 있어도 비공개 유지(우회에는 `unsafeAllowPrivateFolder: true` 필요). frontmatter는 allowlist(`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category`) 외 필드를 렌더 HTML에 노출하지 않는다. Obsidian의 `%%...%%` 코멘트는 discovery 단계에서 제거. 자세한 위협 모델은 [docs/PRD.md](./docs/PRD.md)와 [SECURITY.md](./SECURITY.md).

## 문서

- [docs/PRD.md](./docs/PRD.md) — Threat model · 책임 / 비책임 범위
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 모듈 / 파이프라인 / 의존 그래프
- [docs/DEPLOY.md](./docs/DEPLOY.md) — Cloudflare Pages · GitHub Pages · 다른 정적 호스트
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) — 디자인 토큰 / 레이아웃 가이드
- [docs/adr/](./docs/adr/) — Architecture decision records
- [CHANGELOG.md](./CHANGELOG.md) — 릴리스 노트
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 개발 워크플로 · TDD · PR 체크리스트
- [SECURITY.md](./SECURITY.md) — 보안 이슈 리포팅
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Contributor Covenant v2.1

## 상태

**v0.71** — leaf-category 사이드바 정렬 + 원본 대소문자 보존 (Pre-release). v0.7 categories 네비 모드와 v0.6 TOC 레이어 위에 얹은 단계. 상세 변경 내역은 [CHANGELOG.md](./CHANGELOG.md).

## 라이선스

[MIT](./LICENSE). vault 콘텐츠는 저장 / 전송 / 분석 / 텔레메트리 어디로도 가지 않는다.
