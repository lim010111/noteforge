# vault-mixed fixture

`@noteforge/core` privacy 파이프라인의 통합/프로퍼티 테스트가 의존하는 **고정된 모의 vault**.
`packages/core/tests/` 하위의 통합 테스트와 fuzz 테스트가 이 디렉토리를 vault 루트로 로드한다.

이 파일들은 테스트 산출물이다. **의도 없이 수정하지 말 것.** 내용/파일명/tags/frontmatter 필드를 손대면 다음 step들의 assert가 깨진다. 변경이 필요하면 해당 step의 테스트 코드와 함께 갱신할 것.

## 파일 매니페스트

| 경로 | public? | 요지 |
|---|---|---|
| `public-note.md` | yes (`public: true`) | 본문에서 `[[Private Secret]]`, `[[Another Public]]` 두 링크 사용 |
| `another-public.md` | yes (`#public` 태그) | frontmatter `aliases: [구이름]` 포함. 짧은 public 산문 |
| `Private Secret.md` | **no** (공개 마커 없음) | 본문에 canary A (아래 canary 섹션 참조). 제목 `Private Secret`도 누출 감지 대상 |
| `private/family-photos.md` | **no** (tripwire) | frontmatter `public: true`지만 `private/` 하위라 강제 private. `unsafeAllowPrivateFolder` 없이 미발행 |
| `public-with-image.md` | yes | `![[only-public.png]]` 한 첨부 임베드 + 존재하지 않는 cover/thumbnail frontmatter sanitization 검증 |
| `public-with-embed.md` | yes | `![[Another Public]]` (public 임베드 — 본문 확장), `![[Private Secret]]` (private 임베드 — 완전 제거) |
| `public-with-comment.md` | yes | 인라인 `%%...%%` 1회 + 블록 `%%...%%` 1회, 둘 다 canary B (아래 canary 섹션 참조) 포함 |
| `public-with-extra-fm.md` | yes | frontmatter에 allowlist 밖 필드 `review-date`, `personal-note`, `mood` |
| `public-with-secret-tag.md` | yes | `tags: [public, client/acme-secret, public/internal]` — blocklist(`client/**`) 대상 |
| `note-with-alias.md` | yes (`public: true`) | frontmatter `aliases: [old-name, previous-title]` — alias redirect 라우트/audit 검증용 |
| `private-with-alias.md` | **no** (`public: false`) | frontmatter `aliases: [secret-old]` + 본문에 canary A. 비공개 노트의 alias가 어느 채널에도 흘러가지 않는지 검증 |
| `posts/AI/Claude/agents.md` | yes (`public: true`) | v0.3 case (a) — 깊게 nested된 fully-public 브랜치. 폴더 트리에서 deep-public 경로가 보존되는지 검증 |
| `private/secrets/diary.md` | **no** (tripwire) | v0.3 case (b) — `private/**` 하위 + `public: true`라 강제 private. title + 본문에 canary C. forcedIgnore가 약화되어도 마지막 가드가 발동하도록 fixture에 미리 심어두는 회귀 가드 |
| `posts/mix/visible.md` | yes (`public: true`) | v0.3 case (c) — public/draft 혼재 폴더의 정상 노트 |
| `posts/mix/wip.md` | yes (`public: true`, `draft: true`) | v0.3 case (c) — `draft: true`라 `filterPublishable`이 거름. `runCorePipeline.publicSlugs`에는 포함되지만 apps/blog 라우팅에는 부재 |
| `apps.md` | yes (`public: true`) | v0.3 case (d) — 루트 슬러그 `apps`. `apps/colliding/index.md`로 형성되는 폴더 `apps/`와 의도적 충돌. `runCorePipeline`은 throw하지 않음(라우팅 단계에서만 throw) |
| `apps/colliding/index.md` | yes (`public: true`) | v0.3 case (d) — 폴더 `apps/` 안의 노트. `apps.md`와의 슬러그 충돌은 라우팅 build-time throw가 잡음 |
| `public-with-frontmatter-cover.md` | yes (`public: true`) | v0.51 — 본문 임베드 없이 frontmatter `cover`만으로 attachment closure에 들어가는지 검증 |
| `private/upload-hidden-image.md` | **no** (tripwire) | v0.51 — private 노트의 frontmatter `cover`가 attachment closure에 기여하지 않음을 검증 |
| `only-public.png` | — | public 노트 첨부. 1×1 PNG (투명 RGBA) |
| `only-private.png` | — | 어느 공개 노트도 참조하지 않음. attachment closure에 포함되면 안 됨. 1×1 PNG (빨강 RGBA) — 공개본과 바이너리가 다름 |
| `frontmatter-only-cover.png` | — | v0.51 frontmatter-only cover fixture |
| `private-frontmatter-cover.png` | — | v0.51 private frontmatter-only cover counter-fixture |

총 **19개 Markdown + 4개 이미지 파일 = 23 파일** + 이 README.

## canary 문자열

테스트 assert에서 렌더 산출물에 **0회** 등장해야 하는 누출 감지 문자열. 아래 두 문자열은 `grep`으로 이 README에 매칭되면 안 되므로 의도적으로 분해해서 적는다. 테스트 코드에서는 전체 상수로 선언할 것.

- canary A — 프리픽스 `DO_NOT_LEAK_BANANA_` + 서픽스 `6f3c1`. `Private Secret.md`와 `private-with-alias.md` 본문에 존재(둘 다 비공개 노트이므로 어느 공개 채널에도 등장하면 안 됨).
- canary B — 프리픽스 `CLAUDE_COMMENT_LEAK_` + 서픽스 `77b`. `public-with-comment.md` 본문에 인라인 1회 + 블록 1회 (총 2회) 존재.
- canary C — 프리픽스 `FOLDER_TREE_DO_NOT_LEAK_` + 서픽스 `8a4f2`. v0.3 case (b)의 `private/secrets/diary.md` title 필드 1회 + 본문 1회. `private/**` tripwire가 약화/우회되는 미래 회귀 시 폴더 트리/사이드바/dist 어디로도 이 문자열이 새지 않음을 보장.

tripwire(`private/family-photos.md`, `private/secrets/diary.md`)는 canary를 본문에 심을 수도(`private/secrets/diary.md`의 canary C) 안 심을 수도(`private/family-photos.md`) 있다. 후자는 "공개 슬러그 집합에 포함되지 않음 + 렌더 HTML/`graph.json`에 해당 제목/슬러그 0회"로 별도 검증한다.

## 주의

- 각 Markdown 파일 **본문에는 설명/주석을 넣지 말 것.** canary 0회 assert가 본문 설명 문자열에 오염되지 않도록 하기 위함. 모든 맥락은 이 README에만 기록.
- PNG 파일은 `@noteforge/core`의 exports나 빌드 산출물에 포함되지 않는다 (테스트 전용).
