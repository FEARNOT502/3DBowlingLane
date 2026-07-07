# Handoff: "Studio White" 리디자인 (1a)

## Overview
`3DBowlingLane` (Lane Oil Pattern 3D) 앱의 **전체 셸 리스타일링**입니다. 기능·데이터·상태 로직은 그대로 두고, **비주얼만** 여백이 넓은 미니멀 "스튜디오 화이트" 방향으로 바꾸는 작업입니다. 왼쪽 슬림 사이드바 + 3D 캔버스 + 떠 있는 툴바 레이아웃을 유지합니다.

## About the Design Files
이 번들의 `Bowling Redesign Wireframes.dc.html`는 **HTML로 만든 디자인 레퍼런스**입니다 — 최종 look & feel을 보여주는 프로토타입이지 그대로 복붙할 프로덕션 코드가 아닙니다. 작업은 이 디자인을 **기존 코드베이스(React + Tailwind CSS)의 컴포넌트에 재현**하는 것입니다. 파일 안에는 세 방향(1a/1b/1c)이 들어 있고, **이번 대상은 `1a` "스튜디오 화이트"** 하나입니다. 1b/1c는 무시하세요.

## Fidelity
**Low-fi 와이어프레임 + 확정된 컬러/타이포 토큰.** 레이아웃·간격은 가이드로 쓰고, 아래 Design Tokens의 색·폰트·라운드 값은 그대로 적용하세요. 픽셀 단위 복제가 아니라 "기존 UI를 이 톤으로 정리"하는 리스타일입니다.

## ⚠️ 가장 중요한 제약 — 데이터/로직 불변
사이드바(패턴 탭)에 표시되는 **모든 정보와 필드는 현재 코드 그대로**입니다. 새 필드·새 상태·새 prop을 만들지 마세요. 기존 컴포넌트의 데이터 바인딩(`patterns`, `activeId`, `meta`, `totals`, `savedPatterns`, 핸들러들)을 유지하고 **className/마크업 스타일만** 교체합니다.
- `patterns.map(p => …)` → 샘플 패턴 칩 (그대로)
- `meta.distance` → Oil Pattern Distance 입력 (그대로)
- `totals.combinedMl / forwardMl / reverseMl` → Volume / Forward / Reverse 스탯 (그대로)
- `MetaList rows=[…]` → 시트 전체 값 (그대로)
- AI 가져오기 / PDF 드롭 / 내 패턴 블록 (그대로)

## Screens / Views

### App Shell (`src/App.jsx`)
- **Layout**: 세로 flex. 상단 헤더(높이 ~80px) + 아래 좌우 분할(사이드바 `width: 298px` + 캔버스 `flex:1`).
- **Header**: 흰 배경 `#fff`, 하단 보더 `#eeeae2`, 패딩 `22px 32px`.
  - 로고 마크: 36×36, `border-radius:10px`, 배경 인디고 `oklch(0.55 0.13 262)`.
  - 타이틀 "Lane Oil Pattern 3D" `18px / 600 / letter-spacing:-.02em / #1c1b1a`, 서브 "오일 패턴 시각화 · 분석" `12px #a29c92`.
  - 우측: "공유" 아웃라인 버튼(보더 `#e6e1d8`, 라운드 9px) + 테마 토글 아이콘 버튼 38×38.

### Sidebar — 패턴 탭 (`src/components/tabs/PatternTab.jsx` + `ControlPanel.jsx`)
- **Container**: `width:298px`, 배경 `#fff`, 우측 보더 `#eeeae2`. 상단에 탭바(고정), 아래 스크롤 영역.
- **Tab bar**: pill 그룹. 트랙 배경 `#f4f1eb`, `border-radius:12px`, 패딩 5px. 활성 탭(패턴)은 흰 배경 + 그림자 + 텍스트 인디고 `oklch(0.55 0.13 262)`; 비활성은 `#a8a297`, `12px/600`. 순서: 패턴 · 보기 · 플레이 · 분석.
- **섹션 헤더 공통**: `10px / 600 / letter-spacing:.14em / #bdb7ac` (예: "패턴 불러오기", "샘플 패턴", "패턴 정보", "시트 전체 값").
- **AI 가져오기 카드**: 보더 `#ece7dd` 라운드 12px. 헤더 바 연한 그라데이션 `linear-gradient(90deg,#f2f4ff,#f4f1fb)` + 텍스트 `oklch(0.5 0.13 262)`. 본문: "변환 프롬프트 복사"(연베이지 `#f4f1eb` 버튼) → 모노 텍스트영역(플레이스홀더 `=== PATTERN ===`) → "패턴으로 불러오기"(인디고 채운 버튼).
- **PDF 행**: 보더 `#ece7dd` 라운드 10px, 한 줄 "▸ PDF에서 가져오기" `12px #6b665c`.
- **샘플 패턴 칩**: pill. 활성 = 인디고 채움 + 흰 글씨 + 그림자; 비활성 = 흰 배경 + 보더 `#e6e1d8` + `#6b665c`. `12px/500~600`, 라운드 999px, 패딩 `6px 12px`.
- **패턴 정보**:
  - Distance 행: 라벨 "Oil Pattern Distance" `12px #6b665c` + 값 박스(모노 `14px/700`, 보더 `#e6e1d8`, 라운드 8px) + "ft".
  - 스탯 3열 그리드 gap 8px. 각 타일 보더 `#f0ebe1` 라운드 10px. **Forward 타일 상단 보더 `2px #0891b2`**, **Reverse 타일 상단 보더 `2px #2563eb`**, Volume은 액센트 없음. 라벨 `9px/600` 대문자, 값 모노 `18px/700 #1c1b1a` + 단위 `10px #c2bbab`.
  - 이 액센트 색(`#0891b2` cyan / `#2563eb` blue)은 **기존 `Stat` 컴포넌트의 `accent` prop 값 그대로**입니다.
- **시트 전체 값 (MetaList)**: 행마다 좌 라벨 `12px #8a857b` + 우 값 모노 `12px/600 #1c1b1a`, 행 사이 보더 `#f4f0e8`.
- 스크롤 영역 하단에 `linear-gradient(#fff0,#fff)` 페이드 36px.

### Canvas (`src/components/…` 3D 뷰포트 래퍼)
- 배경 `#f6f4f0`. Three.js 3D 렌더는 **그대로 유지** (프로토타입의 2D SVG는 참고용 단순화일 뿐, 실제 3D를 2D로 바꾸지 마세요).
- **떠 있는 툴바**(하단 중앙): 흰 배경, 보더 `#eae5db`, 라운드 14px, 그림자 `0 6px 22px rgba(40,40,60,.1)`. 안에 패턴표/실제 세그먼트 토글 + F·R 레이어 토글 + 라벨·핀 토글.
- **패턴 요약 칩**(좌상단): 흰 카드, 패턴명 + `45 ft · 29.5 mL`.
- **볼 인스펙터**(우상단): 폭 ~104px 흰 카드, 원형 볼 프리뷰.

## Interactions & Behavior
기존 동작 그대로 유지. 시각적 상태만 추가:
- 탭 전환: 활성 pill 흰 배경 + 그림자로 이동.
- 버튼 hover: 아웃라인 버튼은 보더/텍스트를 인디고 계열로, 채운 버튼은 미세 밝기 변화.
- 스탯/칩 active: `scale(0.98)` (기존 Tailwind `active:scale-[0.98]` 유지).
- 다크 모드: 기존 `dark:` variant 유지. 라이트 팔레트만 위 토큰으로 교체.

## State Management
**변경 없음.** 기존 store/상태(`activeId`, `meta`, `totals`, `savedPatterns`, `aiText`, `importing` 등)와 핸들러를 그대로 사용. 새 상태 도입 금지.

## Design Tokens
| 용도 | 값 |
|---|---|
| 앱 배경 / 캔버스 | `#f6f4f0` |
| 서피스(카드·헤더·사이드바) | `#fff` |
| 서브 서피스 | `#faf8f4` / `#f4f1eb` (pill 트랙) |
| 보더(강) | `#eeeae2` · `#e6e1d8` |
| 보더(약·구분선) | `#f1ede6` · `#f4f0e8` · `#f0ebe1` |
| 텍스트 강 | `#1c1b1a` |
| 텍스트 중 | `#4b463e` · `#6b665c` |
| 텍스트 약 | `#8a857b` · `#a8a297` |
| 텍스트 캡션 | `#bdb7ac` · `#c2bbab` |
| **프라이머리 액센트(인디고)** | `oklch(0.55 0.13 262)` (≈ `#5b6ee0`), 진한 텍스트용 `oklch(0.5 0.13 262)` |
| 스탯 Forward | `#0891b2` (기존 값) |
| 스탯 Reverse | `#2563eb` (기존 값) |
| 라운드 | pill/트랙 12px · 카드 12–14px · 인풋/작은 요소 8–10px · 칩 999px |
| 그림자(툴바/카드) | `0 6px 22px rgba(40,40,60,.1)` · 로고/작은 `0 1px 3px rgba(0,0,0,.06)` |
| 폰트 | UI: 산세리프(기존 그대로) · 숫자/코드: **모노스페이스** (`font-mono`, tabular-nums) |
| 타이포 스케일 | 섹션헤더 10px/600/tracking .14em · 본문 12–13px · 스탯값 18px/700 · 타이틀 18–20px/600 |

> 프로토타입은 폰트로 Space Grotesk / Space Mono를 썼지만, **기존 코드베이스의 폰트 스택을 유지**하세요. 중요한 건 "UI는 산세리프, 숫자는 모노 + tabular-nums" 규칙입니다.

## Assets
새 에셋 없음. 로고 마크는 CSS로 그린 도형. 아이콘은 기존 `src/components/icons.jsx` 재사용.

## Files
- `Bowling Redesign Wireframes.dc.html` — 디자인 레퍼런스(1a가 대상, 화면 최상단 섹션). 브라우저로 바로 열림.
- 구현 대상(기존 repo): `src/App.jsx`, `src/components/ControlPanel.jsx`, `src/components/Toolbar.jsx`, `src/components/tabs/PatternTab.jsx`, `src/components/ui.jsx`.
