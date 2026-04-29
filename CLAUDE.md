# Obsidian-Publish-OSS (작업명)

## 프로젝트 개요
Obsidian vault에서 `public: true` frontmatter 또는 `#public` 태그가 있는 노트만 선택적으로 정적 블로그로 발행하는 오픈소스 SSG. **privacy-first(opt-in)** 가 제품의 핵심 계약. Quartz의 opt-out 기본값이 불안한 사용자를 위한 대안.

## 기술 스택
- Astro 5.x (Content Layer API)
- TypeScript strict mode (`noUncheckedIndexedAccess: true`)
- Tailwind CSS v4 (`@tailwindcss/vite`)
- pnpm workspaces monorepo
- Vitest (unit/integration), Playwright (smoke)
- Node 22.6+ (LTS 22.11 권장)

## 레포 구조
```
obsidian_blog/
├── packages/
│   ├── core/               # @noteforge/core   — 프레임워크 독립 엔진
│   ├── astro-integration/  # @noteforge/astro  — Astro Content Layer + watcher 어댑터
│   ├── theme-default/      # @noteforge/theme-default — 레퍼런스 테마
│   └── cli/                # @noteforge/cli    — obpub dev/build/audit/status
└── apps/
    └── blog/               # 도그푸드 사이트
```

## 아키텍처 규칙
- **CRITICAL**: 공개/비공개 판정은 반드시 `packages/core/src/privacy/`에 집중. 테마/어댑터/앱 어디서도 독자 구현 금지. 결정은 한 곳, 호출은 여러 곳.
- **CRITICAL**: `private/**` 폴더의 파일은 frontmatter `public: true`가 있어도 공개 금지(tripwire). 우회에는 `unsafeAllowPrivateFolder: true` 필요.
- **CRITICAL**: Obsidian `%%...%%` 코멘트는 Phase A(discovery)에서 즉시 제거. 이후 파이프라인에 남아있지 않아야 함.
- **CRITICAL**: frontmatter는 **allowlist** 외 필드를 공개 HTML/meta에 노출하지 말 것. allowlist: `title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`.
- **CRITICAL**: `![[Note]]` transclusion은 링크와 동일하게 공개 판정을 거치고, private 타겟은 AST에서 **완전 제거**. public 타겟은 재귀적으로 동일 파이프라인 적용.
- 프레임워크 독립 로직은 `packages/core/`, Astro 종속은 `packages/astro-integration/`.
- 컴포넌트/레이아웃은 `packages/theme-default/`. 앱 레벨 커스텀은 `apps/blog/`.
- 빌드는 순수 함수. in-memory 상태는 watcher만 보유.

## 개발 프로세스
- **CRITICAL**: 새 기능은 **TDD** — 실패 테스트 작성 → 통과 구현. privacy 로직은 엄격 적용.
- **CRITICAL**: privacy 관련 모든 PR은 `packages/core/tests/fixtures/vault-mixed/` fixture에서 canary(`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`, `FOLDER_TREE_DO_NOT_LEAK_8a4f2`)가 렌더 HTML에 0회 등장하는지 검증.
- 커밋 메시지는 conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `build:`).
- 머지 전 로컬: `pnpm -r typecheck && pnpm lint && pnpm test && pnpm --filter blog build`.
- 작은 PR 선호. privacy 파일(`packages/core/src/privacy/**`)을 건드리는 PR은 별도로 분리.

## 명령어
```
pnpm install                         # 의존성 설치
pnpm --filter blog dev          # 개발 서버 (HMR)
pnpm --filter blog build        # 빌드 + audit
pnpm test                            # 전 워크스페이스 Vitest (root projects)
pnpm -r typecheck                    # TS strict
pnpm lint                            # ESLint (root flat config)
pnpm obpub status <file>             # 특정 노트의 공개 판정 이유 출력
pnpm obpub audit [--strict]          # 빌드 산출물 독립 검증
/harness [new <name>|resume|status|run]  # 하네스 슬래시 커맨드 (phase 상태 자동 감지 + 다음 행동)
```

## 용어
- **vault**: Obsidian 개인 지식 저장소 폴더 (레포 밖).
- **public/private 노트**: `isPublic()` 판정 결과. 기본값 `false`.
- **tripwire**: `private/` 폴더 규칙. frontmatter로도 우회 불가.
- **strip-to-text**: private 링크를 `<a>` 없이 텍스트로만 남기는 기본 동작.
- **canary**: fixture에 심어둔 누출 감지용 고유 문자열.
