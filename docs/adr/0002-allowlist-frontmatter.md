# 0002. Frontmatter Allowlist (Not Blocklist)

## Status
Accepted · 2025-Q4

## Context
Obsidian vault 의 frontmatter 는 사용자 마음대로 필드를 추가할 수 있는 free-form YAML 이다. 사용자가 personal notes / `obsidian-tasks` 플러그인 / 개인 메타데이터를 frontmatter 에 보관하는 경우가 흔하다.

블로그가 frontmatter 를 *그대로* HTML `<meta>` / OG / sitemap 에 노출하면 의도하지 않은 누출이 발생한다. 두 가지 접근:

- **Blocklist**: 알려진 민감 필드를 차단. 새 필드가 추가되면 기본 노출 → 누출 위험.
- **Allowlist**: 명시 허용한 필드만 노출. 새 필드는 기본 차단 → 안전.

## Decision
**Allowlist 만 사용.** 허용 필드 목록:

```
title, description, date, updated, tags, aliases, cover, thumbnail,
author, draft, public, slug, permalink, lang, featured
```

- 변경은 단 한 곳 — `packages/core/src/privacy/frontmatterFilter.ts` — 에서만.
- 새 필드 추가 PR 은 fixture canary 가 누설 0회임을 강제한다.
- `cover` / `thumbnail` 같은 이미지 path 는 allowlist 안이지만 추가로 *public attachment closure* 검증이 필요하다 (이미지 자체가 public 노트에서 도달 가능해야 함).

## Consequences
- **+** "이번 한 번만" 우회를 막는 단일 게이트가 성립.
- **+** 누출 후폭풍이 코드 한 곳 검토로 한정된다.
- **−** 사용자가 자신만의 필드 (예: `mood`, `inbox-priority`) 를 노출하고 싶으면 allowlist 변경 PR 이 필요하다 — 마찰이지만 의도된 것.

## Related
- [adr/0001-privacy-first-opt-in.md](./0001-privacy-first-opt-in.md).
- root CLAUDE.md CRITICAL 4번.
- 변경 시 fixture: `packages/core/tests/fixtures/vault-mixed/public-with-extra-fm.md`.
