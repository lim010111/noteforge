<!-- repo: lim010111/obsidian-blog -->

# Obsidian-Publish-OSS (작업명)

> Obsidian vault를 선택적으로 공개하는 오픈소스 정적 블로그 생성기.
> **Privacy-first**: 표시하지 않은 것은 존재조차 드러내지 않습니다.

Obsidian에서 `public: true` frontmatter나 `#public` 태그가 있는 노트만 정적 웹사이트로 발행합니다. Quartz의 "기본 공개(opt-out)" 모델과 정반대로, 이 도구는 **기본 비공개(opt-in)** 입니다.

## 이것이 해결하는 문제

기존 도구의 한계:
- **Quartz**: 기본값이 "모두 공개". 새 노트 작성 시 실수로 유출 가능. 공개 노트가 private 노트를 링크하면 그래프/백링크에 제목이 노출됨.
- **Obsidian Publish**: 월 $8–10, lock-in.
- **Digital Garden / Flowershow**: opt-in이지만 transclusion(`![[Note]]`), `%%comment%%`, frontmatter 필드, 태그 누출까지 다루는 프라이버시 모델은 없음.

이 도구는 **모든 알려진 누출 경로를 명시적으로 차단**하고 post-build audit으로 검증합니다.

## Threat Model — 약속하는 것

이 도구가 **책임지는** 프라이버시 누출 경로:
- Private 노트 본문/제목이 public HTML에 등장
- Private 노트 제목이 `<a>` 텍스트/title/data 속성/graph/backlinks/sitemap/RSS에 등장
- Private 첨부파일이 `dist/`에 복사됨
- `![[Private]]` transclusion으로 private 본문이 public 노트에 통째로 삽입됨
- Obsidian `%%comment%%`가 렌더된 HTML에 남음
- Allowlist 밖 frontmatter 필드(개인 메모 등)가 meta에 유출
- `private/` 폴더 파일이 frontmatter `public: true`만으로 공개되는 사고(tripwire)

**책임지지 않는** 것:
- Public 노트 본문에 저자가 직접 타이핑한 문자열 (예: private 노트 제목을 그대로 쓴 경우). `audit --strict`에서 경고.
- Vault 파일의 git 이력 — vault는 레포 밖이므로 저자가 관리.
- 배포 서버 쪽 접근 제어 — 이 도구는 정적 파일 출력만 담당. **public = 인터넷 전체에 공개**.
- 외부 링크/이미지 호스트로 흘러나가는 referrer, analytics.
- OS 파일 권한.

<!-- v0.2 dogfood 스크린샷은 사용자가 본인 vault에서 노트를 `public: true`로 발행한 뒤 캡처해 docs/screenshots/dogfood.png(라이트) + dogfood-dark.png(다크)로 추가합니다. -->
<!-- ![dogfood](docs/screenshots/dogfood.png) -->

<!-- v0.3 dogfood 스크린샷(사이드바 + 폴더 트리 + 홈 두 레일)은 사용자가 본인 vault에서 캡처해 docs/screenshots/dogfood-v0.3-light.png + dogfood-v0.3-dark.png로 추가합니다. -->
<!-- ![dogfood v0.3 light](docs/screenshots/dogfood-v0.3-light.png) -->
<!-- ![dogfood v0.3 dark](docs/screenshots/dogfood-v0.3-dark.png) -->


## 빠른 시작 (v0.1 MVP 사용 가능)

```bash
# 1. 레포 clone
git clone <this-repo> my-blog && cd my-blog

# 2. 의존성 설치
pnpm install

# 3. vault 경로 설정 (.env 파일)
cp .env.example .env
# `.env`를 열어 OBPUB_VAULT_PATH= 뒤에 본인 Obsidian vault 절대 경로를 입력
# 예: OBPUB_VAULT_PATH=/Users/you/Documents/Obsidian

# 4. 개발 서버
pnpm --filter blog dev  # http://localhost:4321

# 5. 정적 빌드 + audit
pnpm --filter blog build
# → apps/blog/dist/ 생성, Cloudflare Pages / Vercel / Netlify로 배포
```

## 배포

v0.1은 **Cloudflare Pages**(Direct Upload 방식)를 정식 지원합니다. 상세 절차는 [docs/DEPLOY.md](./docs/DEPLOY.md).

기본 도메인은 `https://noteforge.pages.dev`이며, fork 후 가장 먼저 할 일은 저장소 루트에 `.env`를 만들어 `OBPUB_VAULT_PATH`에 자기 머신의 Obsidian vault 절대 경로를 적는 것입니다(빠른 시작 §3). 이 경로는 GitHub Actions runner에 존재하지 않으므로 빌드는 항상 자기 머신에서 실행하고, `wrangler pages deploy apps/blog/dist`로 업로드합니다.

빌드는 항상 로컬, 호스트는 자유 — Cloudflare Pages를 권장 default로 두지만 다른 정적 호스트도 동일한 패턴으로 동작합니다.

| 호스트 | 무료 URL 패턴 | 업로드 명령 |
|---|---|---|
| Cloudflare Pages (권장) | `*.pages.dev` | `wrangler pages deploy apps/blog/dist --project-name=<my-blog>` |
| GitHub Pages (대안) | `<USER>.github.io/<REPO>` | `gh-pages` 브랜치에 `apps/blog/dist` 푸시 (자세히는 `docs/DEPLOY.md` §9) |

Vercel/Netlify도 동일한 패턴(`pnpm --filter blog build` 후 `dist/` 업로드)으로 동작합니다 — 자세한 명령은 [`docs/DEPLOY.md`](./docs/DEPLOY.md) §9 참고.

빌드는 사용자 머신에서 수행해야 합니다 — `apps/blog/obsidian-blog.config.ts`의 `vaults[0].path`가 사용자 로컬 절대 경로이기 때문입니다(CI runner에 그 경로가 없으므로 GitHub Actions 자동 빌드는 의도적으로 미지원). 자세한 단계는 [`docs/DEPLOY.md`](./docs/DEPLOY.md).

## 사이드바 아이덴티티 — avatar / nickname (v0.3)

좌측 사이드바 최상단에 본인 아이덴티티 블록을 표시하려면 `apps/blog/obsidian-blog.config.ts`에 `site.avatar` + `site.nickname`을 추가합니다. 둘 다 채워졌을 때만 블록이 렌더되며 — placeholder 폴백("Anonymous", initials silhouette)은 일부러 만들지 않습니다(v0.3 UI_GUIDE 7-3).

```ts
// apps/blog/obsidian-blog.config.ts
export default defineConfig({
  site: {
    title: 'shine notes',
    url: 'https://noteforge.pages.dev',
    author: 'shine',
    avatar: '/avatar.png', // apps/blog/public/avatar.png
    nickname: 'shine',
  },
  // …
});
```

`site.avatar`는 **외부 호스트를 거부**합니다(`http(s)://`, `//cdn`, `data:` 4종 모두 schema validation에서 reject) — referrer/IP 누출 경로를 fork 사용자가 부지불식간에 만들 수 없도록. 자산은 항상 `apps/blog/public/` 아래 self-host.

> **v0.3 마이그레이션 노트**: 내부 URL 정책이 trailing slash 없음(`/foo`)에서 항상 있음(`/foo/`)으로 바뀌었습니다. canonical URL · OG `og:url` · alias `<meta refresh>`가 모두 자동 갱신되지만, 외부 사이트에서 v0.2 URL을 하드코딩으로 링크해 둔 경우 정규화에 주의하세요.

## 노트를 공개하는 방법

### 방법 1: frontmatter
```markdown
---
public: true
title: "My First Public Note"
date: 2026-04-17
---

내용…
```

### 방법 2: 태그
```markdown
# 제목
본문 어딘가에 #public 태그만 있으면 공개됩니다.
```

둘 중 **하나만 있어도** 공개. 둘 다 없으면 비공개(기본).

## Obsidian에서 "어떤 노트가 공개되는지" 확인

Obsidian 안에서 Dataview 플러그인으로:

~~~markdown
```dataview
TABLE file.mtime as "수정일"
WHERE public = true OR contains(file.tags, "#public")
SORT file.mtime DESC
```
~~~

또는 CLI:
```bash
pnpm obpub status path/to/note.md
# → path/to/note.md → PUBLIC (reason: frontmatter public: true, line 2)
```

## 라이선스

[MIT](./LICENSE). 코드는 자유롭게 사용/수정/재배포 가능합니다.

**당신의 vault는 당신의 것입니다** — 이 도구는 vault 콘텐츠를 저장/전송/분석하지 않으며, 텔레메트리를 보내지 않습니다.

## 상태

**v0.3.0 — 사이드바 · 폴더 트리 · 홈 레일 · 아이덴티티 개편 (Pre-release naming).**
v0.2 도그푸드 결과로 *vault의 모양*을 노출하는 navigational spine을 추가했습니다 — 좌측 영구 사이드바(lg+) / 모바일 햄버거 드로어, JS-less `<details>` 폴더 트리, AvatarBlock 아이덴티티(외부 호스트 차단), 홈 Recent + Featured 두 레일, 폴더 인덱스 페이지 + `trailingSlash: 'always'` 통일. v0.2의 editorial-technical 골격(serif/sans/mono triad, hairline border, 라이트/다크 듀얼 테마)과 privacy 계약 / 접근성 / 정적 출력 제약은 그대로 유지. 토큰만 확장: 보조 accent(forest moss) + 카테고리 accent 5 슬롯 + 사이드바 surface tier — 모두 warm earth tone family. 배포는 Cloudflare Pages 기본 도메인(`noteforge.pages.dev`) 사용 중.

상세 변경 내역은 [CHANGELOG.md](./CHANGELOG.md).

- [x] Step 0: 문서 구조
- [x] Step 1: monorepo 스켈레톤
- [x] Step 2: `@noteforge/core` privacy 엔진 (TDD)
- [x] Step 3: `@noteforge/astro` integration
- [x] Step 4: `@noteforge/theme-default`
- [x] Step 5: `@noteforge/cli`
- [x] Step 6: `apps/blog` 도그푸드 (로컬 빌드 + audit 통과)
- [x] Step 7: CI + 릴리스 준비
- [x] Step 8: 배포 + alias redirect (Cloudflare Pages, canonical/og, alias→redirect)
- [x] Step 9: 디자인 대대적 개편 (UI v0.2 — 라이트/다크 토큰, layout/nav, prose+heading anchor, backlinks/tags/graph 시각 정렬)
- [x] Step 10: 사이드바 · 폴더 트리 · 홈 레일 · 아이덴티티 개편 (UI v0.3 — Sidebar/AvatarBlock/FolderTree/FolderIndex/RecentRail/FeaturedRail, trailingSlash 'always', 토큰 확장 — 보조 accent + 5 카테고리 슬롯 + 사이드바 surface tier)

### v0.3 이후로 의도적으로 미룬 것
- callouts / KaTeX / Mermaid / block reference / RSS / sitemap / OG image / 전문 검색(Pagefind)
- 다중 vault 실행 (스키마는 배열 허용하나 `length > 1`이면 명확한 에러)
- Obsidian 플러그인 래퍼 (v0.4+)
