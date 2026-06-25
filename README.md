# 🎳 Bowling Lane Oil Pattern 3D Visualizer

볼링 레인 오일 패턴 시트(Kegel / FLEX)의 수치 데이터를 입력받아 웹 브라우저에서
**3D 히트맵**으로 렌더링하고 분석하는 React 애플리케이션입니다.

## 기술 스택

- **React 18 + JavaScript** (Vite)
- **Three.js** + `@react-three/fiber` + `@react-three/drei`
- **Tailwind CSS**

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 프로덕션 번들
```

## 주요 기능

### 3D 레인
- **실제 규격 비율**(길이 60ft × 폭 ~3.39ft = 39보드)의 가늘고 긴 레인 모델
- 파울 라인이 카메라 쪽(near), 핀이 먼 쪽(far)에 오도록 다운레인 시점으로 배치
- 우드 텍스처/보드 라인/타깃 화살표/거터 + **10핀 볼링핀**(핀덱)
- `OrbitControls` — 마우스·터치로 확대/축소·360° 회전·이동
- 패턴 끝(Oil Pattern Distance) 위치를 레인 위에 마커로 표시
- "레인 폭 배율" 슬라이더로 분석 시 폭을 과장 표시(기본 1× = 실제 비율)

### 오일 시각화 (히트맵)
- 오일 밀도를 GPU `DataTexture`로 만들어 평면에 입힙니다.
- 색상: 얇으면 옅은 하늘색 → 두꺼우면 짙은 파란색/네이비
- **3D 두께 강조** 슬라이더: `displacementMap`으로 오일층을 실제 높이로 솟아오르게 표현
- **레이어 토글**: `Forward`(시안) / `Reverse`(블루)를 각각 켜고 끄며, 둘 다 켜면 `Combined`(네이비)
- 불투명도 슬라이더, 라벨 on/off

### 데이터 입력 & 파싱
- 사이드바에 시트의 `START STOP LOADS SPEED BUFFER [TANK] CROSSED START END FEET T.OIL` 표를
  그대로 붙여넣으면 파싱합니다. (TANK 컬럼 유무 자동 인식, 행 번호 유무 무관)
- 샘플 패턴 2종 내장: **2026 KBA 40**, **2026 JINSEUNG A TYPE**
- 보드 표기 `2L`·`2R`은 중앙(20번 보드) 기준으로 절대 보드(1~39)로 변환

### 분석
- 보드별 오일 분포 막대그래프(시트 하단 차트와 동일한 형식, Forward/Reverse 스택)
- 피크 보드, 실측 패턴 길이, 중앙:트랙 비율(파생)
- 시트의 Track Zone Ratio 표 표시

## 오일 밀도 모델

각 패스(pass)는 보드 범위(START→STOP)와 거리 범위(START ft→END ft)가 만드는 사각형 영역에
오일을 도포한다고 보고, 해상도와 무관한 **밀도**(µl per board·foot)로 모델링합니다.

```
density = T.OIL ÷ (보드 수 × 피트 길이)
```

- 오일량은 측정값 `T.OIL`을 사용하며, 값이 없으면 `LOADS × 50µl × 보드 수`로 추정합니다.
- 버퍼 `SPEED`가 빠를수록 같은 양이 더 긴 피트에 퍼지므로(피트 길이 ↑) 자연스럽게 얇아집니다.
- 모든 패스를 누적하면 중앙이 두꺼운 전형적인 "하우스" 단면이 재현됩니다.

> 합산된 오일 총량은 시트의 Forward/Reverse/Volume Total과 정확히 일치합니다
> (KBA 40: 18.3 / 9.8 / 28.1 mL, JINSEUNG A: 19.05 / 10.45 / 29.5 mL).
> Track Zone Ratio는 머신 고유 알고리즘 값이므로 재계산하지 않고 시트 값을 그대로 표시합니다.

## 구조

```
src/
  lib/
    laneConstants.js  레인 규격·그리드 해상도 상수
    boardUtils.js     L/R 보드 표기 ↔ 절대 보드 변환
    parsePattern.js   시트 표 텍스트 파서
    oilModel.js       오일 밀도 그리드 계산
    colorScale.js     밀도 → 색상 램프
    oilTexture.js     밀도 그리드 → 색상/변위 DataTexture
    laneTexture.js    우드 레인 캔버스 텍스처
    analysis.js       보드별 분포·파생 통계
  components/
    Scene.jsx           Canvas·조명·OrbitControls
    Lane.jsx            우드 레인·거터·오일 표면·라벨·마커
    Sidebar.jsx         컨트롤 패널 전체
    Legend.jsx          색상 범례
    BoardProfileChart.jsx  보드별 분포 차트
  data/samplePatterns.js  내장 샘플 패턴 2종
```
