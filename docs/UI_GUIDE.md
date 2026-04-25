# UI 디자인 가이드 — @noteforge/theme-default (v0.1)

## 디자인 원칙
1. **읽기 우선** — 본문이 주인공. 크롬(navigation, 사이드바, 장식)은 최소.
2. **장식 없음** — 그림자/애니메이션/배경 장식을 기본값으로 사용하지 않는다. 의미 있는 곳만.
3. **개인 사이트지만 공공 문서처럼 신중** — SaaS 랜딩 클리셰 금지. 학술 논문/노트북/위키에 가까운 톤.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| `backdrop-filter: blur()` | glass morphism은 AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| box-shadow 글로우 애니메이션 | 네온 글로우 = AI 슬롭 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 `rounded-2xl` | 균일한 둥근 모서리는 템플릿 느낌 |
| 배경 gradient orb (`blur-3xl` 원형) | 모든 AI 랜딩 페이지에 있는 장식 |

## 색상 (v0.1 라이트 테마)
Tailwind v4 CSS 변수로 정의 (`theme-default/src/styles/tokens.css`).

### 배경
| 용도 | 값 |
|------|------|
| 페이지 | `#fafafa` |
| 카드/aside | `#ffffff` |
| 코드 블록 | `#f4f4f5` |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 본문 | `#18181b` (`zinc-900`) |
| 제목 | `#09090b` (`zinc-950`) |
| 보조 | `#52525b` (`zinc-600`) |
| 비활성/메타 | `#a1a1aa` (`zinc-400`) |
| 링크 | `#2563eb` (`blue-600`) |
| 링크 hover | `#1d4ed8` (`blue-700`) |
| 링크 underline | `underline decoration-1 underline-offset-2` |

### 시맨틱
| 용도 | 값 |
|------|------|
| 긍정/audit pass | `#16a34a` (`green-600`) |
| 경고/warn | `#d97706` (`amber-600`) |
| 에러 | `#dc2626` (`red-600`) |
| 중립 border | `#e4e4e7` (`zinc-200`) |

다크모드는 v0.2.

## 컴포넌트
### 노트 카드 / aside (embed 블록)
```
rounded-md bg-white border border-zinc-200 p-4
```
임베드 표시용 왼쪽 리본: `border-l-2 border-zinc-300 pl-3`.

### 태그 칩
```
inline-flex items-center px-2 py-0.5 rounded text-xs
bg-zinc-100 text-zinc-600 hover:bg-zinc-200
```

### 버튼 (거의 없음)
```
Primary: rounded bg-zinc-900 text-white px-3 py-1.5 hover:bg-zinc-800
Text:    text-zinc-500 hover:text-zinc-900 underline-offset-2 hover:underline
```

### 입력 필드 (MVP에서 거의 없음)
```
rounded border border-zinc-300 px-3 py-2 focus:border-blue-600 focus:outline-none
```

## 레이아웃
- 전체 너비: 본문 `max-w-3xl`, 홈/태그 인덱스 `max-w-4xl`.
- 정렬: **좌측 정렬**. 중앙 정렬은 페이지 제목 외 금지.
- 간격: 섹션 간 `space-y-8`, 본문 단락 간 `space-y-4`.
- 모바일: `max-w-full px-4`, 데스크톱 `max-w-3xl mx-auto px-6`.

## 타이포그래피
| 용도 | 스타일 |
|------|--------|
| 페이지 제목 (h1) | `text-3xl font-semibold text-zinc-950 tracking-tight` |
| h2 | `text-xl font-semibold text-zinc-950 mt-10 mb-3` |
| h3 | `text-lg font-medium text-zinc-900 mt-6 mb-2` |
| 본문 | `text-base text-zinc-800 leading-relaxed` |
| 메타(날짜/저자) | `text-sm text-zinc-500` |
| 코드 (inline) | `font-mono text-sm bg-zinc-100 px-1 py-0.5 rounded` |
| 인용문 | `border-l-2 border-zinc-300 pl-4 text-zinc-600 italic` |

**폰트**: v0.1은 system font stack만.
```
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
             Roboto, "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
```
Pretendard/기타 웹폰트는 v0.2.

측정폭: 본문 `~65ch` (line-length 가독성 최적).
Line-height: 본문 1.7, 제목 1.25.

## 애니메이션
- 기본은 **애니메이션 없음**.
- 허용: 링크 hover의 color transition (150ms), 모바일 메뉴 슬라이드 (200ms).
- 금지: fade-in, slide-up, scroll-reveal 등 스크롤 기반 애니메이션.
- `prefers-reduced-motion` 존중.

## 아이콘
- SVG 인라인, `stroke-width: 1.5`, `currentColor` fill/stroke.
- 둥근 배경 박스로 감싸지 **않는다**.
- 출처: Lucide icons 또는 Heroicons outline — 구현 시점에 선택.

## 접근성
- 모든 인터랙티브 요소는 키보드 포커스 outline 유지 (제거 금지).
- semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`.
- 이미지 `alt` 필수. 없으면 빌드 경고.
- 색상 대비: WCAG AA (본문 텍스트/배경 4.5:1 이상).
- 스크린리더 텍스트: `sr-only` 유틸리티로 맥락 보강 (예: "외부 링크", "비공개 링크 자리").

## 레퍼런스 URL 포맷
- 내부 링크: `href="/projects/foo"` (상대 경로, trailing slash 없음).
- 외부 링크: `target="_blank" rel="noopener noreferrer"` + 작은 ↗ 아이콘 (선택).

## 404 페이지
- 제목: "해당 노트가 없거나 비공개입니다."
- 본문: 홈 링크 + 태그 인덱스 링크.
- **private 노트의 존재를 누설하지 않는 문구** — "삭제됨" 같은 표현 금지.
