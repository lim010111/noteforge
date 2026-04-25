# Step 4: release-notes-and-readme-polish

## 컨텍스트

이 phase의 마지막 step. CHANGELOG 작성 + README 보강 + TODO.md 정리. v0.1.0 git tag는 **사용자 수동**(이 step에서 자동 실행 금지).

오늘 날짜: **2026-04-25**.

## 읽어야 할 파일

- `/CLAUDE.md` — 프로젝트 정체성
- `/README.md` — 보강 대상
- `/TODO.md` — Step 7 잔여 항목 모두 체크
- `/docs/PRD.md`, `/docs/ARCHITECTURE.md` — Known limitations 출처
- `/phases/step7a-ci-actions/index.json`, `/phases/step7b-cli-build-pipeline/index.json`, `/phases/step7c-error-messages/index.json` — 각 phase summary를 CHANGELOG에 인용
- `/phases/step2*/index.json`, `/phases/step3*/index.json`, `/phases/step4*/index.json`, `/phases/step5-cli-commands/index.json`, `/phases/step6-apps-blog/index.json` — Added 항목 도출

## 작업

### 1. 루트 `CHANGELOG.md` 생성

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식. v0.1.0 항목만:

```markdown
# Changelog

본 프로젝트는 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 형식을 따르며, [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [0.1.0] - 2026-04-25

첫 도그푸드 가능 릴리스(MVP). npm 패키지 이름은 안정화 전 변경될 수 있습니다 (Pre-release naming).

### Added

- **Privacy 엔진** (`@noteforge/core`): `isPublic` 분류 + `private/**` tripwire, frontmatter allowlist, 태그 blocklist, `%%...%%` 코멘트 강제 제거, wikilink/transclusion link rewriter (private → strip-to-text, public → 재귀 임베드), 첨부 reference closure, full/filtered 그래프.
- **Astro 통합** (`@noteforge/astro`): Content Layer loader, remark wikilink 브리지, chokidar watcher (의존 그래프 invalidation + 200ms debounce), HMR.
- **테마** (`@noteforge/theme-default`): Tailwind v4 토큰, BaseLayout/Note/Backlinks/TagList/Graph(정적 SVG, 클릭 가능)/404 컴포넌트, 모바일 반응형.
- **CLI** (`@noteforge/cli`): `obpub dev`, `obpub build`, `obpub audit` (`--strict`), `obpub status <file>`. tsup으로 빌드된 단일 바이너리(`dist/bin.js`).
- **앱**: `apps/blog` 도그푸드 사이트 (홈/노트/태그/그래프/api/graph.json/404).
- **CI**: GitHub Actions — install → typecheck → lint → vitest → build → audit.
- **에러 메시지**: config 파싱 실패 + status 입력 오류는 `file:line` 형식 (에디터 cmd-click 호환).
- **테스트**: privacy 모듈 단위 테스트(170+) + 통합 fixture vault(`vault-mixed`) + property-based fuzz (fast-check).
- **문서**: `LICENSE` (MIT), `CONTRIBUTING.md`, `CHANGELOG.md`, README threat model.

### Known limitations

다음은 **의도적으로** v0.2 이후로 미뤘습니다 (`docs/PRD.md` MVP scope 참조):

- Obsidian Callouts (`> [!note]`), KaTeX, Mermaid 미지원 (inert code block 렌더).
- Block reference (`[[Note#^block-id]]`) 미지원 (heading anchor만).
- Dark mode, RSS, sitemap, OG 이미지, 전문 검색(Pagefind) 없음.
- Alias frontmatter → canonical URL 정적 redirect HTML 미생성.
- `.canvas`, Excalidraw, Dataview 쿼리 실행 미지원.
- 다중 vault 실행 미지원 (스키마는 배열 허용하나 `length > 1`이면 명확한 에러).
- 다국어 i18n 단일 로케일 가정.
- Heading anchor 호버 `#` UI 부재.
- Obsidian 플러그인 래퍼는 v0.3+.

### Acknowledgments

- [Astro](https://astro.build/) — Content Layer API.
- Obsidian — wikilink/transclusion 문법(소프트웨어 자체와는 무관, 상표권은 Dynalist Inc.).
- 영감을 준 선행 프로젝트들: Quartz, Digital Garden, Flowershow.

[0.1.0]: https://github.com/PLACEHOLDER_OWNER/PLACEHOLDER_REPO/releases/tag/v0.1.0
```

### 2. README 보완

#### (a) 상단 상태 박스

기존 `## 상태` 섹션 위치 유지하되 문구 보강:

```markdown
## 상태

**v0.1.0 — 도그푸드 가능 (Pre-release naming).**
v0.1 MVP는 본인 vault에서 검증된 워크플로입니다. CI/배포 인프라는 갖춰졌으며, npm 패키지 이름은 안정화 전 변경될 수 있습니다.

상세 변경 내역은 [CHANGELOG.md](./CHANGELOG.md).
```

체크리스트(`- [x] Step 0`...) 부분은 유지.

#### (b) 빠른 시작 섹션 정확도 점검

기존 README의 "빠른 시작 (v0.1 MVP 사용 가능)" 섹션이 실제 동작과 일치하는지 확인:

1. **Dev 서버 실행 검증**: `pnpm install && pnpm --filter blog dev` 수행해서 4321 포트 응답 확인.
   - 성공: README 본문 그대로 유지.
   - 실패: 에러 원인 진단 후 README 명령을 정정. (예: 추가 setup이 필요하다면 명시.)
   - 검증은 백그라운드 실행 후 5초 대기 → curl localhost:4321 → kill 흐름이면 충분.

2. 패키지 import 예시 (있다면) `@noteforge/*`로 갱신.

#### (c) 스크린샷 placeholder

README에 스크린샷이 들어갈 위치(있다면 "## 스크린샷" 섹션, 없다면 "## 빠른 시작" 위)에 코멘트만 박는다:

```html
<!-- TODO(v0.2): screenshot of dogfood site after deployment domain confirmed -->
```

실제 이미지 첨부는 v0.2.

#### (d) Repo URL 코멘트

이전 step에서 박은 `PLACEHOLDER_OWNER/PLACEHOLDER_REPO` 토큰 위치마다 가까운 곳에:

```html
<!-- TODO: confirm GitHub repo URL after repo rename; replace PLACEHOLDER_OWNER/PLACEHOLDER_REPO -->
```

코멘트 1개만 README 상단에 두면 충분(중복 코멘트 금지).

### 3. TODO.md 갱신

`Step 7` 섹션에서 다음 항목 모두 `[x]`로 표시:

- [x] 에러 메시지 file:line 포함 (이미 step7c에서 완료)
- [x] `LICENSE` (MIT)
- [x] `CONTRIBUTING.md`
- [x] README 보완 (실 설치 가이드, 스크린샷)
- [x] 프로젝트명/npm 네임스페이스 정식 확정

`v0.1.0 태그 + 릴리스 노트`는 CHANGELOG가 작성됐으므로 체크하되, **태그는 사용자 수동**임을 한 줄 메모로 추가:

```markdown
- [x] v0.1.0 릴리스 노트 작성 (CHANGELOG.md). git tag는 사용자가 직접 푸시:
      `git tag -a v0.1.0 -m "v0.1.0" && git push origin v0.1.0`
```

`미결정 / 사용자 확인 필요` 섹션:
- "실 Obsidian vault 절대경로" 항목은 step6에서 처리됐으므로 `[x]` (또는 항목 제거).
- "정식 프로젝트명 + npm 네임스페이스" → `[x] noteforge / @noteforge/*`로 갱신.
- "배포 도메인" → 그대로 유지 (`[ ]`).

### 4. 빌드/검증

```bash
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

## Acceptance Criteria

```bash
test -f CHANGELOG.md
test -f LICENSE
test -f CONTRIBUTING.md
pnpm -r typecheck
pnpm lint
pnpm test
pnpm --filter blog build
```

## 검증 절차

1. AC 모두 통과.
2. CHANGELOG.md 첫 H2가 `## [0.1.0] - 2026-04-25`.
3. README 상단에 `Pre-release naming` 문구 + CHANGELOG 링크.
4. TODO.md Step 7의 모든 잔여 항목이 `[x]`.
5. `git grep 'TODO(v0.2)' README.md` 결과 1건 이상 (스크린샷 placeholder 코멘트 존재).
6. dev 서버 1회 검증(섹션 2(b))이 성공했음을 step output에 기록.
7. 성공 → step.md `status: completed`, `summary: "CHANGELOG.md v0.1.0 created (Added/Known limitations/Acknowledgments), README polished with Pre-release naming + CHANGELOG link + screenshot placeholder, TODO.md Step 7 fully checked off; v0.1.0 git tag deferred to user manual command"`.

## 이 step에서는 새 테스트를 작성하지 않는다

이유: 문서/메타데이터 변경. 동작 로직 무변경.

## 사용자 수동 단계 (참고)

이 step 완료 후 사용자가 직접 실행:

```bash
git checkout main
git merge feat-step7d-release-prep   # 또는 PR 머지
git tag -a v0.1.0 -m "v0.1.0 — privacy-first Obsidian SSG MVP"
git push origin v0.1.0
```

step에서 자동 실행하지 마라.

## 금지사항

- `git tag`를 자동으로 찍지 마라. 이유: 사용자 수동 단계 (배포 시점 통제).
- `npm publish`를 실행하지 마라. 이유: publish 인프라(`files`, `publishConfig`, dist 빌드)가 갖춰지지 않음 — v0.2 별도 phase.
- README threat model 본문을 약화시키는 표현(`best-effort`, `usually safe` 등)으로 교체하지 마라. 이유: 제품 핵심 약속.
- 스크린샷 실제 이미지를 만들거나 첨부하지 마라. 이유: 도메인 미정. v0.2 작업.
- CHANGELOG에 미구현 기능을 적지 마라. 이유: keep-a-changelog는 실제 변경만.
- placeholder URL을 임의의 실제 URL로 채우지 마라. 이유: 사용자 미결정.
