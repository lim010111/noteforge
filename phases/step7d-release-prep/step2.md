# Step 2: add-license-mit

## 컨텍스트

step 1에서 monorepo가 `@noteforge/*`로 rename됨. 이제 라이선스 파일을 추가한다.

CLAUDE.md / `docs/ADR.md` ADR-008에서 MIT로 결정. 저작권자: `woohyun` (git config user.name). 연도: 2026.

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ADR.md` — ADR-008
- `/README.md` — 라이선스 섹션 위치
- `/package.json`, `/packages/*/package.json`, `/apps/blog/package.json`

## 작업

### 1. 루트 `LICENSE` 파일 생성

표준 OSI MIT 텍스트:

```
MIT License

Copyright (c) 2026 woohyun

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

저작권자명/연도 라인 외에는 OSI 표준에서 변경 금지.

### 2. 각 패키지 `package.json`에 license 필드 추가

대상 (publishable):
- `packages/core/package.json`
- `packages/astro-integration/package.json`
- `packages/theme-default/package.json`
- `packages/cli/package.json`

각각:
```json
"license": "MIT"
```
필드 추가. `name` 바로 아래 또는 `version` 다음 위치 권장(JSON 컨벤션). 이미 있으면 skip.

`apps/blog/package.json`은 publishable이 아니므로:
- `"private": true` 보장(이미 있을 가능성 큼; 없으면 추가).
- `"license": "MIT"` 추가는 선택(추가해도 무해). 추가한다.

루트 `package.json`은:
- `"license": "MIT"` 필드 추가.

### 3. README 라이선스 섹션 정합성

README의 `## 라이선스` 섹션에서 LICENSE 파일을 가리키는 링크가 있는지 확인. 없으면 추가:

```markdown
## 라이선스

[MIT](./LICENSE).
```

기존 본문(`MIT. 코드는 자유롭게 사용/수정/재배포 가능합니다.` 등) 정신은 유지하고, 첫 줄에 LICENSE 파일 링크를 박는다.

## Acceptance Criteria

```bash
test -f LICENSE
head -1 LICENSE | grep -q "MIT License"
pnpm -r typecheck
pnpm lint
pnpm test
```

## 검증 절차

1. 위 AC 통과.
2. `grep -l '"license":' packages/*/package.json | wc -l` → 4 (모든 publishable 패키지에 license 필드).
3. README ## 라이선스 섹션에 `./LICENSE` 링크 존재.
4. 성공 → step.md `status: completed`, `summary: "MIT LICENSE added at root, license:MIT field added to 4 publishable packages + apps/blog, README link updated"`.

## 이 step에서는 새 테스트를 작성하지 않는다

이유: 라이선스 파일/메타데이터 변경. 동작 변경 없음.

## 금지사항

- 다른 OSI 라이선스로 바꾸지 마라. 이유: ADR-008에서 MIT로 결정 박혀있음.
- third-party 의존성 라이선스 attribution 파일(NOTICES, THIRD_PARTY_LICENSES 등)을 만들지 마라. 이유: v0.2 작업.
- 저작권자 라인을 마음대로 바꾸지 마라. 이유: 사용자 명시 — `Copyright (c) 2026 woohyun`.
- LICENSE 본문을 변형/요약하지 마라. 이유: OSI 표준 텍스트 그대로여야 license tooling/검증기에서 인식.
