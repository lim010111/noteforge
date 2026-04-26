# Step 0: alias-redirect-engine

`@noteforge/core`에 alias frontmatter → canonical slug 매핑을 산출하는 순수 함수를 TDD로 추가한다. 이 step은 **core 단독**, pipeline 통합은 step 1.

## 읽어야 할 파일

먼저 다음을 읽고 기존 패턴에 맞춰라:

- `packages/core/src/slug.ts` — `computeSlug` (priority: permalink → slug → derived from path), private `slugifySegment`(`trim → toLowerCase → \s+ → '-' → 양끝 '-' 제거`, **비ASCII 보존**).
- `packages/core/src/types.ts` — `IndexedNote` 타입(`aliases: readonly string[]` 필드 포함).
- `packages/core/src/resolve/wikilink.ts` — `buildWikilinkIndex`(이미 alias→note 매핑을 갖고 있음, l:51–53). 본 step은 이 결과를 다시 쓰진 않고 publishable IndexedNote 배열을 직접 입력으로 받는다.
- `packages/core/tests/` 기존 테스트 스타일(vitest, describe/it, fixture-free 단위 테스트 위주).

## 작업

### 신규 파일: `packages/core/src/aliases/buildAliasMap.ts`

시그니처(엄격히 이 형태):

```ts
export interface AliasRedirect {
  readonly from: string;   // slugified alias (URL path segment, 슬래시 포함 가능)
  readonly to: string;     // 대상 노트의 canonical slug (computeSlug 결과)
  readonly noteId: string; // 대상 IndexedNote.id (디버깅용)
}

export interface AliasMapResult {
  readonly redirects: readonly AliasRedirect[];
  readonly warnings: readonly string[];
}

export function buildAliasRedirects(
  publishable: readonly IndexedNote[],
): AliasMapResult;
```

### 동작 규칙 (반드시 구현)

1. **입력 신뢰** — `publishable`은 호출자가 이미 public-only로 필터한 결과라 가정. private 처리 로직을 이 함수에 넣지 마라(아래 금지사항 참고).
2. **alias normalize** — alias 문자열을 `/` 기준 split → 각 segment에 `slug.ts`의 `slugifySegment` 동일 규칙(`trim`, `toLowerCase`, `\s+ → '-'`, 양끝 `'-'` 제거, **비ASCII 보존**) 적용 → 빈 segment 제거 → `'/'`로 join.
   - 구현 옵션 A(권장): `slug.ts`에서 `slugifySegment`를 export 추가 후 재사용. 이름 충돌 없음.
   - 옵션 B: alias 모듈에 동일 로직 복제 + 짧은 주석으로 두 곳 동기화 의무 표기.
3. **빈 alias 처리** — normalize 결과가 빈 문자열이면 결과에서 제외 + warning 추가(`"empty alias on note '{id}' skipped"`).
4. **충돌 우선순위** (이 순서):
   1. publishable 모든 노트의 canonical slug 집합을 먼저 구축(`computeSlug({ frontmatter, relativePath })` 호출 — 이미 IndexedNote 빌드 시 계산되어 있으면 그 값 재사용 가능).
   2. alias가 **자기 자신의 slug**와 동일 → silent skip (warning 없음).
   3. alias가 **다른 노트의 slug 집합**에 존재 → skip + warning(`"alias '{alias}' on note '{id}' collides with slug of note '{otherId}'"`).
5. **동일 alias 중복** — alias가 이미 다른 noteA에 의해 등록된 경우 noteB의 alias는 skip + warning(`"alias '{alias}' duplicated; first declared by '{noteAId}', ignored on '{noteBId}'"`).
6. **결과 정렬** — `redirects`를 `from` 사전순으로 deterministic 정렬해 반환.
7. **참조 무결성** — `redirects[i].to`는 publishable 노트의 실제 slug여야 한다(자기 노트 slug). `to`는 `computeSlug` 결과 그대로(앞 슬래시 없음).

### TDD 테스트 파일: `packages/core/tests/aliases/buildAliasMap.test.ts`

다음 8 케이스를 **모두 실패하는 테스트로 먼저** 작성한 뒤 구현으로 통과시켜라:

1. 정상 1:1 alias → redirects 길이 1, warnings 길이 0.
2. alias가 다른 노트의 slug와 충돌 → redirects 0건, warnings 1건(메시지에 alias 문자열과 두 noteId 포함).
3. alias가 자기 자신 slug와 일치 → redirects 0건, warnings **0건** (silent).
4. 한국어 alias 보존 — 입력 `옛이름` → `from === '옛이름'` (lowercase가 한글에 영향 없음).
5. 공백 포함 alias — 입력 `Old Name` → `from === 'old-name'`.
6. 슬래시 포함 alias — 입력 `Old/Path Name` → `from === 'old/path-name'`.
7. 동일 alias 두 노트 — 첫 노트 알파벳 순으로(또는 입력 순서) 유지, 두 번째 noteId의 alias는 warning 1건.
8. `aliases` 빈 배열 / 미선언 / 빈 문자열 항목 — redirects 0건, 빈 항목이 있으면 그 건만 warning.

테스트는 fixture 없이 인라인 IndexedNote 객체로 작성한다(빠른 단위 테스트). `IndexedNote` 생성 헬퍼를 테스트 파일 상단에 한 개 두면 가독성 ↑.

### export 추가

- `packages/core/src/index.ts`에 `export { buildAliasRedirects } from './aliases/buildAliasMap';` 및 타입 re-export.
- `slug.ts`에서 `slugifySegment`를 export로 노출했다면 `index.ts`에는 노출하지 않는다(내부 유틸 — 두 모듈만 공유).

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 검증:
- 새 테스트 파일이 vitest 실행 결과에 포함되었는지 출력에서 확인.
- 8 케이스 모두 통과.

## 검증 절차

1. 위 AC 커맨드 실행.
2. 아키텍처 체크리스트:
   - 새 파일 위치가 `packages/core/src/aliases/` 인가? (`packages/core/src/privacy/` 가 아님 — 이건 privacy 결정이 아니라 매핑이므로 별도 디렉토리.)
   - `buildAliasRedirects` 내부에서 private 노트 판정 로직(`isPublic` 등) 호출 0회?
   - `IndexedNote` 외 다른 자료구조 신규 생성 안 함?
3. 결과에 따라 `phases/step8-deploy-prep/index.json`의 step 0를 갱신:
   - 성공 → `"status": "completed"`, `"summary": "alias map 산출 함수 + 8 TDD 테스트 통과"`.
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "..."`.
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "..."`.

## 금지사항

- **private 노트 처리 로직을 이 함수에 넣지 마라.** 이유: privacy 결정은 `packages/core/src/privacy/` 한 곳에 집중해야 한다는 CLAUDE.md CRITICAL 규칙 위반. 이 함수는 publishable 입력을 신뢰한다.
- **`buildWikilinkIndex`의 alias 인덱스를 재사용하지 마라.** 이유: wikilink 해석용과 redirect 생성용은 의미가 다르다(전자는 path/basename/alias 다단계 매칭, 후자는 alias→canonical 1:1). 결합하면 향후 wikilink 우선순위 변경 시 redirect도 깨진다.
- **`from`에 leading slash를 포함하지 마라.** 이유: `to`도 leading slash 없으므로 일관 유지. 라우트 prefix는 호출자(Astro 라우트)가 책임.
- **alias 결과를 노트별 props에 인라인으로 붙이지 마라.** 이유: alias는 vault 전역 결과이므로 단일 평면 배열로 반환. 노트 단위 결합은 step 1의 pipeline 책임.
- 기존 테스트를 깨뜨리지 마라.
