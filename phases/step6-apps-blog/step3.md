# Step 3: blog-build-and-audit-verify

코드를 더 쓰지 않는다. step 0~2의 산출물이 실 vault(`/mnt/c/Users/shine/Documents/Obsidian`) 위에서 실제로 동작하는지 확인하고, audit 누출 검증이 통과하는지를 두 시나리오로 검증한다. 마지막으로 README의 "MVP 구현 전 단계" 문구를 v0.1 사용 가능 상태로 갱신하고, MVP에서 빠진 alias redirect / heading anchor를 v0.2 후속으로 명시한다.

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — Phase D audit 검증 항목.
- `/docs/PRD.md` — `obpub build`/`audit` 종료 리포트 형식.
- `/CLAUDE.md` — CRITICAL: vault-mixed canary는 0회.
- step 0~2 산출물 전체 (apps/blog/).
- `/packages/cli/src/commands/{audit,build,status}.ts` — `pnpm obpub` CLI 사용법.
- `/packages/cli/src/lib/audit/checks.ts` — audit가 검사하는 6개 규칙 (이 step의 검증 기준).
- `/README.md` — 현재 "v0.1 MVP 구현 전 단계" 문구 위치.
- `/TODO.md` — 미결정 / 사용자 확인 필요 섹션.

## 작업

이 step은 검증 + 문서 갱신 두 트랙. 코드 변경은 README와 (필요시) 작은 노트만.

### 1. 시나리오 (a) — 0-public

사용자 vault에는 현재 `public: true` / `#public` 노트가 거의 없을 것으로 추정. 그대로 빌드 + audit를 통과해야 한다.

```bash
pnpm --filter blog build
pnpm obpub audit apps/blog/dist
```

기대 결과:
- astro build 성공.
- `apps/blog/dist/index.html`에 "아직 공개된 글이 없습니다" 플레이스홀더.
- `apps/blog/dist/api/graph.json`이 `{"nodes":[],"edges":[]}` (또는 동등한 빈 객체).
- audit 0 violations.

만약 사용자 vault에 우연히 `public: true` 노트가 1개 이상 있다면 (b) 시나리오로 자연스럽게 전환된다 — 그 경우 (a)는 "0-public이 아닌 base"로 기록하고 (b) 시나리오의 임시 추가는 생략.

### 2. 시나리오 (b) — ≥1-public + canary 부재

vault에 임시 노트 하나를 만들고 빌드/audit이 통과하는지 + canary 문자열이 dist에 0회 등장하는지 확인한다.

```bash
# 임시 공개 노트 + 비공개 canary 노트 추가
cat > "/mnt/c/Users/shine/Documents/Obsidian/_obpub-smoke-public.md" <<'EOF'
---
public: true
title: "obpub smoke (delete me)"
date: 2026-04-25
---

This is a one-off smoke note. Link to a non-existent target: [[_obpub-smoke-private]].
EOF

cat > "/mnt/c/Users/shine/Documents/Obsidian/_obpub-smoke-private.md" <<'EOF'
---
title: "obpub smoke private (delete me)"
---

CANARY_OBPUB_SMOKE_DELETE_ME body. %%hidden CANARY_OBPUB_COMMENT_DELETE_ME%%
EOF

pnpm --filter blog build
pnpm obpub audit apps/blog/dist

# canary 부재 검증
grep -r "CANARY_OBPUB_SMOKE_DELETE_ME"  apps/blog/dist/ ; echo "exit=$?"   # exit 1 (no match)
grep -r "CANARY_OBPUB_COMMENT_DELETE_ME" apps/blog/dist/ ; echo "exit=$?"  # exit 1 (no match)
grep -r "obpub smoke private"            apps/blog/dist/ ; echo "exit=$?"  # exit 1 (no match — private title 누설 금지)

# 정리
rm "/mnt/c/Users/shine/Documents/Obsidian/_obpub-smoke-public.md"
rm "/mnt/c/Users/shine/Documents/Obsidian/_obpub-smoke-private.md"
```

기대 결과:
- astro build 성공, 공개 페이지 1개 (`/_obpub-smoke-public/`).
- audit 0 violations.
- 세 grep 모두 exit 1 (canary, comment canary, private title 모두 0회 등장).
- 임시 노트 정리 후 vault에 흔적 없음.

**vault 정리는 반드시 시나리오 종료 직후 수행.** 임시 노트가 사용자 vault에 남으면 신뢰가 무너진다.

이 시나리오는 **사용자 vault에 직접 파일을 쓰는** 단계이므로 step 실행 시 한 번만 수행. 자동화하지 않는다 — 본 step.md의 명령을 사람이 한 번 따라 친다(또는 child Claude 세션이 정확히 위 명령을 실행 + 정리까지). 정리 실패 가능성에 대비해 `_obpub-smoke-*.md` prefix를 고정해 두면 사후 일괄 정리가 가능하다.

### 3. CLI smoke

```bash
# vault 안 임의의 .md 파일에 대해 status 호출
pnpm obpub status "/mnt/c/Users/shine/Documents/Obsidian/Test.md"
# 기대: "Test.md → PRIVATE (reason: no public marker)" (Test.md가 빈 파일이라면)

# 임시 공개 노트가 살아있는 동안:
pnpm obpub status "/mnt/c/Users/shine/Documents/Obsidian/_obpub-smoke-public.md"
# 기대: "_obpub-smoke-public.md → PUBLIC (reason: frontmatter public: true)"
```

CLI가 한 줄 출력 + 종료 코드 0이면 통과.

### 4. README 갱신

`README.md`의 "상태" 섹션을 v0.1 MVP 사용 가능 상태로 수정.

변경 전:

```
## 상태

v0.1 MVP 구현 진행 중. 정식 계획은 [plan 파일](/.claude/plans/public-fizzy-patterson.md) 참고.

- [x] Step 0: 문서 구조
- [ ] Step 1: monorepo 스켈레톤
...
```

변경 후 (체크박스 갱신 + 사용 가능 안내 추가):

```
## 상태

v0.1 MVP 도그푸드 가능. CI/배포는 이후 단계.

- [x] Step 0: 문서 구조
- [x] Step 1: monorepo 스켈레톤
- [x] Step 2: `@obpub/core` privacy 엔진 (TDD)
- [x] Step 3: `@obpub/astro` integration
- [x] Step 4: `@obpub/theme-default`
- [x] Step 5: `@obpub/cli`
- [x] Step 6: `apps/blog` 도그푸드 (로컬 빌드 + audit 통과)
- [ ] Step 7: CI + 릴리스 준비

### v0.1에서 의도적으로 빠진 것 (v0.2 후속)
- alias frontmatter → canonical URL 정적 redirect HTML
- heading anchor (`h2`/`h3` 호버 `#`)
- callouts / KaTeX / Mermaid / block reference / RSS / sitemap / OG image / 검색
- dark mode
```

"## 빠른 시작" 섹션의 "주의: 현재 MVP 구현 전 단계" 문구도 제거 또는 "v0.1 MVP 사용 가능"으로 갱신.

"## 빠른 시작" 섹션의 `pnpm --filter apps/blog ...` 명령은 `pnpm --filter blog ...`로 갱신해야 한다(`apps/blog/package.json`의 name이 `"blog"`이므로 기존 명령은 `No projects matched the filters`로 실패한다 — 최근 commit `chore: fix pnpm --filter target for blog app`와 일관).

vault 절대경로는 README에 적지 마라(사용자 머신 정보).

### 5. v0.2 후속 항목 명시 (TODO.md는 건드리지 않음)

TODO.md는 이 step에서 갱신하지 않는다 — Step 6 phase 전체 완료 표시는 별도 정리 (이전 phase들의 패턴과 일관). README의 "v0.1에서 의도적으로 빠진 것" 목록이 v0.2 후속 항목의 단일 소스 역할.

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
pnpm obpub audit apps/blog/dist
```

전부 0 exit + 시나리오 (a) 또는 (b) 중 적용된 쪽이 통과 (vault 상태에 따라).

(b)를 수행했다면:
- 임시 노트 2개가 vault에서 모두 제거됨 (`ls /mnt/c/Users/shine/Documents/Obsidian/_obpub-smoke-*.md` → no matches).
- canary grep 3건 모두 exit 1.

`README.md`가 v0.1 사용 가능 상태로 갱신됨 (git diff 확인).

## 검증 절차

1. 시나리오 (a) 실행.
2. 사용자 vault에 우연히 공개 노트가 없으면 (b) 시나리오로 진행.
3. CLI smoke 2건 (status PRIVATE + PUBLIC) 확인.
4. (b) 실행 시 vault 정리가 완료됐는지 `ls _obpub-smoke-*.md`로 검증.
5. README diff 검토.
6. 아키텍처 체크리스트:
   - audit 검사 6 규칙이 모두 0 violation으로 통과했는가?
   - private 노트 제목 / canary / `%%comment%%` / allowlist 외 frontmatter 키가 dist에 0회 등장하는가?
   - graph.json의 모든 엣지 끝점이 공개 슬러그 집합 안인가?
   - vault에 잔여 임시 노트가 없는가?
7. 결과에 따라 `phases/step6-apps-blog/index.json`의 step 3을 업데이트.

## 금지사항

- **시나리오 (b) 수행 후 임시 노트 정리를 건너뛰지 마라.** 이유: 사용자 vault에 흔적이 남으면 도그푸드 신뢰가 무너진다. 정리 실패는 즉시 보고.
- **vault에 canary 노트를 영구 추가하지 마라.** 이유: vault-mixed canary는 fixture 안에서만 의미가 있다(이미 step2c에서 검증). 실 vault는 사용자 데이터.
- **README/문서/주석에 vault 절대경로를 적지 마라.**
- **audit가 fail하면 추가 우회 옵션을 도입하지 마라.** 이유: audit fail은 누출 신호. 원인 진단 → 코드 수정. `--strict`를 끄거나 검사 규칙을 약화하는 식의 우회는 제품 가치 자체를 깬다.
- **alias redirect / heading anchor를 이 step에서 구현하지 마라.** 이유: v0.2 후속. README 명시로 충분.
- **`pnpm obpub audit`의 결과를 손으로 가공해서 통과 처리하지 마라.** 종료 코드와 스캐너 출력을 그대로 신뢰.
- **TODO.md를 갱신하지 마라.** 이유: phase 완료 정리는 이전 패턴과 일관되게 별도 PR/커밋.
- **기존 테스트를 깨뜨리지 마라.** 특히 vault-mixed canary 0회 검증.
