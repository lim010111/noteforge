<!-- repo: lim010111/obsidian-blog -->

# Obsidian-Publish-OSS

> Obsidian vault 를 선택적으로 공개하는 정적 블로그 SSG. **Privacy-first**: 표시하지 않은 것은 존재조차 드러내지 않는다.

`public: true` frontmatter 또는 본문 어디든 `#public` 태그가 있는 노트만 발행한다. 기본값 = 비공개 (Quartz 의 opt-out 기본값과 정반대). Threat model · 책임 범위는 [docs/PRD.md](./docs/PRD.md).

## 빠른 시작

```bash
git clone <this-repo> my-blog && cd my-blog
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

## 문서

- [docs/PRD.md](./docs/PRD.md) — Threat model · 책임 / 비책임 범위
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 모듈 / 파이프라인 / 의존 그래프
- [docs/DEPLOY.md](./docs/DEPLOY.md) — Cloudflare Pages · GitHub Pages · 다른 정적 호스트
- [docs/UI_GUIDE.md](./docs/UI_GUIDE.md) — 디자인 토큰 / 레이아웃 가이드
- [CHANGELOG.md](./CHANGELOG.md) — 릴리스 노트
- [CLAUDE.md](./CLAUDE.md) / [AGENTS.md](./AGENTS.md) — agent 컨텍스트 (모듈별 동일 짝 존재)

## 라이선스

MIT. vault 콘텐츠는 저장 / 전송 / 분석 / 텔레메트리 어디로도 가지 않는다.

## 상태

**v0.3.0** — 사이드바 · 폴더 트리 · 홈 레일 · 아이덴티티 (Pre-release). v0.2 의 editorial-technical 골격 위에 navigational spine 을 얹은 단계. 상세 변경 내역은 [CHANGELOG.md](./CHANGELOG.md).
