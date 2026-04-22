# Step 2: property-based-fuzz

## 목표
Step 1에서 구축한 `runCorePipeline` helper를 임의의 **작은 vault 형상**에 50회 적용해, 플랜이 요구하는 privacy 불변식이 케이스를 가리지 않고 유지되는지 확인한다. 고정 fixture는 사람이 생각한 경로만 커버하므로, property-based testing이 조합 공간을 넓혀 회귀 보험 역할을 한다.

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `/docs/ARCHITECTURE.md` — 파이프라인 순서
- `/docs/ADR.md` — ADR-002 opt-in, ADR-004 strip-to-text, ADR-006 allowlist
- `/home/shine/.claude/plans/public-fizzy-patterson.md`의 **"Property-based fuzz"** 섹션
- Step 1 산출물: `packages/core/src/pipeline.ts` + `packages/core/tests/integration/vault-mixed.test.ts`
- `packages/core/tests/fixtures/vault-mixed/README.md` — canary 문자열 참고

## 작업

### (1) 의존성 추가
`packages/core/package.json`의 `devDependencies`에 `fast-check@^3`를 추가한다(이미 있으면 스킵). `pnpm install` 후 lockfile 갱신.

### (2) 새 테스트 파일

경로: `packages/core/tests/integration/vault-fuzz.test.ts`

아래 property를 **단일 Vitest `it`** 안에서 `fast-check`의 `fc.assert(fc.property(...), { numRuns: 50, seed: <고정 seed>, verbose: true })`로 실행한다. 고정 seed를 넣어서 재현 가능성을 확보하라.

#### 임의 vault 생성기
`fc.record(...)` 혹은 사용자 정의 arbitrary로 다음을 생성:
- 노트 개수 `n ∈ [3, 10]`.
- 각 노트 `i` (인덱스 0..n-1)에 대해:
  - `title`: `Note_${i}` (결정적, 정렬/충돌 이슈 제거).
  - `slug`: `note-${i}`.
  - `isPublicFlag`: `boolean` (fc.boolean).
  - `body`: private canary 문자열 `FUZZ_PRIVATE_CANARY_${i}` + 뒤에 랜덤 3개의 다른 노트를 `[[Note_j]]` 링크로 포함 (중복 OK, 자기 참조 허용).
  - `embedTarget`: 50% 확률로 랜덤 다른 노트 인덱스를 `![[Note_j]]`로 포함.
- 공개 여부 표시는 frontmatter `public: true` 방식으로 통일(태그 경로는 unit test에서 이미 커버).

각 property run마다 `node:fs`의 `mkdtemp` + `os.tmpdir()`로 임시 vault 디렉토리를 만들고 노트 파일을 쓴 뒤 `runCorePipeline(config)` 호출. 종료 시 디렉토리 정리(finally 블록).

#### 불변식 (property들 — 모두 동시 성립해야 한다)

1. **Classify 일관성**: `publicSlugs` 집합이 생성기 입력의 `isPublicFlag === true`인 노트의 슬러그 집합과 정확히 일치.
2. **Private 본문 누수 없음**: 모든 공개 렌더 HTML을 concat한 결과에 "private" 입력 노트들의 canary(`FUZZ_PRIVATE_CANARY_${i}` for i where `isPublicFlag === false`)가 단 하나도 등장하지 않는다.
3. **Private 제목 링크 누수 없음**: private 노트 제목 `Note_${i}`가 어떤 공개 렌더 HTML의 `<a ...>` 태그 속성(href, title, data-*)에도 나타나지 않는다. (본문 텍스트에 "Note_5" 같은 단어가 남을 수는 있으나 — strip-to-text 결과 — `<a>` 속성에만 없으면 된다. 정규식: `/<a\s[^>]*(?:href|title|data-[a-z-]+)\s*=\s*["'][^"']*Note_\d+/i`로 매치되는 private 제목이 0개.)
4. **공개 엣지만 남음**: `publicGraph.edges`의 모든 `(from, to)`에서 `from ∈ publicSlugs` 및 `to ∈ publicSlugs`.
5. **Embed 경계**: private target을 임베드한 공개 노트의 렌더 HTML에 해당 private canary가 0회 등장. public→public 임베드만 본문 확장을 허용.

`fc.assert` 실패 시 fast-check는 자동으로 minimal counterexample을 보고한다. 실패 재현을 위해 seed와 counterexample이 stdout에 기록되는지 확인.

### (3) 성능 가드
50회 run × 노트 10개 × 파이프라인 전체 = 완료 시간이 로컬에서 **10초 이내**여야 한다. 초과 시:
- 임시 디렉토리 생성 개수 줄이기 (예: `beforeAll`에서 베이스 디렉토리 1개 + property마다 서브디렉토리).
- fast-check 설정에 `numRuns`는 절대 50 미만으로 내리지 말 것(플랜이 못박은 수치).
- 타임아웃이 정말 문제면 Vitest `testTimeout: 30000` 상향은 허용.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가 조건:
- `packages/core/tests/integration/vault-fuzz.test.ts`가 `numRuns: 50`으로 실행되고 통과.
- 고정 seed를 사용(예: `seed: 424242`) — 재현 가능해야 한다.
- fast-check가 `devDependencies`에만 추가(런타임 번들에 포함되면 안 됨).
- 기존 단위/통합 테스트가 모두 초록.

## 검증 절차

1. 위 AC 커맨드 실행.
2. **불변식 실제 깨짐 재현 확인** (수동, 커밋하지 말 것):
   - 일시적으로 `privacy/linkRewriter.ts`의 private 가지에서 href를 그대로 둔 채 커밋하면 property 3이 깨져야 한다. 이후 원복.
   - 일시적으로 `privacy/transclude.ts`에서 private 타겟을 stripping 대신 wrap으로 남기면 property 2가 깨져야 한다. 이후 원복.
   결과는 `summary`에 "fuzz mutation check OK" 한 줄로 기록.
3. 아키텍처 체크리스트:
   - 임시 디렉토리는 테스트 종료 시 확실히 삭제(`afterEach` 또는 `finally`).
   - `runCorePipeline`을 재구현하지 않고 step 1의 helper를 그대로 호출.
   - fast-check arbitrary는 한 파일(`vault-fuzz.test.ts`) 안에서 정의 — 공유 helper 파일을 굳이 만들지 말 것(scope 최소화).
4. 결과에 따라 `phases/step2c-core-integration-fixture/index.json`의 이 step을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "fast-check 50 runs 통과 (seed 고정), 5 불변식 + mutation check OK"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`numRuns`를 50 미만으로 낮추지 마라.** 이유: 플랜의 회귀 보험 수치. 느려도 50회를 지킨다.
- **무작위 seed를 사용하지 마라.** 이유: CI 재현성이 깨진다. 고정 seed를 쓰고, 실패가 나면 그 counterexample을 **별도의 회귀 테스트**로 fixture화하는 순서로 대응한다(이 step에서는 회귀 케이스가 나오면 중단하고 보고하라).
- **runCorePipeline이나 core 모듈의 내부 구현을 이 step에서 바꾸지 마라.** 이유: fuzz는 기존 파이프라인의 "블랙박스 검증"이어야 의미가 있다. 버그가 드러나면 해당 버그를 먼저 fixture화하고, 수정은 별도 step/branch로 분리한다.
- **테스트 코드에 private canary 문자열을 하드코딩하지 마라.** 생성기에서 `FUZZ_PRIVATE_CANARY_${i}` 형태로만 주입하고, 검증 시에도 생성기가 뱉은 리스트를 순회해서 검사한다. 이유: 고정 canary를 넣으면 그 문자열이 테스트 파일 자체에 나타나 false positive 위험.
- 기존 테스트를 깨뜨리지 마라.
