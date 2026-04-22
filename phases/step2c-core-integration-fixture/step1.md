# Step 1: integration-pipeline-asserts

## 목표
Step 0에서 구축한 `packages/core/tests/fixtures/vault-mixed/` fixture를 입력으로 받아 Phase A→C 파이프라인을 조립하고, plan의 **11 가지 assert**를 Vitest로 모두 검증한다. 여기서 조립한 composition helper는 이후 `@obpub/astro` loader가 재사용한다.

TDD를 적용한다: 실패 테스트 파일을 먼저 만들고, 그다음 composition helper를 구현해 통과시킨다. 이 순서를 지켜라 — 파이프라인 composition 버그가 테스트 우선 작성 시점에만 잡힌다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `/docs/ARCHITECTURE.md` — Phase A→D 파이프라인, 데이터 흐름 다이어그램
- `/docs/PRD.md` — 검증 목표
- `/home/shine/.claude/plans/public-fizzy-patterson.md`의 **"검증 (Verification)"** 섹션 — 11개 assert 전체 문구
- Step 0 산출물: `packages/core/tests/fixtures/vault-mixed/**` + `README.md`
- 모든 core 모듈 — 입출력 시그니처 확인:
  - `packages/core/src/config.ts`
  - `packages/core/src/discover/walk.ts`
  - `packages/core/src/discover/parseNote.ts`
  - `packages/core/src/resolve/wikilink.ts`
  - `packages/core/src/slug.ts`
  - `packages/core/src/tags.ts`
  - `packages/core/src/privacy/classify.ts`
  - `packages/core/src/privacy/commentStrip.ts`
  - `packages/core/src/privacy/graph.ts`
  - `packages/core/src/privacy/linkRewriter.ts`
  - `packages/core/src/privacy/transclude.ts`
  - `packages/core/src/privacy/frontmatterFilter.ts`
  - `packages/core/src/privacy/attachmentFilter.ts`
  - `packages/core/src/types.ts`
- 기존 단위 테스트에서 각 모듈을 어떻게 호출하는지 참고: `packages/core/tests/*.test.ts`

## 작업

### (1) 테스트 파일을 먼저 작성

경로: `packages/core/tests/integration/vault-mixed.test.ts`

이 테스트는 다음을 수행한다:

1. `packages/core/tests/fixtures/vault-mixed/`를 absolute 경로로 해석.
2. `defineConfig({ vaults: [{ path, ignore: ['.obsidian/**', '.trash/**'] }], publishing: { tagBlocklist: ['client/**'] } })`로 config 구성. `private/**`는 core가 강제로 merge하므로 명시 불필요.
3. `runCorePipeline(config)` (아래 helper) 호출.
4. 결과 객체 `PipelineResult`의 필드를 기반으로 11개 assert 수행.

**11개 assert — 반드시 각각 독립된 `it(...)` 또는 `test(...)` 블록으로 분리**하여 실패 시 어느 assert가 깨졌는지 바로 보이게 한다:

1. `publicSlugs`가 정확히 `{public-note, another-public, public-with-image, public-with-embed, public-with-comment, public-with-extra-fm, public-with-secret-tag}` 7개 집합과 일치.
2. 모든 공개 노트의 렌더 HTML 문자열을 concat한 결과에 canary `DO_NOT_LEAK_BANANA_6f3c1`이 0회 등장.
3. 모든 공개 노트의 렌더 HTML에서 `<a ...>` 태그의 href 속성값과 title 속성값 중 어느 것에도 `Private Secret`/`private secret`이 포함되지 않는다 (정규식 `/<a\s[^>]*(?:href|title)\s*=\s*["'][^"']*private\s*secret/i`). strip-to-text 결과로 "Private Secret" 텍스트 노드는 존재 가능 — 단 `<a>` 속성 내에만 없으면 됨.
4. `attachmentClosure`(공개 참조 폐쇄)가 `only-public.png`를 포함하고 `only-private.png`를 포함하지 않는다.
5. `publicGraph.nodes`의 모든 노드가 public 집합에 속하고, 모든 엣지 `(from, to)`의 끝점이 public 집합에 속한다.
6. `private/family-photos.md`가 `publicSlugs`에 없고, `warnings` 배열에 tripwire 히트 경고(`code === 'TRIPWIRE_REJECTED'` 혹은 동등한 표식)가 정확히 1회 포함된다.
7. `public-with-embed`의 렌더 HTML 안에 `Another Public`의 본문 일부 문자열(예: "또 다른 공개 노트")이 포함되고, 동시에 canary `DO_NOT_LEAK_BANANA_6f3c1`은 0회 등장. 즉 public 임베드는 본문이 확장되고 private 임베드는 통째로 사라졌다.
8. 모든 공개 노트의 렌더 HTML을 concat한 결과에 `CLAUDE_COMMENT_LEAK_77b`이 0회 등장. 또한 `%%` 시퀀스도 0회 등장 (코멘트 구분자 자체가 남아서는 안 됨).
9. `public-with-extra-fm`의 **공개된 frontmatter**(allowlist 필터 통과 후)에 `review-date`, `personal-note`, `mood` 키가 모두 존재하지 않는다. 또한 렌더 HTML 문자열 어디에도 `review-date` / `personal-note` / `mood` / `do not ship` / `anxious` 문자열이 0회 등장 (대소문자 무시).
10. `public-with-secret-tag`의 공개된 `tags` 배열에 `client/acme-secret`이 없고, 렌더 HTML에도 `client/acme-secret`이 0회 등장. 단 `public/internal`은 blocklist에 포함되지 않았으므로 남아 있어도 된다(이 assert는 `client/**`에 한정한다).
11. `another-public`의 `aliases` 목록에 `구이름`이 들어 있고, wikilink 해석 시 `[[구이름]]` 입력이 `another-public` 슬러그로 매핑된다(예: `resolveWikilink('구이름', index) → { slug: 'another-public', kind: 'resolved' }`). 이 phase에서는 **wikilink resolve 수준**에서만 검증하고, `/구이름 → /another-public` HTML 정적 리다이렉트 생성은 astro integration phase에서 다룬다.

각 assert는 실패 시 어떤 불변식이 깨졌는지 명확한 메시지와 함께 던지도록 작성.

### (2) Composition helper 구현

새 파일: `packages/core/src/pipeline.ts`

export 시그니처 (정확한 타입은 구현 재량, 단 아래 형태를 유지):

```ts
export interface PipelineResult {
  notes: ParsedNote[];              // 전체 노트 (public + private, 누수 감지용 full set)
  publicSlugs: Set<string>;         // 공개 슬러그 집합
  renderedHtml: Map<string, string>;// 공개 슬러그 → 렌더된 HTML 문자열 (linkRewriter + transclude + frontmatterFilter + commentStrip 적용 후)
  publicFrontmatter: Map<string, Record<string, unknown>>; // 공개 슬러그 → allowlist 통과한 frontmatter
  publicTags: Map<string, string[]>;// 공개 슬러그 → blocklist 필터된 태그 목록
  publicGraph: { nodes: string[]; edges: Array<{ from: string; to: string }> }; // 공개 서브그래프
  attachmentClosure: Set<string>;   // 공개 첨부 파일 경로 집합 (vault 기준 상대경로)
  warnings: Array<{ code: string; file?: string; message: string }>;
}

export async function runCorePipeline(config: ObpubConfig): Promise<PipelineResult>;
```

내부 흐름은 ARCHITECTURE.md Phase A→C를 그대로 따른다:

```
walk → parseNote(+commentStrip) → resolve/wikilink (+aliases 인덱스) → classify
     → graph(full) → public 서브셋 계산
     → 각 공개 노트의 mdast에 linkRewriter, transclude 순차 적용 (transclude는 재귀/cycle 가드 이미 내장)
     → frontmatterFilter로 공개 frontmatter 산출
     → tags.ts의 blocklist 적용
     → attachmentFilter로 closure 계산
     → mdast → hast → HTML 직렬화
```

**HTML 직렬화**: `mdast-util-to-hast` + `hast-util-to-html`(또는 `unified` + `remark-rehype` + `rehype-stringify`) 중 하나 선택. 의존성은 `packages/core/package.json`의 `dependencies`에 추가. devDependencies 아님 — 프로덕션 파이프라인 경로에서 호출된다.

**중요**: `pipeline.ts`는 **Astro 비의존**이어야 한다. Astro 심볼, remark 전용 플러그인 로더 등을 `import`하지 말 것. `@obpub/astro` 쪽이 이 helper를 호출한다.

**중요**: 순수 함수 유지. 파일 시스템 I/O는 `walk` 한 지점에서만 발생. 이후 단계는 모두 메모리 데이터 변환.

### (3) 의존성 추가

필요시 `packages/core/package.json`에 다음 중 선택해 추가:
- `mdast-util-to-hast` + `hast-util-to-html` (추천, 최소 surface)
- 또는 `unified` + `remark-parse` + `remark-rehype` + `rehype-stringify`

`pnpm -w install` 이후 lockfile 갱신 확인.

### (4) vitest 설정

루트 `vitest.config.ts`가 `packages/core/tests/**/*.test.ts`를 이미 픽업한다면 추가 설정 불필요. `packages/core/tests/integration/` 서브디렉토리도 기본 glob(`**/*.test.ts`)에 걸리도록 확인하고, 걸리지 않으면 include에 추가.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:
- `packages/core/tests/integration/vault-mixed.test.ts`가 존재하고 11개의 독립 assert가 모두 통과.
- `packages/core/src/pipeline.ts`가 존재하고 `index.ts`에서 re-export되거나 직접 import 경로가 열려 있다.
- 기존 unit test (`classify.test.ts`, `linkRewriter.test.ts` 등)는 단 하나도 깨지지 않는다.
- `pnpm-lock.yaml` diff가 추가 의존성만 반영하고 무관한 업데이트를 포함하지 않는다.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 통합 테스트를 **일부러 파괴**해 검증의 현실성을 검사한다 (커밋 전에 수동으로만 수행, 커밋에는 남기지 말 것):
   - 잠깐 `privacy/commentStrip.ts`의 regex를 `/\%\%(?!comment)/`처럼 약화시켜 assert 8이 **실제로 실패하는지** 확인 → 원복.
   - 잠깐 `privacy/linkRewriter.ts`에서 `<a href=... >` 태그 그대로 남기도록 바꿔 assert 3이 실패하는지 확인 → 원복.
   이 "돌연변이 테스트" 수동 체크는 assert 문구가 실제로 방어 가치가 있는지 판단하는 최종 sanity check다. 결과는 `summary`에 한 줄로 기록한다 ("mutation check: strip/rewriter 둘 다 실패 재현 OK").
3. 아키텍처 체크리스트:
   - `pipeline.ts`는 core 하위에 위치하고 Astro/브라우저 심볼을 import하지 않는다.
   - Phase A→C 순서가 ARCHITECTURE.md 데이터 흐름 다이어그램과 일치.
   - 공개 판정 로직(`isPublic`)은 `privacy/classify`만 호출하고 테스트/pipeline에서 재구현하지 않는다 (CLAUDE.md CRITICAL).
4. 결과에 따라 `phases/step2c-core-integration-fixture/index.json`의 이 step을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "runCorePipeline + 11 integration assert 통과 (HTML 직렬화: <선택한 라이브러리>)"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(예: 예기치 못한 unified API 깨짐) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **공개/비공개 판정을 `pipeline.ts`나 테스트에서 재구현하지 마라.** 이유: CLAUDE.md의 "결정은 한 곳" 규칙. 무조건 `privacy/classify`를 호출한다.
- **`pipeline.ts`에서 Astro/remark 전용(remark-parse/remark-rehype 포함) 플러그인의 구동 책임을 지지 마라.** 이유: `@obpub/astro` 쪽 책임 범위. core는 mdast→hast→HTML 단방향 직렬화만 수행한다. (remark-rehype 선택 시에도 unified 파이프라인을 core 내부에서 독립 실행하는 형태로 한정 — Astro 설정 hook 등 touched되어서는 안 됨.)
- **canary 문자열을 pipeline/테스트 코드 내부에 하드코딩하지 마라.** fixture README 또는 fixture 파일 내용에서만 인용해 온다 (예: `await fs.readFile('Private Secret.md')` 한 뒤 assert). 이유: 테스트 코드에 canary를 심으면 canary 0회 검사가 테스트 자체에 양성 반응을 낼 수 있다.
- **fixture 파일을 이 step에서 수정하지 마라.** 이유: step 0 산출물은 고정이어야 fuzz와 통합 테스트가 같은 입력을 공유한다. 누락이 발견되면 즉시 중단하고 `blocked`로 리포트한 뒤 step 0으로 되돌려라.
- 기존 테스트를 깨뜨리지 마라.
