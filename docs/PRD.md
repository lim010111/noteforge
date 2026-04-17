# PRD — Obsidian-Publish-OSS

## 목표
Obsidian vault에서 **명시적으로 공개하기로 한 노트만** 안전하게 정적 블로그로 발행하는 오픈소스 SSG. "privacy-first. 표시하지 않은 건 존재조차 드러나지 않는다"를 제품의 핵심 계약으로 건다.

## 배경
- **Obsidian Publish (공식)**: 월 $8–10. 비싸고 lock-in.
- **Quartz v4**: 무료지만 기본값이 "모두 공개"(opt-out). 실수로 private 노트가 유출되거나, public 노트가 private 노트를 링크하면 **그래프/백링크에 private 제목이 노출**되는 고질적 불만.
- **Digital Garden / Flowershow**: opt-in(`dg-publish: true`) 지원하지만 transclusion/코멘트/frontmatter 필드 누출까지 책임지는 프라이버시 모델은 없음.

이 프로젝트의 틈새: **opt-in 기본값 + 모든 누출 경로(transclusion, `%%comment%%`, frontmatter 필드, 태그)를 명시적으로 차단**.

## 사용자
1. **본인(1차 도그푸드)**: 민감 정보가 섞인 vault에서 일부만 선별 공개.
2. **일반 Obsidian 유저**: Quartz의 opt-out이 불안해서 "private-first"를 원하는 사람.
3. **팀/연구자**: 내부 지식과 공개 산출물이 한 vault에 공존.

## 핵심 기능
1. **공개 판정**: `public: true` frontmatter **또는** `#public` 태그로 opt-in. 기본값 private.
2. **누출 방지**:
   - 링크: public→private 링크는 `strip-to-text`로 재작성 (제목 미노출).
   - 임베드: `![[Note]]` 타겟이 private이면 AST에서 완전 제거.
   - 코멘트: `%%...%%` 강제 제거.
   - frontmatter: allowlist 밖 필드 차단.
   - 태그: `tagBlocklist`로 공개에서 제외.
   - 백링크/그래프: private→public 엣지 삭제.
   - 첨부: public 노트에서 참조된 것만 `dist/`에 포함.
3. **실시간 프리뷰**: vault 파일 변경 시 HMR로 브라우저 즉시 반영.
4. **Post-build audit**: 빌드 후 `dist/`를 스캔해 누출 검증. 실패 시 빌드 중단.
5. **CLI**: `obpub dev/build/audit/status`.
6. **Astro 정적 출력**: Vercel/Cloudflare/Netlify 어디서든 호스팅 가능.

## MVP 제외
- 다중 vault 실행 (schema는 배열 허용하되 `length > 1`이면 에러).
- Obsidian 플러그인 래퍼 (v0.3+).
- D3 force-directed 인터랙티브 그래프 (v0.1은 정적 SVG, 단 노드 클릭 가능).
- Callouts, KaTeX, Mermaid, 블록 참조.
- 다크모드, RSS, sitemap, OG 이미지, 검색(Pagefind).
- `obpub init` scaffolder (MVP는 `apps/blog` 템플릿 clone).
- SaaS 호스팅.

## 디자인 방향
- **읽기 우선의 미니멀 라이트 테마**. 본문 `max-w-3xl`, 측정폭 ~65ch, line-height 1.7.
- 장식 없음. AI slop 안티패턴(글래스모피즘, 그라디언트 텍스트, 네온 글로우, 보라색 브랜딩) 금지 — 상세는 `UI_GUIDE.md`.
- 개인 사이트지만 공공 문서처럼 신중하게.
- 다크모드는 v0.2.

## 성공 지표 (v0.1)
- 도그푸드 사이트(`apps/blog`) 배포 성공.
- Vitest privacy 보장 테스트 11건 전부 통과 (canary 누출 0회).
- `obpub build` 단일 명령으로 완전한 정적 산출물 생성.
- 임의의 vault에서 public/private 토글이 재시작 없이 프리뷰에 반영.
