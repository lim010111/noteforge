# Step 0: frontmatter-filter

## 작업

`packages/core/src/privacy/frontmatterFilter.ts` + 그 테스트를 **TDD**로 작성한다. 사용자의 전체 frontmatter에서 **allowlist에 속한 키만** 남기는 순수 함수. 이 함수의 출력만이 공개 HTML/meta/JSON-LD/OG에 사용되는 유일한 경로다.

## 읽어야 할 파일

- `packages/core/src/types.ts` — `ParsedNote.frontmatter`는 `Readonly<Record<string, unknown>>`.
- `packages/core/src/config.ts` — `publishing.frontmatterAllowlist`가 정규화되는 위치 (기본 14개 항목 + 사용자 추가분 union). 이 step은 그 결과 allowlist를 입력으로 받는다. config를 직접 import하지 않음 — allowlist 배열만 인자로 받음.
- `packages/core/src/privacy/classify.ts`, `packages/core/src/privacy/commentStrip.ts` — 기존 privacy 모듈의 export/스타일 패턴 참고.

## 공개 인터페이스 (시그니처 고정)

```ts
export function filterFrontmatter(
  frontmatter: Readonly<Record<string, unknown>>,
  allowlist: readonly string[],
): Record<string, unknown>;
```

- 반환값은 **새 객체**(입력 불변).
- 반환 객체는 allowlist에 **존재하는** 키만 포함.
- 값은 deep-clone 하지 않고 그대로 참조 복사(객체/배열 값도 그대로). 단, 반환 객체 자체는 `Object.freeze()` 하지 말고 호출자가 자유롭게 쓸 수 있도록 plain object로.
- 키 매칭은 **정확한 문자열 일치**(대소문자 구분). YAML 키는 대소문자 구분이 원칙이므로 `Title`과 `title`은 다름.
- allowlist가 빈 배열이면 결과는 `{}`.
- `frontmatter`에 allowlist 키가 존재하되 값이 `undefined`면 그 키는 결과에서 **제외**(존재하지 않는 것으로 취급). `null` 값은 **유지**(YAML 상 명시적 null은 저자 의도).

## 테스트 (TDD — 실패 테스트 먼저)

`packages/core/tests/frontmatterFilter.test.ts`에 최소 10 케이스.

1. 빈 frontmatter + allowlist `['title']` → `{}`.
2. `{ title: 'A', personalNote: 'secret' }` + allowlist `['title']` → `{ title: 'A' }`. `personalNote` 제외.
3. allowlist 밖 키가 여러 개인 큰 frontmatter → 결과에 allowlist 키만 정확히.
4. 기본 14개 allowlist 전체 테스트 (CLAUDE.md의 14개) — 그 14개 값만 통과, 나머지 전부 탈락.
5. allowlist 빈 배열 → 어떤 frontmatter가 와도 `{}`.
6. 입력 객체가 수정되지 않음(호출 후 원본 frontmatter 키/값 개수 불변).
7. `{ title: null }` + allowlist `['title']` → 결과 `{ title: null }` (명시적 null은 유지).
8. `{ title: undefined }` + allowlist `['title']` → 결과에서 `title` 키 **없음**.
9. 값이 중첩 객체(`{ cover: { src: 'x.png' } }`): allowlist에 있으면 참조 그대로 복사, 구조 보존.
10. 대소문자 차이: `{ Title: 'A', title: 'B' }` + allowlist `['title']` → `{ title: 'B' }`(정확히), `Title`은 탈락.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

세 명령 모두 0으로 종료. 새 테스트 10 케이스 전부 통과. 기존 테스트 회귀 0건.

## 검증 절차

1. 위 AC 직접 실행.
2. 아키텍처 체크리스트:
   - 파일 위치: `packages/core/src/privacy/frontmatterFilter.ts` 정확히.
   - export 이름이 정확히 `filterFrontmatter`.
   - 테마/어댑터/앱에서 자체 frontmatter 필터링 구현 금지(이 모듈만 유일 출처).
   - `as any`/비-Zod 캐스팅 없음.
3. `phases/step2b-core-privacy-modules/index.json`의 step 0 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "privacy/frontmatterFilter.ts + 10 tests + allowlist exact match + null preserved / undefined dropped"`.
   - 3회 시도 후 실패 → `"status": "error"` + `error_message`.
   - 사용자 개입 필요 → `"status": "blocked"` + `blocked_reason`, 즉시 중단.

## 금지사항

- **allowlist 바깥 키를 기본 노출로 남기지 마라.** 이유: privacy-first. 새 필드 추가는 allowlist 명시적 추가가 유일한 경로여야 한다. "그냥 title만 빼고 복사"류 트릭 금지.
- **deep clone 하지 마라.** 이유: 불필요한 오버헤드 + 테스트 플레이키니스. shallow(참조) 복사로 충분. 호출자가 나중에 mutate하지 않는다는 전제는 이 모듈이 보장할 일이 아니다.
- **입력 `frontmatter` 객체를 mutate하지 마라.** 이유: `ParsedNote.frontmatter`는 `Readonly<...>`이고 실제로 `Object.freeze()`되어 있다. mutate 시도는 silent fail 또는 throw를 일으킬 수 있다. 항상 **새 객체**를 만들어라.
- **정규화/소문자 변환 하지 마라.** 이유: YAML 키는 대소문자 구분. `'title'`과 `'Title'`은 서로 다른 키. allowlist는 저자가 명시한 정확한 이름.
- 기존 테스트를 깨뜨리지 마라.
