# step8-deploy-prep 사용자 입력

step4(`cloudflare-pages-ops`)가 시작되기 전에 아래 빈칸을 모두 채워라. step4 실행 중 child Claude 세션이 이 파일을 읽어 값으로 사용한다. 빈칸이 남아 있으면 step4는 `blocked` 상태로 즉시 중단한다.

작성 규칙:
- 각 항목의 `값:` 우측에 직접 입력. 코드 펜스(``` ``` ```)나 따옴표 없이 평문 한 줄.
- 잘 모르겠는 항목은 `값: SKIP` 으로 두면 placeholder 유지(해당 항목 관련 작업은 후속 TODO로 step4가 기록).
- `(선택)` 표기 항목은 `값: SKIP` 또는 빈 값 모두 허용(빈 값은 SKIP과 동일하게 처리).

---

## 1. Cloudflare Pages 프로젝트명

`wrangler.toml`의 `name` 과 `apps/blog/obsidian-blog.config.ts`의 `site.url`(`https://<여기>.pages.dev`) 두 곳에 들어간다.

**제약**
- kebab-case: 영문 소문자 / 숫자 / 하이픈만. 시작/끝에 하이픈 금지.
- 길이 1~58자.
- **Cloudflare 계정 내 유니크**(전 세계 유니크는 아님). 동일 계정에서 같은 이름 재사용 불가.

**고르는 법** (1분 안에 결정)
1. 블로그 성격을 드러내는 짧은 이름. 예: `obsidian-blog`(범용), `shine-notes`(개인명+성격), `obsidian-publish-oss`(레포명과 일치).
2. 너무 일반적인 이름(`blog`, `notes`)은 본인 계정에서도 다른 프로젝트와 헷갈릴 수 있음 — 가능하면 식별 토큰 1개 추가.
3. 도메인 형태: `https://<이값>.pages.dev` 가 첫 배포 직후 자동 발급. 이 도메인이 v0.1의 canonical URL이 됨.

**Cloudflare 계정/프로젝트 사전 셋업** (이 입력값을 정한 뒤, **배포 단계**에서 필요 — 지금 미리 해도 됨)

1. https://dash.cloudflare.com/sign-up 에서 무료 계정 생성(이메일 + 비밀번호. 카드 등록 불필요).
2. 로그인 후 좌측 메뉴 **Workers & Pages** 클릭.
3. wrangler CLI 설치: 로컬에서 `npm i -g wrangler` (또는 `pnpm add -g wrangler`). 버전 v3 이상 권장(`wrangler --version`).
4. `wrangler login` → 브라우저 OAuth 창에서 계정 인증 → 토큰 자동 저장(`~/.wrangler/`).
5. **프로젝트 사전 생성은 불필요.** step4 종료 후 첫 `wrangler pages deploy apps/blog/dist --project-name=<여기서 정한 이름>` 실행 시 wrangler가 프로젝트를 자동 생성.
   - 이름 충돌 시 wrangler가 에러 메시지로 알려줌 → 다른 이름으로 재시도.
   - 미리 만들고 싶다면 dashboard → Workers & Pages → **Create application** → **Pages** → **Upload assets** → 프로젝트명 입력. (Direct Upload 모드. Git 연동은 본 프로젝트에서 사용 안 함.)
6. 첫 배포 후 발급되는 URL: `https://<프로젝트명>.pages.dev`. 이걸 step4가 `obsidian-blog.config.ts`의 `site.url` 에 박는다.

**기본 후보**: `obsidian-blog`

값: `noteforge`

---

## 2. CHANGELOG 버전 라벨

새 변경 항목의 헤더(`CHANGELOG.md` 최상단). 의미를 이해하고 고르면 됨.

- `0.2.0-alpha` — 새 기능(alias redirect, OG meta, 배포 가이드)이라 patch가 아님. `-alpha` 접미사는 "API/네임스페이스 안정화 전" 신호. README의 "Pre-release naming" 원칙과 일관. **기본 후보.**
- `0.2.0` — 정식 minor 릴리스. npm 네임스페이스(`@noteforge/*`)와 CLI 인터페이스를 이번에 lock-in 한다는 뜻. 이후 breaking change 시 `0.3.0`이 되어야 함.
- `Unreleased` — Keep a Changelog 관례의 임시 항목. 다음 정식 버전 결정 시점까지 보류. v0.2.0 또는 v0.1.1로 추후 승격 가능.
- 기타 자유 SemVer (`0.1.1`, `0.2.0-beta.1` 등) 도 허용.

**고르는 법**: 지금 npm 네임스페이스를 확정할 자신이 있으면 `0.2.0`. 한 번 더 도그푸드하고 싶으면 `0.2.0-alpha`. 결정 보류면 `Unreleased`.

값: `0.2.0`

---

## 3. CHANGELOG 릴리스 날짜

헤더의 `[버전] - YYYY-MM-DD`에 들어가는 날짜.

**규칙**
- 형식: `YYYY-MM-DD` (Keep a Changelog 1.1.0).
- 항목 #2에서 `Unreleased`를 선택했다면 `값: SKIP` (`[Unreleased]` 헤더에는 날짜 없음).
- 오늘 날짜를 정확히 알고 싶으면 터미널에서 `date +%Y-%m-%d`.
- 실제 git tag/push 일자와 같지 않아도 됨(CHANGELOG는 변경 내용이 lock된 시점 기록).

**기본 후보**: `2026-04-26` (오늘)

값: `2026-04-26`

---

## 4. GitHub repo URL placeholder 교체값

`README.md` 라인 1 주석 + 본문, `CHANGELOG.md` 라인 41(`[0.1.0]: https://github.com/PLACEHOLDER_OWNER/PLACEHOLDER_REPO/...`)에 들어가는 `<owner>/<repo>` 형식.

**찾는 법**
1. 터미널에서 `git remote get-url origin` 실행.
   - 결과 예: `git@github.com:woohyun/obsidian_blog.git` → `<owner>/<repo>` = `woohyun/obsidian_blog`.
   - 또는 `https://github.com/woohyun/obsidian_blog.git` → 동일.
2. 또는 GitHub 웹에서 repo 페이지 URL의 `github.com/` 뒷부분: `https://github.com/woohyun/obsidian_blog` → `woohyun/obsidian_blog`.

**제약**
- 슬래시 1개, `<owner>` 와 `<repo>` 만. `https://` / `.git` 제외.
- repo가 아직 push 안 되었거나 비공개로 두고 싶으면 `값: SKIP`. step4는 placeholder를 유지하고 `## TODO` 섹션에 후속 처리 항목으로 기록.

**예시**: `shine/obsidian-publish-oss`, `woohyun/obsidian_blog`

값: `lim010111/obsidian-blog`

---

## 5. (선택) README 스크린샷 캡처 시점

`README.md:37`의 `<!-- TODO(v0.2): screenshot of dogfood site after deployment domain confirmed -->` 처리 방향.

**선택지**
- `now` — 이 phase 종료 후 사용자가 직접 배포하고(`wrangler pages deploy`), 배포된 사이트(`https://<프로젝트명>.pages.dev`)를 브라우저로 열어 1회 캡처. 파일을 `apps/blog/public/screenshot.png`(또는 `docs/screenshots/dogfood.png`)로 저장하고 git commit. step4는 README의 TODO 주석을 `![dogfood](path/to/screenshot.png)` 으로 교체.
  - 캡처 도구: macOS는 `Cmd+Shift+4`, Windows/WSL은 `Snipping Tool`, Linux는 `gnome-screenshot -a`.
  - 권장 해상도: 1280×800 이상, PNG.
- `defer` — TODO 주석 그대로 유지. v0.2에서 도메인 확정 후 처리. **기본 후보.**

값: `now`

---

## 6. (선택) 추가 메모

step4에서 알아야 할 그 외 사항이 있으면 자유 형식으로(예: 특정 보안 헤더 추가/제외 요청, README 표현 수정 요구, 도메인 변경 예정 등):

값:
