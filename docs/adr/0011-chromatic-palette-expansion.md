# 0011. Chromatic Palette Expansion (warm earth tone family)

## Status
Accepted · 2026-Q2 · v0.3

## Context
v0.2 도그푸드 결과, 단일 iron-oxide 액센트만으로는 사이드바·폴더 트리·breadcrumb·홈 레일이 평면적이라는 평가를 받았다. *production-grade*의 결을 내려면 *identity / current-location*용 보조 채널과 폴더별 색-코딩이 필요하다.

동시에 "사용자가 컬러풀함을 원한다"는 요구를 보라/인디고/네온으로 풀면 v0.2 디자인 안티패턴(보라/인디고 브랜드, AI 무지개)을 다시 들이는 셈이 된다. warm earth tone 가족만 따라 *coordinated*하게 확장하면 SaaS 클리셰를 들이지 않으면서도 분위기를 다층화할 수 있다.

사이드바 surface tier는 *recess* 신호로만 작동시켜야 한다 — Δ 휘도 < 1.5:1을 유지해 페이지 색의 한 단계 단차일 뿐, panel처럼 도드라지지 않게 한다. 1px 우측 헤어라인이 실제 분리를 담당한다.

## Decision
v0.3에서 다음 토큰을 도입한다. 모두 *warm earth tone family* 안에 머물며, per-슬롯 hover/soft 변종은 토큰으로 만들지 않는다 (호출부에서 컴포지션 금지).

- 보조 액센트 1개: `--color-accent-2`, forest-moss (`#4d6948` light / `#9ec19a` dark)
- 카테고리 액센트 슬롯 5개: `--color-accent-cat-1..5`, iron-oxide / ochre / moss / bronze / slate
- 사이드바 surface tier 1개: `--color-bg-sidebar`

WCAG AA 검증은 모든 신규 토큰에 대해 페이지 / 사이드바 양쪽 배경 대비로 두 번 수행한다.

## Alternatives considered
- **(1) 토큰 손대지 않고 컴포넌트 레이아웃만 개편** — 사이드바 추가만으로는 트리/레일이 여전히 단색이라 *vault의 모양*이 색으로는 안 읽힘. 시각 임팩트 부족.
- **(2) 멀티 브랜드 색 시스템 도입(보라/인디고/시안 같은 cool 가족 추가)** — v0.2 디자인 안티패턴 §"보라/인디고 브랜드 색상" 행을 정면 위반. 거부.
- **(3) slot ceiling 6+ + per-슬롯 hover/soft 변종 풀세트** — hue 영역이 warm 가족 밖으로 밀려나거나, 호출부가 per-카테고리 surface 시스템을 합성할 수 있어 multi-brand 시각으로 변질될 위험. 5슬롯 + flat tier로 막는다.

## Consequences
- **+** 사이드바·폴더 트리·breadcrumb이 단일 페이지 안에서 *identity / current-location / category*의 세 신호를 색만으로 구분할 수 있게 된다.
- **+** warm earth tone 가족 안에 머물러 v0.2 안티패턴 재발을 막는다.
- **−** 토큰 추가는 fork 사용자가 테마를 커스터마이즈할 때 학습 비용이 늘어난다 (액센트가 *primary action* / *secondary identity* / *5 카테고리 슬롯*으로 분기). 완화책으로 `docs/UI_GUIDE.md` §3·§4-5에서 슬롯 의미를 vault-agnostic 언어로(슬롯 인덱스는 의미 중립, 매핑은 결정론적 해시) 명문화한다.
- **−** WCAG AA 검증을 페이지 / 사이드바 양쪽 배경에 대해 두 번 해야 한다 — 토큰 추가/조정 시 회귀 위험을 줄이기 위해 검증 절차를 `docs/UI_GUIDE.md`에 박아둔다.

## Related
- [docs/ADR.md](../ADR.md) — 인라인 결정 색인
- [docs/UI_GUIDE.md](../UI_GUIDE.md) §3·§4-5 — 슬롯 의미와 매핑 규칙
- 코드: `packages/theme-default/src/styles/tokens.css`, `packages/theme-default/src/lib/categoryAccent.ts`
