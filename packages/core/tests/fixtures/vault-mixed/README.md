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
| `public-with-image.md` | yes | `![[only-public.png]]` 한 첨부 임베드 (only-private.png는 어느 공개 노트도 참조하지 않아야 하므로 여기서 참조하지 않는다) |
| `public-with-embed.md` | yes | `![[Another Public]]` (public 임베드 — 본문 확장), `![[Private Secret]]` (private 임베드 — 완전 제거) |
| `public-with-comment.md` | yes | 인라인 `%%...%%` 1회 + 블록 `%%...%%` 1회, 둘 다 canary B (아래 canary 섹션 참조) 포함 |
| `public-with-extra-fm.md` | yes | frontmatter에 allowlist 밖 필드 `review-date`, `personal-note`, `mood` |
| `public-with-secret-tag.md` | yes | `tags: [public, client/acme-secret, public/internal]` — blocklist(`client/**`) 대상 |
| `only-public.png` | — | public 노트 첨부. 1×1 PNG (투명 RGBA) |
| `only-private.png` | — | 어느 공개 노트도 참조하지 않음. attachment closure에 포함되면 안 됨. 1×1 PNG (빨강 RGBA) — 공개본과 바이너리가 다름 |

총 **9개 Markdown + 2개 PNG = 11 파일** + 이 README.

## canary 문자열

테스트 assert에서 렌더 산출물에 **0회** 등장해야 하는 누출 감지 문자열. 아래 두 문자열은 `grep`으로 이 README에 매칭되면 안 되므로 의도적으로 분해해서 적는다. 테스트 코드에서는 전체 상수로 선언할 것.

- canary A — 프리픽스 `DO_NOT_LEAK_BANANA_` + 서픽스 `6f3c1`. `Private Secret.md` 본문에만 존재.
- canary B — 프리픽스 `CLAUDE_COMMENT_LEAK_` + 서픽스 `77b`. `public-with-comment.md` 본문에 인라인 1회 + 블록 1회 (총 2회) 존재.

tripwire(`private/family-photos.md`)는 canary를 심지 **않는다**. tripwire는 "공개 슬러그 집합에 포함되지 않음 + 렌더 HTML/`graph.json`에 해당 제목/슬러그 0회"로 별도 검증한다.

## 주의

- 각 Markdown 파일 **본문에는 설명/주석을 넣지 말 것.** canary 0회 assert가 본문 설명 문자열에 오염되지 않도록 하기 위함. 모든 맥락은 이 README에만 기록.
- PNG 파일은 `@noteforge/core`의 exports나 빌드 산출물에 포함되지 않는다 (테스트 전용).
