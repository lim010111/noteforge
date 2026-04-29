# Step 2: tokens-and-config-extension

## 읽어야 할 파일

먼저 아래를 읽고 설계 의도를 파악하라:
- `phases/step10-v03-sidebar-redesign/design/TOKENS.md` (v0.3 토큰 delta SSOT)
- `phases/step10-v03-sidebar-redesign/design/ANTIPATTERNS.md` (palette 한계선)
- `packages/theme-default/src/styles/tokens.css` (v0.2 토큰 — 라이트 `:root` + 다크 `[data-theme="dark"]`/`prefers-color-scheme: dark` 패턴)
- `packages/theme-default/src/styles/base.css`, `components.css`
- `packages/core/src/config.ts` (특히 46~50줄의 `siteSchema`: `title`, `url`, `author` 3필드)
- `packages/core/tests/config.test.ts` (또는 동등한 config 테스트 파일 — 새 테스트가 들어갈 곳)
- `apps/blog/obsidian-blog.config.ts` (사용자가 site 설정을 적는 위치)
- `docs/UI_GUIDE.md` (v0.3 — step 1에서 갱신됨, 토큰 의미 SSOT 일치 검증용)

## 작업

### 1. `tokens.css` v0.3 delta 적용

`tokens.css`는 **4개 cascade block**으로 구성되어 있다(파일 상단 주석 참조):

| # | 블록 | 라인 | 용도 |
|---|---|---|---|
| 1 | `@theme { … }` | 23 | Tailwind v4 utility 노출 + light defaults (mode-independent) |
| 2 | `:root[data-theme="light"] { … }` | 141 | 사용자가 라이트로 *명시 토글* (OS 무시) |
| 3 | `:root[data-theme="dark"] { … }` | 165 | 사용자가 다크로 *명시 토글* (OS 무시) |
| 4 | `@media (prefers-color-scheme: dark) :root:not([data-theme="light"]) { … }` | 192 | 토글 미설정 + OS 다크 |

v0.3 새 토큰은 **이 4 블록 모두에 미러링**해야 한다. 라이트(1, 2)는 같은 값, 다크(3, 4)는 같은 값이지만 *블록 자체가 누락되면* 라이트 pin 토글 또는 OS-pref dark 모드에서 변수 unset → CSS variable 폴백/회귀 시각 문제 발생. v0.2 토큰들이 모두 4 블록에 미러링되어 있는 패턴을 그대로 따른다.

v0.2 토큰을 그대로 두고 *추가만* 한다:

1. **보조 accent 1개** — `--color-accent-secondary`, `--color-accent-secondary-hover`. warm 계열만(보라/인디고/네온 금지). 본문 대비 ≥ 4.5:1 (라이트/다크 둘 다). **4 블록 모두**에 정의.
2. **카테고리 accent 슬롯** — `--color-accent-cat-1` … `-N` (N은 design/TOKENS.md 결정 — 4~6). 의미 중립. **4 블록 모두**.
3. **새 surface tier 1개** — `--color-bg-sidebar` (또는 design/TOKENS.md 결정명). `--color-bg-page`와 `--color-bg-surface` 사이의 단차. **4 블록 모두**.

기존 v0.2 토큰명/값은 한 줄도 바꾸지 않는다(이름 변경은 fork 사용자 breaking change).

**N (slotCount) SSOT**: design/TOKENS.md에서 N을 결정 후, 코드 SSOT는 step 4의 `packages/theme-default/src/lib/categoryAccent.ts`에 `export const CATEGORY_ACCENT_SLOT_COUNT = N`로 둠(step 4 책임). step 8의 `sidebarPayload.ts`는 그 상수를 import — 본 step에서는 `tokens.css`의 N과 design/TOKENS.md의 N이 일치하는지 sanity grep만 검증.

### 2. `siteSchema` 확장

`packages/core/src/config.ts:46`의 `siteSchema`에 두 필드 추가:

```ts
const siteSchema = z.object({
  title: z.string().min(1, '빈 문자열은 허용되지 않습니다'),
  url: z.string().url('유효한 URL이어야 합니다'),
  author: z.string().min(1, '빈 문자열은 허용되지 않습니다'),
  // v0.3 추가
  avatar: z
    .string()
    .min(1, '빈 문자열은 허용되지 않습니다')
    .refine(
      (v) => !/^(https?:\/\/|\/\/|data:)/i.test(v),
      'avatar는 외부 호스트(http/https/scheme-less //, data:)를 허용하지 않습니다 — apps/blog/public/ 아래 상대 경로로 두세요',
    )
    .optional(),
  nickname: z.string().min(1, '빈 문자열은 허용되지 않습니다').optional(),
});
```

자산 컨벤션(코드 변경 없이 README/UI_GUIDE에서 권고): `apps/blog/public/avatar.{png,jpg,webp,svg}`.

### 3. 테스트

#### 3-1. `packages/core/tests/config.test.ts` 신규 케이스 (TDD — 실패 → 통과)

다음 케이스를 추가:
- `avatar`가 `https://cdn.example.com/me.png` → reject (4가지 외부 호스트 prefix 중 https)
- `avatar`가 `http://example.com/me.png` → reject
- `avatar`가 `//cdn.example.com/me.png` → reject (scheme-relative)
- `avatar`가 `data:image/png;base64,iVBOR...` → reject
- `avatar`가 빈 문자열 `""` → reject (`min(1)`)
- `nickname`이 빈 문자열 `""` → reject
- `avatar`가 `avatar.png` → accept
- `avatar`가 `assets/me.webp` → accept
- `avatar`/`nickname` 미정의 → accept (둘 다 optional)

이 9 케이스 모두 테스트로 작성. 시그니처는 기존 `parseConfig` / `defineConfig` 호출 패턴을 따른다.

#### 3-2. tokens 존재 회귀 테스트

`packages/theme-default/tests/`에 기존 토큰 회귀 가드가 있다면 같은 파일에, 없다면 `packages/theme-default/tests/tokens.test.ts`(혹은 동등 위치)를 신규 작성:

- `tokens.css` 파일을 읽어 다음 변수가 **4개 cascade block 모두**에 정의되어 있는지 검증(`@theme`, `:root[data-theme="light"]`, `:root[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`):
  - `--color-accent-secondary`
  - `--color-accent-secondary-hover`
  - `--color-accent-cat-1`..`-N` (N개 모두 — 한 슬롯 누락도 unset 시각 회귀)
  - 새 surface tier 변수 1개
- 검증 방법: 각 변수에 대해 `tokens.css` 전체를 읽어 occurrence 횟수가 ≥ 4인지 확인. 단순 grep `grep -c '\-\-color\-accent\-secondary' tokens.css` ≥ 4. (정확히 4가 아니어도 좋다 — 다크/라이트 hover state에서 색상 변동이 있는 경우 같은 줄에 한 번만 들어가지만, *블록 단위*로는 4 블록 모두 등장.)
- v0.2 ANTIPATTERNS 회귀 가드가 있다면(보라/인디고 hex 금지 등), 새 토큰들도 그 가드에 걸리지 않는지 확인.

### 4. `apps/blog/obsidian-blog.config.ts`는 이번 step에서 *건드리지 않는다*

이유: 사용자(fork 사용자) 측 config 파일에 `avatar`/`nickname`을 자동으로 박으면 그게 *오리진 vault 노출*이 된다. 사용자가 README의 안내(step 10)에 따라 본인이 추가하도록 둔다. 다만 schema/타입은 이 step에서 준비되어 있어 config에 넣자마자 동작.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test

# 신규 토큰이 4 cascade block 모두에 미러링됨
# (@theme + [data-theme="light"] + [data-theme="dark"] + prefers-color-scheme:dark)
grep -c '\-\-color\-accent\-secondary' packages/theme-default/src/styles/tokens.css   # ≥ 4
grep -c '\-\-color\-accent\-cat\-1'     packages/theme-default/src/styles/tokens.css   # ≥ 4

# v0.2 토큰 보존 (회귀 가드 — 본 step에서 변경 0)
grep -c '\-\-color\-text\-link' packages/theme-default/src/styles/tokens.css | { read N; [ "$N" -ge 4 ] || exit 1; }
```

## 검증 절차

1. 위 AC 커맨드 실행 — 모든 명령이 통과해야 함.
2. CRITICAL 규칙 점검:
   - `siteSchema` 확장으로 외부 호스트 avatar가 4가지 패턴 모두에서 차단되는가?
   - 신규 토큰이 라이트/다크 양쪽에 정의되었는가?
   - v0.2 토큰명/값 한 줄도 변경되지 않았는가?
   - ANTIPATTERNS 위반(보라/인디고/네온 hex)이 새 토큰에 들어가지 않았는가?
   - privacy 파일(`packages/core/src/privacy/**`)을 건드리지 않았는가?
3. canary 회귀: `pnpm --filter blog build` 후 `grep -rc 'DO_NOT_LEAK_BANANA_6f3c1\|CLAUDE_COMMENT_LEAK_77b' apps/blog/dist/` == 0.
4. 결과에 따라 `phases/step10-v03-sidebar-redesign/index.json`의 step 2를 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "tokens.css에 보조 accent + N개 카테고리 accent + 새 surface tier(라이트/다크 양쪽) + siteSchema에 avatar/nickname 추가(외부 호스트 4패턴 차단), config 9 케이스 + tokens 회귀 가드 통과"`
   - 실패 → `"status": "error"`, `"error_message": "<구체적>"`
   - 차단 → `"status": "blocked"`, `"blocked_reason": "<구체적>"`

## 금지사항

- v0.2 토큰명을 변경하거나 hex 값을 수정하지 마라. 이유: fork 사용자 breaking change. v0.3는 *추가*만.
- `avatar` 외부 호스트(http/https/// /data:) 차단을 빠뜨리지 마라. 이유: privacy-first 계약상 외부 자산 로드는 referrer/캐시 누설 경로다 — schema가 첫 방어선.
- `apps/blog/obsidian-blog.config.ts`에 실제 avatar/nickname 값을 박지 마라. 이유: 그 파일은 dogfood 사용자(본인 vault)의 config이고, 자동 주입은 시각 누설로 이어진다 — README 안내(step 10)로 사용자 본인이 입력.
- 보라/인디고/네온/`#hex` of glow 색을 새 토큰에 사용하지 마라. 이유: ANTIPATTERNS.md 금지선. warm 계열만 허용.
- `packages/core/src/privacy/**`을 수정하지 마라. 이유: privacy 계약 잠금. v0.3 어떤 step도 privacy 코드 변경 금지.
- 기존 테스트를 깨뜨리지 마라.
