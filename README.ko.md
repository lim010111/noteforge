> [English](README.md) · [한국어](README.ko.md)

<h1 align="center">noteforge</h1>

<p align="center">
  <em>Obsidian 볼트에서 <strong>공개하기로 표시한 노트만</strong> 골라서 정적 사이트로 만들어 주는 privacy-first Astro SSG.</em>
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

Obsidian 볼트를 정적 사이트로 만들어 주는 도구는 이미 많지만, noteforge는 기본 정책을 뒤집었습니다. **표시하지 않은 노트는 절대 사이트에 올라가지 않습니다.** 노트 frontmatter에 `public: true`를 적었거나 `#public` 태그를 단 노트, 그리고 그 노트가 직접 참조한 첨부 파일만 빌드에 포함됩니다.

흘러나갈 수 있는 길은 빠짐없이 막아 둡니다.

- 공개 노트 안에서 비공개 노트를 가리키는 `[[Note]]` 링크는 제목 없이 본문 텍스트만 남도록 다시 씁니다.
- `![[Note]]` 임베드의 대상이 비공개라면 AST에서 통째로 들어냅니다.
- `%%주석%%` 형식의 Obsidian 주석은 렌더링 전에 제거됩니다.
- frontmatter는 정해진 허용 목록(allowlist)에 있는 필드만 HTML과 메타데이터로 흘려보냅니다.
- `private/**` 폴더는 트립와이어입니다. `public: true`를 적어도 절대 통과하지 않습니다.
- 빌드가 끝나면 audit이 `dist/`를 한 번 더 훑어보고, 누설이 발견되면 빌드를 실패로 만듭니다.

Quartz의 "일단 다 공개" 방식이 영 불안했던 분이라면, 정확히 그 반대편에 서 있는 도구입니다.

## Why?

| 도구                 | 기본값      | 아쉬운 점                                                          |
|----------------------|-------------|--------------------------------------------------------------------|
| Obsidian Publish     | opt-in      | 유료 구독, 호스팅 종속.                                            |
| Quartz v4            | opt-**out** | 공개 노트의 그래프와 백링크에 비공개 노트 제목이 그대로 노출됨.     |
| Digital Garden       | opt-in      | transclusion, 주석, frontmatter, 첨부 파일까지 책임지지는 않음.    |
| **noteforge**        | **opt-in**  | 누설 경로를 전부 계약에 포함, 빌드 직후 audit으로 한 번 더 확인.   |

자세한 포지셔닝은 [`docs/PRD.md`](./docs/PRD.md)에, opt-in을 기본값으로 잡은 결정 기록은 [`docs/adr/0001-privacy-first-opt-in.md`](./docs/adr/0001-privacy-first-opt-in.md)에 있습니다.

## Features

- **명시적 공개 옵트인** — `public: true` frontmatter 또는 `#public` 태그. 기본값은 [`packages/core/src/config.ts`](./packages/core/src/config.ts)에서 정의합니다 (`requireExplicitOptIn: true`, `frontmatterKey: 'public'`, `publicTag: 'public'`).
- **Frontmatter 허용 목록** — `title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`, `category`. 이 외의 필드는 HTML, `<meta>`, RSS, sitemap 어디에도 닿기 전에 떨어집니다. ([`docs/adr/0002-allowlist-frontmatter.md`](./docs/adr/0002-allowlist-frontmatter.md))
- **`private/**` 트립와이어** — 경로 기반의 강한 규칙입니다. frontmatter로는 풀 수 없고, 굳이 끄려면 `unsafeAllowPrivateFolder: true`라는 눈에 띄는 옵션을 명시적으로 켜야 합니다.
- **링크와 임베드 게이팅** — `[[Note]]`, `![[Note]]` 양쪽 다 `@noteforge/core`의 `linkRewriter`와 `transclude` 패스가 처리합니다.
- **첨부 클로저(closure)** — `dist/`에는 공개 노트가 실제로 참조했고 확장자가 허용 목록에 든 첨부만 들어갑니다. frontmatter의 `cover`와 `thumbnail` 이미지도 같은 게이트를 통과해야 살아남습니다.
- **마크다운 확장** — Obsidian 콜아웃(공식 13종과 별칭, foldable 변형 포함), KaTeX, 자동 헤딩 앵커, Shiki 기반 코드 하이라이트.
- **개발 서버 실시간 반영** — chokidar 워처와 Astro Content Layer의 invalidation을 묶어, 볼트에서 노트를 고치면 HMR로 즉시 반영됩니다.
- **빌드 직후 audit** — `obpub audit`이 `dist/`를 다시 한 번 훑어 비공개 제목, blocklist 태그, 남아 있는 `%%주석%%`, 허용 목록 바깥 frontmatter, 클로저 밖 첨부 파일을 찾습니다. 하나라도 걸리면 종료 코드 0이 아니라서 CI나 래퍼 스크립트에서 릴리스 게이트로 쓸 수 있습니다.
- **에셋 셀프 호스팅** — 빌드 전에 `vendor:assets` 스크립트가 폰트와 KaTeX를 로컬로 가져와 둡니다. 외부 폰트 CDN이나 서드파티 호스트에 의존하지 않습니다.
- **기본 테마** — `@noteforge/theme-default` (Astro + Tailwind v4). 라이트·다크 토글, 사이드바 폴더 트리, 목차, 그래프 뷰가 들어 있습니다.

## Quickstart

준비물: **Node 22.6 이상** (LTS 22.11 권장, [`.nvmrc`](./.nvmrc) 참고), **pnpm 10.x**.

```bash
# 1. clone하고 의존성 설치
git clone https://github.com/lim010111/noteforge.git
cd noteforge
pnpm install

# 2. 본인 Obsidian 볼트 경로 알려주기
cp .env.example .env
# .env 안에 OBPUB_VAULT_PATH=<볼트 절대 경로> 형태로 채워 둡니다.

# 3. 노트 하나에 공개 표시 달기
#    볼트 안의 아무 .md 파일 frontmatter에:
#      ---
#      public: true
#      ---
#    또는 본문/태그에 #public 추가.

# 4. 개발 서버 띄우기
pnpm --filter blog dev
```

Astro가 띄워 주는 주소(보통 `http://localhost:4321/`)를 열어 보세요. 노트에서 `public: true`를 켰다 껐다 하면, 서버를 다시 띄우지 않아도 페이지가 그 자리에서 나타났다 사라집니다.

특정 노트가 왜 공개/비공개로 잡혔는지 확인하고 싶을 때는:

```bash
pnpm obpub status "path/to/Some Note.md"
```

정적 사이트로 빌드:

```bash
pnpm --filter blog build
```

빌드 끝에는 자동으로 audit이 돕니다. 누설 신호가 나오면 빌드가 멈추고, 어떤 줄에서 무엇이 걸렸는지 stderr로 떨어집니다.

## Project structure

pnpm 워크스페이스 monorepo입니다. privacy 코어를 나중에 Astro 바깥에서도 재사용할 수 있도록, 역할을 일찍부터 분리해 두었습니다.

```
noteforge/
├── packages/
│   ├── core/                # @noteforge/core — 프레임워크 독립 엔진
│   ├── astro-integration/   # @noteforge/astro — Content Layer + 워처
│   ├── theme-default/       # @noteforge/theme-default — 기본 테마
│   └── cli/                 # @noteforge/cli — `obpub` 바이너리
├── apps/
│   └── blog/                # 도그푸드 사이트 (위 패키지를 모두 사용)
├── docs/                    # PRD, ARCHITECTURE, ADR, DEPLOY, UI_GUIDE
└── evals/                   # agent 회귀 플레이스홀더
```

패키지마다 책임은 한 가지뿐입니다.

| 패키지                       | 역할                                                                                          |
|------------------------------|-----------------------------------------------------------------------------------------------|
| `@noteforge/core`            | 볼트 탐색 → 분류 → 링크 재작성 → 렌더. privacy 결정은 여기 한 곳에서만 일어납니다.            |
| `@noteforge/astro`           | Astro 통합: Content Layer 로더, chokidar 워처, MDX wikilink 브리지.                          |
| `@noteforge/theme-default`   | Astro + Tailwind v4 기본 테마. 코어 산출물만 받아서 그리고, 자체 privacy 로직은 없습니다.     |
| `@noteforge/cli`             | `obpub` 명령들 (`dev`, `build`, `audit`, `status`). `dist/`를 독립적으로 다시 검증합니다.    |
| `apps/blog`                  | 도그푸드 사이트. 설정의 단일 출처인 `noteforge.config.ts`가 여기에 있습니다.                 |

파이프라인은 네 단계(`A. 탐색 → B. 분류 → C. 렌더 → D. audit`)로 흐르며, 자세한 그림은 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)에 정리되어 있습니다.

## CLI reference

CLI 이름은 `obpub`입니다. 워크스페이스 스크립트로 바로 쓰거나, `pnpm --filter @noteforge/cli build` 후에 `packages/cli/dist/bin.js` 바이너리로 실행할 수 있습니다.

```bash
pnpm obpub <command> [options]
# 빌드 후에는:
node packages/cli/dist/bin.js <command> [options]
```

| 명령                        | 하는 일                                                              |
|-----------------------------|----------------------------------------------------------------------|
| `obpub dev`                 | `astro dev`를 감싸 실행 (HMR 포함). 모르는 인자는 그대로 넘깁니다.   |
| `obpub build`               | `astro build` 후 자동 audit. 건너뛰려면 `--no-audit`.                |
| `obpub audit`               | `dist/` 디렉터리 누설 검사. `--strict`, `--json` 지원.                |
| `obpub status <file>`       | 특정 노트의 `PUBLIC` / `PRIVATE`과 그 이유를 출력. `--json` 지원.    |

공통 옵션: `-c, --config <path>`로 설정 파일 위치를 직접 지정할 수 있습니다.

## Configuration

설정의 단일 출처(SSOT)는 `apps/blog/noteforge.config.ts`입니다. 스키마는 `@noteforge/core`에서 가져오고 zod로 검증하므로, 형태가 틀린 설정은 렌더 시점이 아니라 로드 직후에 바로 터집니다.

필요한 환경변수는 하나뿐입니다.

| 변수                | 용도                                                                 |
|---------------------|----------------------------------------------------------------------|
| `OBPUB_VAULT_PATH`  | Obsidian 볼트의 절대 경로. `.env`나 셸 환경에 지정합니다.            |

최소 설정 예시:

```ts
// apps/blog/noteforge.config.ts
import { defineConfig } from '@noteforge/core';

export default defineConfig({
  site: {
    title: '내 노트',
    url: 'https://example.pages.dev',
    author: '이름',
    social: { github: 'https://github.com/your-name' }, // 빈 문자열로 두면 "설정 필요" 안내 아이콘이 표시됩니다.
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

자주 쓰는 고급 옵션 (모두 선택):

- `publishing.frontmatterAllowlist` / `tagBlocklist` — 기본값에 항목을 더 얹습니다.
- `attachments.uploadDir` / `uploadMaxBytes` / `allowedExtensions` — 첨부 클로저의 범위를 조정합니다.
- `nav.mode` — `'category'`(기본) 또는 `'folder'`. 사이드바 트리 구성 방식을 바꿉니다.
- `unsafeAllowPrivateFolder` — `private/**` 트립와이어를 끕니다. **꼭 필요하다고 확신할 때만 켜세요.**

MVP는 한 프로젝트당 볼트 하나만 받습니다 (스키마가 두 개 이상을 거절합니다). 다중 볼트는 로드맵에 있습니다 (`docs/PRD.md` 참고).

## Deploy

`apps/blog/dist/`는 평범한 Astro 정적 산출물이라 어떤 정적 호스트에도 올릴 수 있습니다. 기본으로 안내하는 길은 **Cloudflare Pages — Direct Upload — 로컬 빌드**입니다. CI에서 빌드하지 않는 이유는 단순합니다. 볼트 경로가 사용자 컴퓨터의 절대 경로라, GitHub Actions 러너에는 그 경로가 아예 존재하지 않습니다.

```bash
pnpm install
pnpm --filter blog build
wrangler pages deploy apps/blog/dist --project-name=noteforge
```

GitHub Pages, Vercel(`vercel deploy --prebuilt`), Netlify로 올리는 방법, 그리고 "왜 CI 자동 배포는 지원하지 않는가"의 자세한 설명은 [`docs/DEPLOY.md`](./docs/DEPLOY.md)에 있습니다.

## Privacy contract & audit

privacy가 이 프로젝트의 핵심이라, 회귀 방지 장치를 세 겹으로 깔아 두었습니다.

1. **단일 결정 지점.** `isPublic()` 계산은 `packages/core/src/privacy/classify.ts` 한 곳에서만 이뤄집니다. ESLint가 `@noteforge/core/<하위경로>` 임포트를 막아서, 소비자 쪽에서 privacy 판단 로직을 임의로 재구현할 수 없게 잠가 두었습니다.
2. **카나리 픽스처.** `packages/core/tests/fixtures/vault-mixed/`의 비공개 노트 안에 `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, `FOLDER_TREE_DO_NOT_LEAK_8a4f2` 세 개의 카나리 문자열을 심어 두었습니다. Vitest가 렌더 산출물에서 이 문자열이 **0번** 등장하는지 매번 확인합니다.
3. **독립적인 빌드 후 audit.** `obpub audit`은 코어 파이프라인과 코드를 공유하지 않고, 같은 규칙으로 `dist/`만 보고 다시 판단합니다. 이중 검증이 목적입니다.

혹시 막히지 않는 누설 경로를 찾으셨다면, 공개 이슈가 아니라 [`SECURITY.md`](./SECURITY.md)에 안내된 GitHub의 private vulnerability reporting을 이용해 주세요. 실제 볼트 데이터 대신 합성 픽스처로 재현해 주시면 좋습니다.

## Development

```bash
pnpm install
pnpm -r typecheck                    # 모든 패키지 TS strict 검사
pnpm lint                            # ESLint flat config
pnpm test                            # 워크스페이스 전체 Vitest
pnpm --filter blog build             # 빌드 + audit, end-to-end
pnpm validate:context-paths          # CLAUDE.md / AGENTS.md 안의 경로 참조 검증
```

PR을 올리기 전에 위 다섯 가지를 모두 통과시켜 주세요. 전체 체크리스트와 privacy 영역의 TDD 기준은 [`CONTRIBUTING.md`](./CONTRIBUTING.md)에 정리되어 있습니다.

## Documentation map

| 경로                                       | 무엇이 적혀 있는지                                                   |
|--------------------------------------------|----------------------------------------------------------------------|
| [`docs/PRD.md`](./docs/PRD.md)             | 목표, 대상 사용자, MVP 범위, 성공 지표.                              |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | monorepo 구조, 파이프라인 단계, 데이터 흐름, 프레임워크 경계.   |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md)       | Cloudflare Pages와 대안 호스트들, 그리고 로컬 빌드만 지원하는 이유.   |
| [`docs/UI_GUIDE.md`](./docs/UI_GUIDE.md)   | 테마 계약, 디자인 토큰, 모션 규칙.                                   |
| [`docs/adr/`](./docs/adr/)                 | 결정 기록 (ADR). 번호와 날짜로 정렬되어 있습니다.                    |
| [`CHANGELOG.md`](./CHANGELOG.md)           | Keep a Changelog 이력. 릴리스마다 Privacy / Security 메모가 붙습니다.|
| [`SECURITY.md`](./SECURITY.md)             | 위협 범위, 신고 채널, 응답 SLA.                                      |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)     | 개발 환경, 커밋 컨벤션, PR 체크리스트.                               |

## Status

이 프로젝트는 아직 **0.x**입니다. 설정 스키마, 테마 컴포넌트 props, CLI 플래그 같은 인터페이스는 마이너 릴리스 사이에서 바뀔 수 있습니다. 다만 privacy 계약 자체는 0.x 전체에서 안정 표면으로 유지하는 것이 목표이고, 거기에 손을 댈 일이 생기면 `CHANGELOG.md`의 **Privacy / Security** 섹션에 명시적으로 적습니다.

## License

[MIT](./LICENSE) — Copyright (c) 2026 woohyun and noteforge contributors.
