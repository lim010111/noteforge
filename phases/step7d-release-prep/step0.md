# Step 0: confirm-project-name-and-npm-availability

## 컨텍스트

이 phase는 v0.1.0 릴리스 준비다. 13개 phase(step2a → step7c) 코드 작업 완료, 남은 건 라이선스/CONTRIBUTING/README/네이밍/태그 같은 잡일.

사용자가 plan 승인 시 확정한 정식명:
- **프로젝트명 / npm scope**: `noteforge` / `@noteforge/*`
- **CLI 바이너리 이름**: `obpub` 유지 (사용자 타이핑 워크플로 보존)
- **GitHub repo URL**: placeholder (`https://github.com/<owner>/<repo>` 코멘트로 두고, 실제 URL 미정)
- **Copyright holder**: `woohyun` (git config user.name)

이 step은 npm 점유 확인만 한다. rename은 step 1.

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ADR.md` — ADR-008 MIT 라이선스 결정
- `/docs/PRD.md`
- `/package.json` (현재 name: `obsidian-publish-oss`)
- `/packages/core/package.json`, `/packages/astro-integration/package.json`, `/packages/theme-default/package.json`, `/packages/cli/package.json` (현재 모두 `@obpub/*`)

## 작업

1. `npm view noteforge` 실행. 출력을 캡처.
   - 점유 시: stdout에 패키지 메타가 나옴.
   - 미점유 시: stderr에 `npm error code E404` + non-zero exit.
2. `npm view @noteforge/core` 실행. 동일한 방식으로 점유 여부 확인.
3. 추가로 향후 publish 대상 4개 패키지명도 사전 확인:
   - `npm view @noteforge/astro` (또는 `@noteforge/astro-integration` — 짧은 쪽 권장)
   - `npm view @noteforge/theme-default`
   - `npm view @noteforge/cli`
4. 결과를 한 줄 요약으로 `phases/step7d-release-prep/step0-output.json`에 다음 형식으로 기록:
   ```json
   {
     "name": "noteforge",
     "scope": "@noteforge",
     "results": {
       "noteforge": "available" | "taken",
       "@noteforge/core": "available" | "taken",
       "@noteforge/astro": "available" | "taken",
       "@noteforge/theme-default": "available" | "taken",
       "@noteforge/cli": "available" | "taken"
     }
   }
   ```
5. **결과 분기**:
   - 모두 `available` → `phases/step7d-release-prep/index.json`의 step 0를 `status: completed` + `summary: "noteforge unscoped + scope @noteforge available on npm; proceed with rename"`로 업데이트.
   - 하나라도 `taken` → `status: blocked`, `blocked_reason: "<package> is taken on npm; user must pick alternative"` 후 즉시 중단. 절대 임의로 다른 이름을 쓰지 마라.

## Acceptance Criteria

```bash
npm view noteforge >/dev/null 2>&1; echo "noteforge: $?"
npm view @noteforge/core >/dev/null 2>&1; echo "@noteforge/core: $?"
```
- exit code `0` = 점유, non-zero (보통 `1` with E404) = 가용.
- 5개 모두 가용이어야 step 0 통과.

별도 코드 변경이 없으므로 `pnpm typecheck`/`lint`/`test`는 이 step의 AC가 아니다 (이 step에서는 새 테스트도 작성하지 않는다 — 메타데이터 조회만 한다).

## 검증 절차

1. 위 npm view 명령 5개를 실행.
2. 결과를 `step0-output.json`에 기록.
3. index.json 갱신.

## 금지사항

- 임의로 이름을 바꾸지 마라. 이유: 사용자 결정 사항. 점유 시 blocked로 멈추고 사용자에게 다시 묻는다.
- `npm publish`나 점유를 우회하는 시도(예: 다른 scope 임시 사용)를 하지 마라. 이유: 사용자 의도 위반.
- 이 step에서 rename을 시작하지 마라. 이유: rename은 step 1.
- 인터넷 연결 실패 시 점유 결과를 추측하지 마라. 그 경우 `status: error`, `error_message: "npm registry unreachable"`로 멈추고 사용자에게 보고.
