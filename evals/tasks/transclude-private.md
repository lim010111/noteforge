# Task — Transclude private note must be removed

## 입력 (agent 에게 주는 prompt)

> public 노트 안에서 `![[Private Secret]]` transclusion 을 작성했다. 빌드 결과 HTML 에 private 본문이 새지 않도록 하면서, public 노트 자체는 정상 발행되어야 한다.

## Pass 조건

1. 빌드 성공.
2. `apps/blog/dist/**/*.html` 안에 private 본문 / 제목 0회 등장.
3. transclude 자리에 *어떤 placeholder 도 남지 않음* — AST 에서 완전 제거 정책 (`packages/core/src/privacy/transclude.ts`).
4. public 노트의 다른 문단은 그대로 렌더된다.
5. agent 가 transclude 에 대해서도 single-point classify 결정만 사용한다 (재유도 금지).

## Fail 시그널

- private 본문 일부 (canary `DO_NOT_LEAK_BANANA_6f3c1`) 가 dist 에 새어나옴
- transclude 자리에 "[[Private]]" 같은 plain text 가 남음 (제목 누출)
- agent 가 transclude 만의 별도 classify 헬퍼를 작성

## 실행

```
pnpm --filter blog build
grep -R "DO_NOT_LEAK_BANANA_6f3c1" apps/blog/dist/ && echo FAIL || echo PASS
```

## 참고

- root CLAUDE.md CRITICAL "transclusion" 항목
- [packages/core/src/privacy/transclude.ts](../../packages/core/src/privacy/transclude.ts)
- fixture: [packages/core/tests/fixtures/vault-mixed/public-with-embed.md](../../packages/core/tests/fixtures/vault-mixed/public-with-embed.md)
