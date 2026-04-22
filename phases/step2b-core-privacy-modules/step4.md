# Step 4: attachment-filter

## 작업

`packages/core/src/privacy/attachmentFilter.ts` + 그 테스트를 **TDD**로 작성한다. 공개 노트 집합에서 **참조된 첨부파일의 closure**를 계산하는 순수 함수. 이후 빌드 파이프라인이 이 closure에 있는 파일만 `dist/`로 복사한다. private-only 첨부는 산출물에 존재하지 않음.

## 읽어야 할 파일

- `packages/core/src/types.ts` — 타입 컨벤션.
- 이전 step: `packages/core/src/privacy/transclude.ts` — 첨부 임베드가 mdast `image` 노드로 변환되는 지점. 즉, 이 step의 입력은 **이미 transclude가 처리된 후의 mdast**(image 노드들이 포함)에서 `url` 값을 수집하거나, 혹은 caller가 사전 수집한 참조 맵.
- `packages/core/src/config.ts` — `publishing.attachments.allowedExtensions`가 이 필터에 적용된다(허용 확장자 밖은 제외).
- plan 파일 Phase C §9 "첨부파일 pruning".

## 공개 인터페이스 (시그니처 고정)

```ts
export interface AttachmentRef {
  /** Attachment의 안정 id (대개 vault-relative path). */
  readonly id: string;
  /** Note id의 vault-relative path. */
  readonly sourceNoteId: string;
}

export interface BuildAttachmentClosureOptions {
  /** 공개로 분류된 노트 id 집합. */
  readonly publicNoteIds: ReadonlySet<string>;
  /** 전체 수집된 참조 (public/private 노트 전부에서). */
  readonly allReferences: readonly AttachmentRef[];
  /** 허용 확장자 (lowercase, dot-prefixed). 매칭은 case-insensitive. */
  readonly allowedExtensions: readonly string[];
}

export interface AttachmentClosure {
  /** 복사 대상 첨부 id 집합. */
  readonly included: ReadonlySet<string>;
  /** 제외 사유가 담긴 진단용 레코드. */
  readonly excluded: readonly ExcludedAttachment[];
}

export type ExcludeReason = 'no-public-referrer' | 'disallowed-extension';

export interface ExcludedAttachment {
  readonly id: string;
  readonly reason: ExcludeReason;
}

export function buildAttachmentClosure(
  options: BuildAttachmentClosureOptions,
): AttachmentClosure;
```

### 규칙

1. 어떤 첨부 id `A`가 **최소 한 개 공개 노트**에서 참조된다면 `included`에 포함(단, 확장자 필터 통과 시).
2. 확장자 필터:
   - 첨부 id에서 확장자 추출(`path.posix.extname`).
   - lowercase 비교.
   - `allowedExtensions`에 없으면 `excluded`로 분류(reason `disallowed-extension`), `included` 에 넣지 않음.
3. 어떤 첨부가 `allReferences`에 여러 번 등장해도 `included`는 **집합**이므로 한 번만 포함.
4. 어떤 첨부가 오직 private 노트에서만 참조되면 `excluded` (`no-public-referrer`).
5. `included`와 `excluded`는 **동일 id가 양쪽에 동시에 있을 수 없음**.
6. `allowedExtensions`가 빈 배열 → 모든 첨부가 `disallowed-extension` (방어적; 실전 config는 기본값이 7개).
7. 확장자가 없는 첨부 id(예: `notes/readme`) → `disallowed-extension` (안전쪽).
8. 대소문자 차이(`.PNG` vs `.png`): 동일 확장자로 취급.

### 출력 순서

- `excluded` 배열은 id 사전순 결정적 정렬.
- `included`는 Set이므로 순서 의미 없음 — 테스트에서는 배열 변환 후 비교.

## 테스트 (TDD)

`packages/core/tests/attachmentFilter.test.ts`에 최소 11 케이스.

1. 빈 참조 → `included = ∅`, `excluded = []`.
2. 공개 노트 1개 + 첨부 `a.png` 참조 + 확장자 허용 → `included = {a.png}`.
3. private 노트만 참조하는 첨부 → `excluded: [{id: 'b.png', reason: 'no-public-referrer'}]`, `included` 빈 집합.
4. 공개 + private이 **둘 다** 참조하는 첨부 → `included`에 포함(공개 쪽 참조가 있으므로).
5. 허용 확장자 밖 첨부(`.exe`) + 공개 참조 → `excluded: [{reason: 'disallowed-extension'}]`, `included` 빈 집합.
6. 확장자 없는 id → `disallowed-extension`.
7. `.PNG` 대문자 확장자 + 허용 목록 `[.png]` → 포함됨(case-insensitive).
8. 동일 첨부 여러 노트에서 참조 → `included`에 1회만.
9. 정책: private-only 참조 + disallowed 확장자 → **두 사유 중 disallowed-extension 우선**(더 보수적 제외 사유). `excluded` 레코드는 1건.
10. `publicNoteIds`가 빈 집합 → 모든 첨부가 `no-public-referrer`(혹은 확장자 실패면 `disallowed-extension` 우선).
11. 출력 determinism: 동일 입력 2회 호출 시 `excluded` 배열 동일 순서.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

새 테스트 11개 통과, 기존 회귀 0건.

## 검증 절차

1. 위 AC 실행.
2. 체크리스트:
   - 파일 위치: `packages/core/src/privacy/attachmentFilter.ts`.
   - 파일 시스템 I/O 없음(`fs` import 0건). 이 모듈은 순수 계산.
   - 확장자 매칭 case-insensitive.
   - `included` 는 `Set<string>`, `excluded` 는 `ExcludedAttachment[]`.
   - `as any` 금지.
3. `phases/step2b-core-privacy-modules/index.json`의 step 4 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "privacy/attachmentFilter.ts + 11 tests + public-referrer closure + extension allowlist + deterministic excluded order"`.
   - 실패/차단 → error/blocked.

## 금지사항

- **파일시스템 검사 금지.** 이유: 이 step은 참조 그래프 기반 순수 필터. 실제 파일 존재/복사는 이후 빌드 단계(astro-integration 또는 CLI build). fs를 섞으면 테스트 격리가 깨지고 watcher에서 race 조건 가능.
- **private 노트의 제목/경로를 `excluded` 레코드에 넣지 마라.** 이유: 진단 로그가 누출 경로가 될 수 있다. `excluded`는 **첨부 id**만 담는다(그 자체는 allowed 확장자의 파일명). 출력 로그도 `sourceNoteId`를 인쇄하지 않도록.
- **첨부 id를 임의로 정규화(lowercase/trim)하지 마라.** 이유: 파일 시스템 실제 이름과 어긋날 수 있다. 확장자만 대소문자 무시하고, id 자체는 그대로 유지.
- **tripwire 경로(`private/**`) 하드코딩 금지.** 이유: 공개 판정은 `classify`가 유일 출처. 이 모듈은 `publicNoteIds` 집합만 신뢰하면 된다.
- **첨부 간 의존성(첨부가 다른 첨부를 참조) 고려하지 마라.** 이유: v0.1 스코프 밖(이미지가 다른 이미지를 포함하는 구조 없음). 미래에 필요하면 별도 step.
- 기존 테스트를 깨뜨리지 마라.
