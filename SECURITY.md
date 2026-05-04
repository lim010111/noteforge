# Security Policy

`noteforge`는 Obsidian vault에서 **opt-in으로 표시한 노트만** 정적 사이트로 발행하는 것을 핵심 계약으로 삼습니다. 비공개로 의도된 노트·frontmatter 필드·첨부 파일이 빌드 산출물에 노출되는 동작은 모두 보안 이슈로 다룹니다.

## In scope

다음 카테고리는 보안 이슈로 접수합니다.

- 비공개 노트 본문/제목/슬러그가 렌더된 HTML, `graph.json`, sitemap, RSS, dev 서버 응답에 등장
- frontmatter allowlist(`title`, `description`, `date`, `updated`, `tags`, `aliases`, `cover`, `thumbnail`, `author`, `draft`, `public`, `slug`, `permalink`, `lang`, `featured`) 외 필드가 산출물에 노출
- `private/**` tripwire 우회 (frontmatter `public: true` 단독으로 공개되는 경우)
- `%%...%%` 코멘트가 Phase A 이후 파이프라인에 잔존
- `![[Note]]` transclusion이 비공개 타겟을 끌어와 렌더하거나, 공개 판정 우회
- `/attachments/<id>` 경로가 public attachment closure 밖의 파일을 가리키는 경우
- 의존성 패키지의 알려진 취약점이 본 프로젝트의 사용 경로에서 실제로 트리거되는 경우

## Out of scope

- 사용자가 직접 `unsafeAllowPrivateFolder: true` 등 명시적 우회 옵션을 켠 결과
- vault 자체의 파일 권한, OS 수준 보안, 사용자가 운영하는 호스팅의 설정 문제
- 외부 서비스(예: Cloudflare Pages, GitHub Pages) 측 취약점

## How to report

**공개 이슈 트래커 대신 비공개 채널을 사용해주세요.**

1. 1순위 — GitHub의 private vulnerability reporting:
   <https://github.com/lim010111/noteforge/security/advisories/new>
2. GitHub 계정이 없거나 위 채널을 사용할 수 없는 경우, 메인테이너에게 직접 연락하시면 비공개 채널을 안내해드립니다.

리포트에는 가능하면 다음을 포함해주세요.

- 영향받는 버전 / 커밋 해시
- 재현 절차 — **합성 fixture 권장**, 실제 vault 데이터(노트 본문/제목/첨부 파일명 등)는 첨부하지 마세요
- 예상되는 영향 범위 (예: 단일 frontmatter 필드 노출 vs. 본문 전체 노출)
- 제안하는 완화책이 있다면 함께

## Response targets

- 영업일 기준 **3일 이내** 1차 응답 (수신 확인 + 트리아지 일정)
- 영업일 기준 **14일 이내** 트리아지 결과 회신 (확인 / 미확인 / 추가 정보 요청)
- 수정 일정은 영향 범위에 따라 합의

본 프로젝트는 v0.x 단계이며 보안 패치는 일반적으로 `main`의 다음 마이너 릴리스에 포함됩니다. 이전 마이너에 대한 백포트는 현재 보장하지 않습니다.

## Disclosure

- 수정 릴리스 이후 합의된 시점에 `CHANGELOG.md`와 GitHub Security Advisory에 공개합니다.
- 리포터의 크레딧 표기를 원하실 경우 advisory 본문에 반영합니다 (원치 않으시면 익명 처리).

## Privacy of test data

privacy 회귀를 재현·검증할 때는 `packages/core/tests/fixtures/vault-mixed/`의 합성 fixture와 다음 canary를 사용해주세요. 실제 vault 데이터를 메인테이너와 공유할 필요가 없게 설계되어 있습니다.

- `DO_NOT_LEAK_BANANA_6f3c1` — private 노트 본문 canary
- `CLAUDE_COMMENT_LEAK_77b` — `%%...%%` 코멘트 canary
- `FOLDER_TREE_DO_NOT_LEAK_8a4f2` — 폴더 트리 canary

이 canary들이 빌드 산출물에 **0회** 등장한다는 것이 본 프로젝트의 가장 강한 회귀 가드입니다.
