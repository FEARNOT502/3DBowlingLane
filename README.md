# 🎳 3D Bowling Lane Oil Pattern Visualizer

볼링 레인 오일 패턴 시트(Kegel / FLEX)의 수치 데이터를 그대로 입력받아 웹 브라우저에서
**3D 레인 위에 렌더링·분석**하는 React 앱입니다. 패턴표의 그래프를 재현하는 **패턴표 모드**와
PBA 중계 화면 같은 **실제 레인 모드**를 모두 지원합니다.

> **Live demo**: https://fearnot502.github.io/3DBowlingLane/

## 기술 스택

- **React 18 + JavaScript** (Vite 5)
- **Three.js** + `@react-three/fiber` + `@react-three/drei`
- **Tailwind CSS**
- `pdfjs-dist` (패턴 시트 PDF 텍스트 추출 / 미리보기 렌더링)

## 실행 & 배포

```bash
npm install
npm run dev      # 개발 서버 (기본 http://localhost:5173)
npm run build    # 프로덕션 번들 → dist/
npm run preview  # 빌드 결과 로컬 확인
```

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로
빌드해서 **GitHub Pages**에 배포합니다. 저장소 *Settings → Pages → Source*를
**GitHub Actions**로 설정해 두면 됩니다. (`vite.config.js`의 `base: './'` 덕분에
프로젝트 서브패스에서도 그대로 동작합니다. 백엔드 없이 완전한 정적 사이트입니다.)

## 주요 기능

### 3D 레인
- 실제 규격(60ft × 39보드 ≈ 40.6") 기반 레인 — 가이드 도트(6ft), 타깃 화살표(12–16ft),
  레인지 파인더(34/40ft), 거터, 우드 핀덱과 10핀
- **레인 폭 배율** 슬라이더: 기본 5×(패턴표 그래프와 같은 비율), 1× = 실제 비율
- `OrbitControls`로 회전·확대·이동, 5ft 간격 거리 라벨, 패턴 끝(끝 Nft) 마커

### 오일 시각화 — 2가지 모드
- **패턴표 모드**: 인쇄된 시트의 3색 범례를 그대로 재현 — 색은 레이어 구성만 표시
  (Forward=시안, Reverse=블루, 겹침=네이비), 오일 **양은 높이**(displacement)로 표현
- **실제 레인 모드**: PBA 중계처럼 오일이 나무 위의 반투명 광택 글레이즈로 보이는 모드 —
  밀도를 부드럽게 압축(Reinhard)해 두꺼운 헤드 구간도 자연스럽게 깊어지고, 보드가 항상 비쳐 보임
- Forward / Reverse 레이어 토글, 불투명도·두께 슬라이더, 패턴 상하 반전 옵션

### 데이터 입력
- **표 붙여넣기**: `START STOP LOADS SPEED BUFFER [TANK] CROSSED START END FEET T.OIL`
  형식의 행을 그대로 붙여넣으면 파싱 (TANK 열·행 번호 유무 자동 인식)
- **PDF 가져오기**: 텍스트가 살아 있는 시트는 메타데이터·표를 자동 추출, 이미지형 시트는
  1페이지를 미리보기로 렌더링
- **AI 가져오기**: 이미지형 시트를 AI 챗에 넣어 변환한 텍스트를 붙여넣는 플로우 —
  결과는 `localStorage`에 저장되어 새로고침 후에도 "내 패턴" 목록에 유지
- 내장 샘플: **2026 JINSEUNG A TYPE** (45ft, 29.5 mL)

### 분석
- 보드별 오일 분포 스택 차트(시트 하단 차트와 동일 형식), 피크 보드, 실측 패턴 길이
- 시트의 Track Zone Ratio 표 표시 (머신 고유 알고리즘 값이므로 재계산하지 않음)

## 데이터 해석 규칙

### 보드 표기 (중요)
Kegel 표기는 **각 거터에서 안쪽으로 센 번호**입니다:

| 표기 | 의미 | 절대 보드 |
|------|------|-----------|
| `4L` | 왼쪽 거터에서 4번째 | 4 |
| `4R` | 오른쪽 거터에서 4번째 | 36 (= 40 − 4) |
| `20` | 센터 보드 | 20 |

따라서 `4L-4R`은 보드 4~36의 **넓은** 스팬, `14L-15R`은 보드 14~25의 **좁은** 스팬입니다.
시트의 `CROSSED = LOADS × 지나간 보드 수`로 검증됩니다.

### 오일 밀도 모델
각 패스는 보드 범위 × 거리 범위가 만드는 사각형에 오일을 도포한다고 보고,
해상도와 무관한 밀도(µl per board·foot)로 누적합니다:

```
density = T.OIL ÷ (보드 수 × 피트 길이)
```

- `T.OIL`이 없으면 `LOADS × 50µl × 보드 수`로 추정 (LOADS=0 이동 행은 오일 없음)
- 버퍼 브러시의 전폭 얇은 필름(파울라인→버프아웃)과 마지막 로드를 파울라인까지 끌고 가는
  드래그를 합성해 인쇄 그래프와 같은 형태를 재현
- 좌우로 가우시안 블러(≈2.2보드)를 적용해 브러시가 옆으로 번지는 어깨 그라데이션 표현
- 합산 오일 총량은 시트의 Forward/Reverse/Volume Total과 일치
  (JINSEUNG A: 19.05 / 10.45 / 29.5 mL)

## 구조

```
src/
  lib/
    laneConstants.js  레인 규격·그리드 해상도 상수
    boardUtils.js     L/R 보드 표기 ↔ 절대 보드(1~39) 변환
    parsePattern.js   시트 표 텍스트 파서
    oilModel.js       오일 밀도 그리드 계산 (버퍼 필름·드래그 포함)
    colorScale.js     밀도/레이어 → 색상 램프
    oilTexture.js     밀도 그리드 → 색상·변위 DataTexture (sheet/realistic)
    laneTexture.js    우드 레인·핀덱 캔버스 텍스처
    pdfImport.js      PDF 텍스트 추출·미리보기 렌더링
    aiImport.js       AI 변환 텍스트 파서 (프롬프트 템플릿 포함)
    storage.js        내 패턴 localStorage 저장
    analysis.js       보드별 분포·파생 통계
  components/
    Scene.jsx            Canvas·조명·OrbitControls
    Lane.jsx             레인·거터·핀·오일 표면·라벨·마커
    Sidebar.jsx          컨트롤 패널
    Legend.jsx           색상 범례
    BoardProfileChart.jsx 보드별 분포 차트
  data/samplePatterns.js  내장 샘플 패턴
```
