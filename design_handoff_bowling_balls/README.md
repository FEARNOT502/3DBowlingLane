# Handoff: 볼링공 커버스톡 3종 (파란 베이스)

## Overview
3D 씬의 볼(`src/components/BallPath.jsx` 안 `FlareBall`)을 실물 볼링공처럼 보이게 하는 **파란 베이스 커버스톡 3종**입니다. 기존 단색 대리석 텍스처(`makeMarbleTexture`)를 대체하고, 광택(clearcoat)·펄·금속 플레이크·크랙 무늬를 각각 다르게 재현합니다. 그립 홀 3개 배치와 오일-트랙 링 로직은 **그대로 유지**합니다.

- **Cobalt Storm** (`cobaltStorm`) — 로열블루·청록·화이트 펄 하이글로스 마블 (레퍼런스에 가장 가까움, 기본값)
- **Midnight Flake** (`midnightFlake`) — 깊은 네이비 솔리드 + 금속 플레이크 새틴
- **Electric Ice** (`electricIce`) — 시안·코발트 위 흰 얼음 균열 초광택 펄

## About the Design Files
- `ballDesigns.js` — **바로 쓸 수 있는 실제 코드**입니다. `three@0.169` / R3F 환경에서 동작하며 `src/lib/ballDesigns.js` 로 넣으면 됩니다. (다른 핸드오프의 HTML 목업과 달리 이 파일은 프로덕션 드롭인입니다.)
- `Bowling Balls Showcase.dc.html` — 3종이 실제로 어떻게 보이는지 확인하는 3D 미리보기(회전). 브라우저로 바로 열림. 참고용.

## 통합 방법 (3단계)

### 1) 파일 추가
`ballDesigns.js` 를 `src/lib/ballDesigns.js` 로 복사.

### 2) `BallPath.jsx` — 텍스처·재질 교체
현재 `makeMarbleTexture` 정의는 **삭제하거나 그대로 둬도 되지만**, `FlareBall` 이 새 텍스처를 쓰게 바꿉니다.

**import 추가 (파일 상단):**
```js
import { makeBallTexture, BALL_DESIGNS, DEFAULT_DESIGN } from '../lib/ballDesigns.js';
```

**`FlareBall` 시그니처에 `design` prop 추가:**
```js
// 변경 전
export const FlareBall = forwardRef(function FlareBall({ sim, radius, clockRef }, ref) {
// 변경 후
export const FlareBall = forwardRef(function FlareBall({ sim, radius, clockRef, design = DEFAULT_DESIGN }, ref) {
```

**텍스처 생성 교체 (`FlareBall` 안):**
```js
// 변경 전
const marbleTex = useMemo(() => makeMarbleTexture(), []);
// 변경 후
const marbleTex = useMemo(() => makeBallTexture(design), [design]);
```

**재질 교체 — 광택이 살아나도록 meshStandardMaterial → meshPhysicalMaterial:**
```jsx
// 변경 전
<sphereGeometry args={[radius, 48, 48]} />
<meshStandardMaterial map={marbleTex} roughness={0.14} metalness={0.12} />

// 변경 후
<sphereGeometry args={[radius, 64, 64]} />
<meshPhysicalMaterial
  map={marbleTex}
  {...BALL_DESIGNS[design].mat}   /* roughness / metalness / clearcoat / clearcoatRoughness */
  envMapIntensity={1.1}
/>
```
> clearcoat 반사가 제대로 보이려면 씬에 **환경맵**이 있어야 합니다. `src/components/Scene.jsx` 에 이미 `<Environment>`(drei) 가 있으면 그대로 충분합니다. 없다면 drei 의 `<Environment preset="city" />` 또는 `<Environment preset="studio" />` 를 Canvas 안에 한 줄 추가하세요 (`import { Environment } from '@react-three/drei'`).

### 3) `design` prop 을 위로 전달
`FlareBall` → `RollingBall` → `BallPath` 로 prop 을 이어줍니다.

**`RollingBall`:** props 에 `design` 추가하고 자식에 전달
```jsx
function RollingBall({ /* …기존… */, clockRef, scrub = null, design }) {
  /* … */
  return (
    <group ref={group}>
      <FlareBall ref={flareRef} sim={sim} radius={radius} clockRef={clockRef} design={design} />
    </group>
  );
}
```

**`BallPath` (default export):** props 에 `design = DEFAULT_DESIGN` 추가하고 `<RollingBall … design={design} />` 로 전달.

**호출부(`Scene.jsx` 등에서 `<BallPath … />`):** 선택된 커버스톡을 넘김
```jsx
<BallPath /* …기존 props… */ design={design} />
```
`design` 값은 앱 상태(스토어/부모 state)에서 관리하세요. 기본값 `'cobaltStorm'` 이면 아무 것도 안 바꿔도 예전처럼 동작합니다.

## (선택) 커버스톡 선택 UI
`플레이` 또는 `보기` 탭에 3-옵션 세그먼트를 추가해 `design` 을 바꾸게 하면 됩니다. `BALL_DESIGNS` 를 순회해 칩을 그리세요:
```jsx
{Object.values(BALL_DESIGNS).map((d) => (
  <button key={d.id} onClick={() => setDesign(d.id)}
    className={design === d.id ? '…active…' : '…'}>
    {d.korName}
  </button>
))}
```
기존 탭의 칩 스타일(`PatternTab.jsx` 의 샘플 패턴 pill)을 그대로 재사용하면 일관됩니다.

## Design Tokens (재질 파라미터)
| 디자인 | roughness | metalness | clearcoat | ccRoughness | 특징 |
|---|---|---|---|---|---|
| Cobalt Storm | 0.12 | 0.35 | 1.0 | 0.08 | 펄 마블, 하이글로스 |
| Midnight Flake | 0.30 | 0.60 | 0.5 | 0.22 | 솔리드 + 금속 플레이크(sparkle) |
| Electric Ice | 0.07 | 0.20 | 1.0 | 0.03 | 흰 크랙, 초광택 |

베이스 팔레트·무늬 색은 `ballDesigns.js` 의 `base` / `veins` / `sparkle` 배열에 그대로 있습니다. 색을 바꾸고 싶으면 그 배열만 편집하면 됩니다.

## 주의
- **그립 홀·오일 트랙 링·물리(ballMotion) 로직은 건드리지 마세요.** 이번 작업은 커버스톡 외형(텍스처+재질)뿐입니다.
- `sphereGeometry` 세그먼트를 48→64 로 올리면 하이글로스에서 실루엣이 더 매끈합니다(선택).
- 텍스처는 볼마다 `dispose()` 되도록 기존 `useEffect(() => () => marbleTex.dispose(), [marbleTex])` 를 유지하세요.

## Files
- `ballDesigns.js` → `src/lib/ballDesigns.js` (드롭인)
- `Bowling Balls Showcase.dc.html` — 3D 미리보기(참고용)
- 수정 대상: `src/components/BallPath.jsx`, `src/components/Scene.jsx`

---

## 클로드 코드에 붙여넣을 프롬프트

```
src/lib/ballDesigns.js 를 추가했어. 이 파일의 makeBallTexture / BALL_DESIGNS 를 써서
3D 볼(FlareBall)의 커버스톡을 파란 베이스 3종(cobaltStorm / midnightFlake / electricIce)
중에서 고를 수 있게 해줘.

- src/components/BallPath.jsx 에서 기존 makeMarbleTexture() 대신 makeBallTexture(design) 를 쓰고,
  <meshStandardMaterial> 를 <meshPhysicalMaterial map={marbleTex} {...BALL_DESIGNS[design].mat}
  envMapIntensity={1.1}/> 로 바꿔줘. sphereGeometry 세그먼트는 64로.
- design prop 을 FlareBall → RollingBall → BallPath 로 이어서 전달하고,
  기본값은 DEFAULT_DESIGN('cobaltStorm') 으로 해서 아무것도 안 바꿔도 기존과 동일하게 동작하게 해줘.
- clearcoat 반사가 보이도록 Scene.jsx 의 Canvas 안에 환경맵(<Environment>)이 없으면
  @react-three/drei 의 <Environment preset="studio" /> 를 한 줄 추가해줘.
- 플레이 탭에 BALL_DESIGNS 를 순회하는 3-옵션 칩을 추가해서 design 을 바꾸게 해줘.
  칩 스타일은 PatternTab.jsx 의 샘플 패턴 pill 을 재사용해.
- 그립 홀, 오일 트랙 링, ballMotion 물리 로직은 절대 건드리지 마.

작업 후 브랜치(feature/ball-coverstocks) 만들어서 커밋해줘.
```
