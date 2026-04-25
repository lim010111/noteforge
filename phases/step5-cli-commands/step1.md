# Step 1: cli-audit-command

`obpub audit`는 빌드 산출물(`dist/`)을 **독립적으로** 스캔해 privacy 누출을 탐지하는 마지막 방어선이다. ARCHITECTURE.md "Phase D. Post-build Audit"를 구현한다. `--strict`는 약한 신호(저자가 직접 타이핑한 private 노트 제목 추정 등)에도 fail.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "Phase D. Post-build Audit" 항목의 6개 검증 규칙.
- `/docs/PRD.md` — audit이 "표시하지 않은 것은 존재조차 드러내지 않는다" 약속의 검증 도구라는 점.
- `/docs/ADR.md` — ADR-006 (frontmatter allowlist).
- `/CLAUDE.md` — frontmatter allowlist 정확한 14개 키, canary 문자열 (`DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`).
- `/packages/core/src/config.ts` — `frontmatterAllowlist`, `tagBlocklist` 등 config 필드.
- `/packages/core/src/pipeline.ts` — pipeline 결과 형식. audit이 빌드 산출물을 보지만 "기대되는 public 슬러그 집합"을 알아야 한다면 pipeline의 결과 JSON을 사이드채널로 받을 수 있다 — **단, 가능하면 dist만으로 검증한다** (독립성 우선).
- `/packages/core/tests/fixtures/vault-mixed/` — audit 테스트의 입력 fixture로 활용 가능.
- 이전 step 산출물:
  - `packages/cli/src/bin.ts` — commander 진입점 (status 명령이 등록되어 있음).
  - `packages/cli/src/lib/loadConfig.ts` — 설정 로더.

## 작업

### 1. 패키지 구조 보강

```
packages/cli/src/
├── bin.ts                       # audit 명령 등록 추가
├── commands/
│   ├── status.ts                # (이전 step 산출물)
│   └── audit.ts                 # `obpub audit` 구현
├── lib/
│   ├── loadConfig.ts            # (이전 step 산출물)
│   └── audit/
│       ├── scanDist.ts          # dist 트리 → 검사 가능한 자료구조
│       ├── checks.ts            # 6개 룰 모듈
│       └── report.ts            # AuditReport 포맷터
packages/cli/tests/
└── audit/
    ├── scanDist.test.ts
    ├── checks.test.ts
    └── audit.integration.test.ts
```

### 2. 인터페이스 시그니처

`packages/cli/src/lib/audit/checks.ts`:

```ts
export interface AuditViolation {
  readonly rule:
    | 'private-note-title-in-html'
    | 'private-attachment-in-dist'
    | 'graph-edge-leaks-private'
    | 'frontmatter-allowlist-violation'
    | 'obsidian-comment-leak'
    | 'tag-blocklist-leak'
    | 'authored-private-title-mention';      // strict only
  /** 경로 + 라인/오프셋 가능하면 첨부 */
  readonly location: string;
  /** 사용자에게 보일 한 줄 설명 */
  readonly message: string;
  /** rule이 strict-only면 true */
  readonly strictOnly: boolean;
}

export interface AuditInput {
  /** `dist/` 디렉토리 절대경로 */
  readonly distDir: string;
  /** 빌드된 사이트가 약속한 공개 슬러그 집합. graph 엣지 끝점 검증에 필수 */
  readonly publicSlugs: ReadonlySet<string>;
  /** private 노트 제목 집합 (strict 모드에서 본문 텍스트 매칭에 사용) */
  readonly privateTitles: ReadonlySet<string>;
  /** private 첨부 파일명 집합 (베이스네임) */
  readonly privateAttachmentBasenames: ReadonlySet<string>;
  /** config.frontmatterAllowlist */
  readonly frontmatterAllowlist: ReadonlySet<string>;
  /** config.tagBlocklist (정규화된 태그 문자열) */
  readonly tagBlocklist: ReadonlySet<string>;
  /** strict 모드면 약한 신호 룰까지 포함 */
  readonly strict: boolean;
}

export async function runAuditChecks(input: AuditInput): Promise<readonly AuditViolation[]>;
```

`packages/cli/src/commands/audit.ts`:

```ts
import type { ObpubConfig } from '@obpub/core/config';

export interface AuditOptions {
  readonly distDir?: string;          // default: <config-dir>/dist
  readonly strict?: boolean;
}

export interface AuditOutcome {
  readonly violations: readonly AuditViolation[];
  readonly checkedFiles: number;
  readonly elapsedMs: number;
}

/**
 * 1. config + vault를 읽어 runCorePipeline을 한 번 돌린다 (publicSlugs/privateTitles 등 도출).
 * 2. distDir을 walk + 각 파일 본문 추출 → AuditInput 구성.
 * 3. runAuditChecks 호출 후 결과 반환.
 *
 * 호출자(bin.ts)는 violations.length > 0일 때 exit 1.
 */
export async function runAudit(config: ObpubConfig, opts: AuditOptions): Promise<AuditOutcome>;
```

### 3. 6개 룰 (+ strict 1개)의 정확한 검사 방식

본문 추출은 cheerio 같은 무거운 의존을 피하고, **dist HTML을 단순 문자열 검색** 위주로 하되 graph.json만 JSON.parse 한다. 정규식은 인용 보일러플레이트 검출이 아닌 **누출 후보 탐지**가 목적이므로 false positive를 약간 허용한다.

| rule | 검사 대상 | 통과 조건 |
|---|---|---|
| `private-note-title-in-html` | `dist/**/*.html` 모든 파일의 raw 텍스트 | private 노트 **각 제목 정확 매치** (`indexOf` substring; 단어 경계는 무시 — 안전성 우선) 0회. strict가 아닐 때는 noun-phrase가 너무 짧아 false positive 위험이 있는 제목(<3자, 영숫자 외 문자만)은 제외하고 검사한다. |
| `private-attachment-in-dist` | `dist/**/*` 모든 베이스네임 | private 첨부 파일명과 **정확히** 일치하는 파일이 dist에 0건. |
| `graph-edge-leaks-private` | `dist/api/graph.json` (있으면) | nodes의 모든 슬러그 ∈ publicSlugs. edges의 source/target 모두 ∈ publicSlugs. |
| `frontmatter-allowlist-violation` | `dist/**/*.html`의 `<meta>` + JSON-LD `<script type="application/ld+json">` 텍스트 | 알려진 메타 키(예: `name="author"`)는 allowlist에 있어야 하고, JSON-LD 객체의 키 중 allowlist 밖 키가 있으면 위반. **간단 규칙으로 시작**: HTML에 `data-fm-{key}` 속성이 있으면 그 키들만 검사한다 — theme이 `<body data-fm-...>`로 표시하지 않으면 이 룰은 noop. theme 측 책임. |
| `obsidian-comment-leak` | `dist/**/*.html` raw 텍스트 | `%%`가 두 번 이상 인접해 등장하면 위반. (단, code block 안에서의 `%%`는 escape되어 등장할 수 있어 false positive 허용). canary 문자열 `CLAUDE_COMMENT_LEAK_77b`는 0회. |
| `tag-blocklist-leak` | `dist/**/*.html` | tagBlocklist 항목과 일치하는 `#tag` 링크/텍스트 0회. config.tagBlocklist이 비어 있으면 noop. |
| `authored-private-title-mention` (strict only) | `dist/**/*.html` | `private-note-title-in-html`과 동일한 검사를 짧은 제목(<3자)까지 포함해 실행하고, 위반은 `strictOnly: true`로 표시. |

canary 검증은 별도 룰을 만들지 않고 위 룰들이 잡도록 fixture 자체에 canary를 심어 통합 테스트한다 (`vault-mixed`에 이미 있음).

### 4. publicSlugs / privateTitles 도출

`runCorePipeline` 결과를 그대로 활용한다. pipeline.ts가 다음을 노출하지 않으면 **이 step에서 export 형식을 보강**한다 (ARCHITECTURE 변경 없음 — 데이터 표면만 확장):

```ts
// pipeline.ts 결과 타입 (예시 — 실제 이름은 코드 확인)
export interface CorePipelineResult {
  readonly publicNotes: readonly { slug: string; title: string; ... }[];
  readonly privateNotes: readonly { title: string; relativePath: string; ... }[];
  readonly publicAttachments: readonly { basename: string; ... }[];
  readonly privateAttachments: readonly { basename: string; ... }[];
  // ...
}
```

audit는 위 결과를 **읽기만** 한다. 새로 분류 로직을 짜지 않는다.

### 5. TDD — 실패 테스트 먼저

`packages/cli/tests/audit/checks.test.ts` (단위):

1. private 제목이 HTML에 등장 → `private-note-title-in-html` 1건 위반.
2. private 첨부 파일명이 dist에 등장 → `private-attachment-in-dist` 1건.
3. graph.json의 edge가 publicSlugs에 없는 슬러그를 가리킴 → `graph-edge-leaks-private` 1건.
4. graph.json에 nodes만 누출 → 1건.
5. `<body data-fm-secret="...">`가 allowlist 밖 키 → `frontmatter-allowlist-violation` 1건.
6. HTML에 `%%hidden%%` → `obsidian-comment-leak` 1건.
7. tagBlocklist 항목이 HTML에 등장 → `tag-blocklist-leak` 1건.
8. strict=false에서 짧은 제목(예: "AI") 무시.
9. strict=true에서 짧은 제목 검출 → `authored-private-title-mention`.
10. 정상 빌드 산출물 → 0건.

`packages/cli/tests/audit/audit.integration.test.ts` (통합):

1. `vault-mixed` fixture로 임시 dist 디렉토리를 합성(또는 `runCorePipeline` 결과 + 미리 만든 dist HTML 템플릿). canary `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`가 dist에 들어가면 위반 잡혀야 함.
2. canary 없는 깨끗한 산출물에선 0건.

### 6. bin.ts 명령 등록

```ts
program
  .command('audit')
  .description('Scan dist/ for privacy leaks')
  .option('-c, --config <path>', 'path to obsidian-blog.config.ts')
  .option('-d, --dist <path>', 'path to dist directory (default: <config-dir>/dist)')
  .option('--strict', 'fail on weak signals (authored title mentions, etc.)')
  .action(async (opts) => {
    // 1. loadConfig
    // 2. runAudit(config, { distDir: opts.dist, strict: !!opts.strict })
    // 3. report 출력 — 위반 1건당 한 줄 + 마지막에 요약
    // 4. violations.length > 0이면 exit 1, 아니면 exit 0
  });
```

출력 형식 (위반 있을 때, stderr):

```
[audit] {rule}  {location}
        {message}
...
[audit] FAIL — {N} violations across {M} files (checked {checkedFiles} files in {elapsedMs}ms)
```

성공 시 (stdout):

```
[audit] OK — 0 violations (checked {checkedFiles} files in {elapsedMs}ms)
```

## Acceptance Criteria

```bash
pnpm install
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter @obpub/cli test
```

전부 0 exit. 새 audit 테스트 12개 이상 통과.

## 검증 절차

1. AC 커맨드 실행.
2. 핵심 회귀 검증: `vault-mixed` 기반 통합 테스트에서 canary `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`가 합성 dist에 0회임을 audit이 확인하는지(녹색 시나리오), 그리고 fixture HTML에 일부러 canary를 주입한 시나리오에서 audit이 빨갛게 fail하는지(빨강 시나리오) 둘 다 통과해야 한다.
3. 아키텍처 체크리스트:
   - 공개/비공개 분류 로직을 audit에서 다시 구현하지 않았는가? (`runCorePipeline` 또는 `classify`만 사용.)
   - canary 문자열을 `expect(...).toContain('...')` 같은 곳에서 **로깅**하지 않는가? canary는 fixture에 묻혀 있고 audit이 잡으면 된다 — 테스트 코드에 canary 문자열 리터럴이 들어가는 건 OK.
   - 동기 fs API가 아닌 async fs/promises를 사용하는가?
4. 결과에 따라 `phases/step5-cli-commands/index.json`의 step 1을 업데이트.

## 금지사항

- **분류 로직을 다시 짜지 마라.** 이유: CLAUDE.md CRITICAL — 결정은 한 곳, 호출은 여러 곳. audit은 검증자이지 분류자가 아니다.
- **astro 또는 빌드 파이프라인을 audit 안에서 호출하지 마라.** 이유: audit은 "이미 만들어진 dist"를 외부에서 보는 도구. 빌드 후 hookup은 step 2의 책임.
- **dist 안의 파일을 수정/삭제/이동하지 마라.** 이유: audit은 read-only. 잘못 잡았더라도 사용자 산출물을 건드리면 안 됨.
- **위반 메시지에 private 노트 제목 전체를 포함하지 마라.** 이유: stderr가 CI 로그로 흘러갈 수 있다. `[REDACTED]` 또는 첫 4자 + 해시로 표시. 단 strict 모드에서도 마찬가지.
- **동기 readdirSync/readFileSync를 쓰지 마라.** 이유: 큰 dist에서 이벤트 루프 블록.
- **외부 HTTP 요청을 audit에서 발생시키지 마라.** 이유: PRD가 약속하는 텔레메트리 무발생 원칙.
- **기존 테스트를 깨뜨리지 마라.**
