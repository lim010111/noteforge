# Step 0: fixture-vault-mixed

## 목표
`packages/core/tests/fixtures/vault-mixed/` 경로에 privacy 파이프라인의 모든 누출 경로를 검증할 수 있는 **고정된** 모의 vault를 구축한다. 이후 step 1(통합 테스트)과 step 2(fuzz)가 이 fixture에 의존한다.

이 step은 파일 생성만 수행한다. 테스트 코드(`*.test.ts`)는 작성하지 않는다 (다음 step의 몫).

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `/docs/ARCHITECTURE.md` — Phase A→D 파이프라인
- `/docs/PRD.md` — canary 검증 절차
- `/docs/ADR.md` — ADR-002 opt-in, ADR-004 strip-to-text, ADR-005 comment strip, ADR-006 frontmatter allowlist
- `/packages/core/src/privacy/classify.ts` — 공개 판정 규칙 (tripwire 포함)
- `/packages/core/src/privacy/commentStrip.ts` — `%%...%%` 제거 대상 포맷
- `/packages/core/src/resolve/wikilink.ts` — wikilink/alias 해석 규칙

## 작업

`packages/core/tests/fixtures/vault-mixed/` 디렉토리를 새로 만들고 아래 **11개 파일**을 정확한 내용으로 생성한다. 각 파일의 frontmatter/본문은 "plan의 11 assert를 만족시키기 위한 최소 형태"로 작성한다. 본문에는 각 노트가 어떤 assert를 겨냥하는지 설명하는 내부 주석을 넣지 말라(그러면 그 주석 자체가 canary 검사를 오염시킨다). 필요한 설명은 `packages/core/tests/fixtures/vault-mixed/README.md`에 별도로 적는다.

### 파일 매니페스트

| 경로 | public? | 요지 |
|---|---|---|
| `public-note.md` | yes (`public: true`) | 본문에서 `[[Private Secret]]`, `[[Another Public]]` 두 링크 사용 |
| `another-public.md` | yes (`#public` 태그) | frontmatter `aliases: [구이름]` 포함. 본문에 짧은 public 텍스트 |
| `Private Secret.md` | **no** (공개 마커 없음) | 본문에 canary `DO_NOT_LEAK_BANANA_6f3c1` 포함. 제목 문자열 "Private Secret" 자체도 누출 감지 대상 |
| `private/family-photos.md` | **no** (tripwire) | frontmatter `public: true`지만 `private/` 하위이므로 강제 private. `unsafeAllowPrivateFolder` 없이 미발행 |
| `public-with-image.md` | yes | `![[only-public.png]]`와 `![[only-private.png]]` 두 첨부 임베드 |
| `public-with-embed.md` | yes | `![[Another Public]]` (public 임베드 — 본문 확장), `![[Private Secret]]` (private 임베드 — 완전 제거) |
| `public-with-comment.md` | yes | 본문에 인라인 `%%비공개 canary CLAUDE_COMMENT_LEAK_77b%%` 및 블록 `%%\n블록 코멘트 canary CLAUDE_COMMENT_LEAK_77b\n%%` 둘 다 포함 |
| `public-with-extra-fm.md` | yes | frontmatter에 allowlist 밖 필드 `review-date: 2026-01-01`, `personal-note: "do not ship"`, `mood: "anxious"` 포함 |
| `public-with-secret-tag.md` | yes | `tags: [public, client/acme-secret, public/internal]` — blocklist(`client/**`)로 걸러져야 함 |
| `only-public.png` | — | 공개 노트 첨부. 1x1 투명 PNG 바이너리 또는 8바이트 미만의 최소 placeholder |
| `only-private.png` | — | 어떤 공개 노트도 참조하지 않음. closure 결과에 포함되지 않아야 함 |

### 파일별 내용 명세

**`public-note.md`**
```markdown
---
title: Public Note
public: true
date: 2026-01-10
---

이 노트는 [[Another Public]]과 [[Private Secret]]을 동시에 언급한다.
```

**`another-public.md`**
```markdown
---
title: Another Public
tags: [public]
aliases: [구이름]
date: 2026-01-12
---

또 다른 공개 노트. 본문은 평범한 산문이면 된다.
```

**`Private Secret.md`** (파일명의 공백 주의 — Obsidian 실제 관행)
```markdown
---
title: Private Secret
date: 2026-01-05
---

이 노트는 절대 공개되면 안 된다. canary: DO_NOT_LEAK_BANANA_6f3c1.
```

**`private/family-photos.md`**
```markdown
---
title: Family Photos
public: true
---

private/ 하위이므로 tripwire 발동. 이 canary는 보너스 검증용이 아니지만, 본문에 어떤 식별 가능한 문자열도 넣지 말라.
```
(본문은 위의 1-2문장만. "canary"라는 단어는 사용해도 되지만 누출 감지용 캐나리 문자열을 심지 말라 — tripwire 자체를 확인할 뿐이다.)

**`public-with-image.md`**
```markdown
---
title: Public With Image
public: true
---

![[only-public.png]]
![[only-private.png]]
```

**`public-with-embed.md`**
```markdown
---
title: Public With Embed
public: true
---

아래는 public 임베드:

![[Another Public]]

아래는 private 임베드 (완전 제거되어야 함):

![[Private Secret]]
```

**`public-with-comment.md`**
```markdown
---
title: Public With Comment
public: true
---

본문 앞 문장. %%비공개 canary CLAUDE_COMMENT_LEAK_77b%% 본문 뒷 문장.

%%
블록 코멘트 canary CLAUDE_COMMENT_LEAK_77b
%%

그 이후 본문.
```

**`public-with-extra-fm.md`**
```markdown
---
title: Public With Extra FM
public: true
date: 2026-02-01
review-date: 2026-03-15
personal-note: "do not ship"
mood: "anxious"
---

본문 한 줄이면 된다.
```

**`public-with-secret-tag.md`**
```markdown
---
title: Public With Secret Tag
public: true
tags: [public, client/acme-secret, public/internal]
---

본문 한 줄.
```

### 첨부 바이너리

`only-public.png`, `only-private.png`는 실제 이미지일 필요 없음. 가장 작은 유효 PNG(예: [tiny-png 8-byte transparent](https://en.wikipedia.org/wiki/Portable_Network_Graphics))도 좋지만 여기서는 내용보다 "파일 존재 + 경로로 매칭되는가"가 중요. 단, 확장자가 `.png`여야 attachment 정책에 걸린다. Node의 `Buffer.from(...)`로 생성해도 되고, 정말 작은 바이너리를 커밋해도 된다. **중요**: 두 PNG의 바이너리 내용은 서로 달라야 한다(후속 테스트에서 해시 충돌 케이스와 혼동 방지).

### README

`packages/core/tests/fixtures/vault-mixed/README.md`를 만들고 다음 내용을 기록한다:
- 이 디렉토리의 목적 (통합/fuzz 테스트용 고정 vault)
- 파일 11개 매니페스트 테이블(위와 동일)
- canary 문자열 목록: `DO_NOT_LEAK_BANANA_6f3c1`, `CLAUDE_COMMENT_LEAK_77b`
- "이 파일들은 테스트 산출물이므로 의도 없이 수정하지 말 것" 경고

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

추가로, 아래가 로컬에서 모두 성립해야 한다:
- `packages/core/tests/fixtures/vault-mixed/` 디렉토리에 정확히 11개 파일 + `README.md` 존재
- `packages/core/tests/fixtures/vault-mixed/private/` 서브디렉토리 1개(`family-photos.md` 포함)
- `public-with-comment.md`의 본문에 `%%` 시퀀스가 원문 그대로 남아 있어야 함 (다음 step에서 스트리핑을 검증하기 위해)
- `another-public.md`의 frontmatter에 `aliases: [구이름]`이 YAML 시퀀스로 정상 파싱되는지 gray-matter CLI 또는 수동 로드로 확인
- 새로 추가된 `.md`/`.png` 파일들은 `packages/core/package.json`의 exports나 빌드 산출물에 포함되지 않아야 함 (테스트 전용)

## 검증 절차

1. 위 AC 커맨드 실행 — 기존 테스트가 깨지지 않는지 확인.
2. 파일 매니페스트 체크리스트:
   - 11개 `.md`/`.png` 파일 + `README.md` 존재.
   - canary 문자열이 지정된 파일에만 등장하고 다른 파일에는 섞이지 않음 (`grep -r "DO_NOT_LEAK_BANANA_6f3c1" packages/core/tests/fixtures/vault-mixed/`로 확인 — `Private Secret.md` 단 한 곳만 매치되어야 함).
   - `CLAUDE_COMMENT_LEAK_77b`는 `public-with-comment.md`에서 인라인 1회 + 블록 1회 = 총 2회 매치.
3. 아키텍처 체크리스트:
   - fixture 경로는 `packages/core/tests/fixtures/vault-mixed/` 하나로 한정 (다른 패키지에 흩뿌리지 말 것).
   - fixture 내부에 TypeScript 코드나 헬퍼 금지. 순수 Markdown + PNG + README만.
4. 결과에 따라 `phases/step2c-core-integration-fixture/index.json`의 이 step을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "vault-mixed fixture: 9 md + 2 png + README, canary 배치 OK"`
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **fixture 파일을 `packages/core/src/` 하위에 두지 마라.** 이유: 빌드/공개 산출물에 테스트 canary가 섞여 들어갈 수 있다. 반드시 `packages/core/tests/fixtures/` 아래.
- **파일에 주석/설명 삽입 금지.** 이유: canary 0회 assert가 깨진다. 설명은 `README.md`에만.
- **tripwire 파일(`private/family-photos.md`)에 canary를 심지 마라.** 이유: tripwire가 제대로 작동해도 canary가 누출되지 않으면 의미 있는 assert를 만들 수 없다. tripwire는 "공개 슬러그 집합에 없음"으로 별도 검증한다.
- **실제 프로덕션 경로(`packages/*/src/**`)에 있는 코드를 수정하지 마라.** 이 step은 순수 fixture 추가.
- 기존 테스트를 깨뜨리지 마라.
