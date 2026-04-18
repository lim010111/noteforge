# Step 1: parse-note

## 작업

`packages/core/src/discover/parseNote.ts` + 그 테스트를 **TDD**로 작성한다. 파일 내용 + 경로 메타를 받아 `ParsedNote`를 반환하는 end-to-end 파서. 코멘트 스트리핑 → frontmatter parse → tag 정규화를 단일 함수에서 묶는다.

## 읽어야 할 파일

- `packages/core/src/types.ts` — `ParsedNote` 타입 형태에 정확히 맞춰라. 필드 순서/이름 변경 금지.
- `packages/core/src/privacy/commentStrip.ts` — `stripObsidianComments(markdown: string): string`. 이 함수를 호출하라. 재구현 금지.
- `packages/core/src/tags.ts` — `normalizeTags(frontmatterTags: unknown, body: string): Tag[]`. 그대로 호출.
- `packages/core/tests/commentStrip.test.ts`, `packages/core/tests/tags.test.ts` — 동일 스타일/단언 패턴 참고.
- `packages/core/package.json` — `gray-matter ^4.0.3` deps에 있음.

(이 step은 step 0에서 만든 `config.ts`를 직접 import하지 않는다. parser는 config에 무관하게 동작.)

## 공개 인터페이스

```ts
import type { ParsedNote } from '../types.ts';

export interface ParseNoteInput {
  readonly path: string;          // absolute filesystem path
  readonly vaultId: string;
  readonly relativePath: string;  // POSIX, no leading slash
  readonly content: string;       // raw UTF-8 content (BOM 가능)
}

export function parseNote(input: ParseNoteInput): ParsedNote;
```

I/O를 하지 않는다. caller가 `fs.readFile` 후 content를 넘긴다. (테스트 격리를 위해.)

## 파이프라인 (순서 엄수)

1. **BOM strip** — 입력 `content`가 `\uFEFF`로 시작하면 제거.
2. **`%%...%%` 코멘트 강제 제거** — `stripObsidianComments(content)` 적용. 이후 단계는 코멘트 없는 문자열만 본다(이게 CRITICAL: %% 누출 차단의 단일 출처).
3. **frontmatter 파싱** — `gray-matter(stripped)`. 결과의 `data`는 `Record<string, unknown>`로 치환(`Readonly`로 freeze 권장), `content`는 `body` 후보.
4. **YAML 파싱 실패 fallback** — gray-matter가 throw하면 catch하여 `frontmatter: {}`, `body: <코멘트 제거된 원본 전체>` 로 폴백 + `console.warn`(메시지에 `input.relativePath` 포함). throw 금지.
5. **tag 정규화** — `normalizeTags(frontmatter.tags, body)` 호출. 결과를 `tags`에.
6. **`ParsedNote` 구성** — `path`, `vaultId`, `relativePath`, `frontmatter`, `tags`, `body` 모두 채움. `Object.freeze` 또는 `as const` 활용해 readonly 계약 보존.

**이 단계에서 frontmatter allowlist 필터링을 적용하지 않는다.** raw frontmatter를 그대로 보존하고, 공개 단계에서 별도 모듈(다음 phase의 `frontmatterFilter`)이 필터한다.

## 테스트 (TDD)

`packages/core/tests/parseNote.test.ts`에 최소 11 케이스.

1. frontmatter 없음 + 본문만 → `frontmatter: {}`, `tags: []`, `body === content`.
2. `---\npublic: true\n---\nbody` → `frontmatter.public === true`, `body === 'body'` (또는 trim 정책에 맞게).
3. 본문에 `%%비밀%%` 포함 → `body`에 `%%` 문자가 0회.
4. 캐너리 테스트: `%%CLAUDE_COMMENT_LEAK_77b%%` → `body`에 `'CLAUDE_COMMENT_LEAK_77b'` 0회.
5. frontmatter `tags: [foo, BAR]` + 본문 `#baz` → `tags === ['foo', 'bar', 'baz']` (lowercase, frontmatter 우선 순서).
6. code fence 안의 `#fake` → `tags`에 미포함 (tags.ts 위임 smoke check).
7. UTF-8 BOM(`\uFEFF`)으로 시작하는 입력 → frontmatter 정상 감지.
8. malformed YAML (예: `---\ntitle: "unterminated\n---\n본문`) → throw 없이 `frontmatter: {}`, `body`는 코멘트 제거된 원본 전체 반환. `console.warn` 호출 사실을 spy로 검증, 메시지에 `relativePath` 포함.
9. 한국어 frontmatter 값 (`title: 안녕하세요`) → 그대로 보존.
10. frontmatter `tags: "a, b, c"` (comma string) → `tags === ['a', 'b', 'c']`.
11. `frontmatter` 결과는 변경 불가능(readonly): `(result.frontmatter as any).foo = 1` 후 다시 읽어도 변경 없음 — 또는 `Object.isFrozen(result.frontmatter)` true.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

새 테스트 11개 모두 통과 + 기존 테스트 회귀 0건.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - **CRITICAL**: 어떤 테스트 출력의 `body`에도 `%%` 문자열이 등장하지 않는다 (canary 회귀 방지).
   - `parseNote`는 fs를 호출하지 않는다(`fs`/`node:fs` import 0건).
   - `frontmatterFilter` 같은 allowlist 필터를 이 함수에서 호출하지 않는다(다음 phase 책임).
   - gray-matter throw가 fallback으로 흡수됨이 테스트로 증명됨.
3. `phases/step2a-core-config-discover/index.json`의 step 1을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "discover/parseNote.ts + 11 tests + BOM/%% strip/malformed YAML fallback/readonly frontmatter"`
   - 실패/차단 → error/blocked 기록.

## 금지사항

- **`%%` 주석 스트리핑 로직을 재구현하지 마라.** 이유: 단일 출처. 두 번 구현하면 한쪽만 패치되어 누출 회귀.
- **태그 정규화 로직을 재구현하지 마라.** 이유: `tags.ts`가 code fence 예외까지 처리. 중복 구현은 불일치 버그.
- **frontmatter allowlist 필터링을 이 step에서 적용하지 마라.** 이유: 이 레이어는 "충실한 파싱". 필터는 render 파이프라인 책임.
- **malformed YAML에서 throw하지 마라.** 이유: 한 파일 오류로 전체 빌드를 죽이면 저자 UX가 무너진다. warn + 안전한 default.
- **fs를 호출하지 마라.** 이유: 테스트 격리 + 멱등성. caller가 readFile 후 content를 주입.
- 기존 테스트를 깨뜨리지 마라.
