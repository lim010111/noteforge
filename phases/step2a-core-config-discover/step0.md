# Step 0: config-schema

## 작업

`packages/core/src/config.ts` + 그 테스트를 **TDD**로 작성한다. `defineConfig()`가 사용자 input을 Zod로 검증하고 정규화된 `ObpubConfig`를 반환하며, 다른 모듈이 쓸 어댑터(`getClassifyRule`)도 함께 제공한다.

## 읽어야 할 파일

- `packages/core/src/types.ts` — 기존 타입(`ParsedNote`, `ClassifyRule`, `Classification`). 새 타입이 이들과 모순되지 않도록.
- `packages/core/src/privacy/classify.ts` — `ClassifyRule`의 실제 사용처. config가 어떤 모양으로 `tripwirePaths`/`frontmatterKey`/`publicTag`/`unsafeAllowPrivateFolder`를 제공해야 하는지 참고.
- `packages/core/src/tags.ts`, `packages/core/src/slug.ts` — 다른 core 모듈의 코딩 스타일/Export 패턴 참고.
- `packages/core/package.json` — `zod ^3.24.1`이 이미 deps. exports 맵에 `"./config": "./src/config.ts"` 등록 완료(파일 경로 변경 금지).
- `/home/shine/.claude/plans/public-fizzy-patterson.md` — "설정 파일 (`apps/blog/obsidian-blog.config.ts`)" 섹션과 frontmatter allowlist 명세.

## 공개 인터페이스 (시그니처 고정, 내부 구현은 재량)

```ts
import { z } from 'zod';
import type { ClassifyRule } from './types.ts';

export const obpubConfigSchema = z.object({ /* ... */ });
export type ObpubConfig = z.infer<typeof obpubConfigSchema>;
export type ObpubConfigInput = z.input<typeof obpubConfigSchema>;

export class ObpubConfigError extends Error { /* path + reason */ }

export function defineConfig(input: ObpubConfigInput): ObpubConfig;

export function getClassifyRule(config: ObpubConfig, vaultId: string): ClassifyRule;
```

`defineConfig`는 schema parse 실패 시 `ObpubConfigError`를 throw하되 Zod의 raw issue 대신 `vaults[0].id: 빈 문자열은 허용되지 않습니다` 같은 사람이 읽을 수 있는 1줄 메시지로 감싼다. 첫 issue 하나만 보여줘도 됨.

## 필수 스키마 필드

- `site`: `{ title: string, url: string (URL), author: string }` — 모두 필수.
- `vaults`: 비어있지 않은 배열. **MVP는 단일 vault만 지원하므로 `length > 1`이면 에러**(메시지: `"MVP v0.1은 단일 vault만 지원합니다"`).
  - 각 vault: `{ id: string (kebab/slug), path: string (absolute), urlPrefix?: string (default "/"), theme?: string (default "@obpub/theme-default"), ignore?: string[] }`.
- `publishing`:
  - `frontmatterKey: string` (default `"public"`)
  - `publicTag: string` (default `"public"`)
  - `requireExplicitOptIn: boolean` (default `true`)
  - `frontmatterAllowlist: string[]` (default 아래 14개)
  - `tagBlocklist: string[]` (default `[]`)
- `privateLinkBehavior`: `z.literal('strip-to-text')` 고정 (v0.1).
- `attachments`: `{ followReferencesOnly: boolean (default true), allowedExtensions: string[] (default ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf']) }`
- `graph`: `{ enabled: boolean (default true), includePrivateAsAnonymousNodes: boolean (default false) }`
- `unsafeAllowPrivateFolder?: boolean` (default `false`)

### 기본 frontmatter allowlist (정확히 14개, 순서 보존)

```
['title', 'description', 'date', 'updated', 'tags', 'aliases',
 'cover', 'author', 'draft', 'public', 'slug', 'permalink', 'lang', 'featured']
```

(CLAUDE.md의 allowlist와 1대1 일치 + `featured`. PRD에 `featured: true` 사용처가 있음.)

## 정규화 규칙

1. 각 vault의 `ignore`에는 `['.obsidian/**', '.trash/**']`가 **항상** 자동 union(중복 제거).
2. `unsafeAllowPrivateFolder !== true`이면 `'private/**'`도 추가 union. `true`면 추가하지 않음(escape hatch).
3. `publishing.frontmatterAllowlist`를 사용자가 명시하면 **default와 union**(추가형). 사용자가 명시한 항목이 default를 강등하지 않도록(privacy-first: 더 적은 필드 노출은 좋지만, 더 많이 노출하는 건 명시적 opt-in이어야).
4. `publishing.tagBlocklist`는 그대로 사용(default `[]`).

## `getClassifyRule(config, vaultId)`

- 해당 vault id가 없으면 throw(메시지: `"vault id '<id>'를 찾을 수 없습니다"`).
- 반환: `{ frontmatterKey, publicTag, tripwirePaths, unsafeAllowPrivateFolder }`.
- `tripwirePaths`는 `config.unsafeAllowPrivateFolder === true`이면 `[]`, 아니면 `['private/**']`. (vault별 `ignore`와 독립 — tripwire는 항상 동일한 단일 출처.)

## 테스트 (TDD — 실패 테스트 먼저 작성)

`packages/core/tests/config.test.ts`에 최소 13 케이스. `vitest`의 `describe`/`it` 사용.

1. 유효한 최소 input → 정규화된 config 반환 + 모든 default 채워짐.
2. `vaults` 길이 0 → `ObpubConfigError`.
3. `vaults` 길이 2 → `ObpubConfigError` (메시지에 "MVP" 또는 "단일" 포함).
4. `vaults[0].id` 누락/빈 문자열 → `ObpubConfigError`.
5. `site.url`이 URL이 아닌 문자열 → `ObpubConfigError`.
6. `publishing.frontmatterAllowlist` 생략 → 기본 14개 항목 정확히 포함.
7. `publishing.frontmatterAllowlist: ['custom']` → 결과는 14 + 1 = 15 항목, `'custom'` 포함, 기본 항목 모두 유지.
8. `publishing.frontmatterAllowlist: ['title']`(중복) → 결과 14, 중복 추가 없음.
9. `vaults[0].ignore` 생략 → `['private/**', '.obsidian/**', '.trash/**']` 정확히 포함.
10. `vaults[0].ignore: ['custom/**']` → 결과는 4 항목 (custom + 3 forced).
11. `unsafeAllowPrivateFolder: true` → vault `ignore`에 `'private/**'`이 자동 추가되지 **않음**, `'.obsidian/**'`/`'.trash/**'`는 추가됨.
12. `getClassifyRule(config, 'personal')` → `tripwirePaths === ['private/**']`, `frontmatterKey === 'public'`, `publicTag === 'public'`, `unsafeAllowPrivateFolder === false`.
13. `unsafeAllowPrivateFolder: true`인 config + `getClassifyRule` → `tripwirePaths === []`.

## Acceptance Criteria

```bash
pnpm -r typecheck
pnpm lint
pnpm test
```

세 명령 모두 0으로 종료. 새 테스트 모두 통과. 기존 테스트(classify/commentStrip/slug/tags/wikilink) 회귀 0건.

## 검증 절차

1. 위 AC 커맨드를 직접 실행하라.
2. 아키텍처 체크리스트:
   - `config.ts`는 `packages/core/src/`에만 위치. 테마/CLI/앱 어디에도 설정 기본값 재정의 없음.
   - 모든 외부 입력은 Zod로 통과해야 함. `as any`/`as ObpubConfig` 캐스팅 금지.
   - `ObpubConfigError` 메시지에 path + 한국어 또는 영어 일관 톤. raw Zod issue 객체를 노출하지 않음.
3. `phases/step2a-core-config-discover/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary": "config.ts + 13 tests + zod schema + defineConfig/getClassifyRule + frontmatter allowlist union + tripwire derivation"`
   - 3회 시도 후 실패 → `"status": "error"`, `"error_message": "<구체 사유>"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "<구체 사유>"` 후 즉시 중단

## 금지사항

- **테마/CLI/앱에서 설정 기본값을 재정의하지 마라.** 이유: 단일 출처 원칙. 분산 기본값은 privacy 회귀 버그의 가장 흔한 원인.
- **`frontmatterAllowlist`를 "대체"로 처리하지 마라 — "union"이다.** 이유: 사용자가 한 줄 추가했다고 기본 14개를 잃으면 노출되어야 할 필드가 사라진다. union 의미를 테스트로 박아라.
- **`tripwirePaths`를 vault `ignore`로부터 derive하지 마라.** 이유: tripwire는 walker가 우회한 경우(예: symlink로 `private/`가 vault 안에 들어왔을 때)에도 작동해야 하는 독립 안전망. 항상 `['private/**']` 고정 (또는 escape hatch 시 `[]`).
- **파일시스템 접근(예: `vaults[0].path`가 실제 존재하는지 fs.stat 검사)을 이 step에서 하지 마라.** 이유: `config.ts`는 순수 schema validator. fs는 walker 책임. 테스트 환경에서 부수효과 없도록.
- 기존 테스트를 깨뜨리지 마라.
