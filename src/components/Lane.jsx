import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { makeLaneTexture, makeDeckTexture } from '../lib/laneTexture.js';
import { buildOilTextures } from '../lib/oilTexture.js';
import BallPath from './BallPath.jsx';
import {
  BOARD_COUNT,
  FEET_SAMPLES,
  LANE_LENGTH_FEET,
  LANE_WIDTH_INCH,
} from '../lib/laneConstants.js';

// Layout: foul line | 60 ft lane: 6 ft dots + arrows + range finders | pin deck.
// Foul line at +Z (near the bowler/camera), pins at -Z.
const LANE_LEN = 40; // foul line -> head pin (represents 60 ft)
// widthScale = 1 shows the lane at TRUE proportions: a real lane is ~40.6"
// (39 boards × 1.0417") wide over 60 ft = 720" long — width/length ≈ 0.0564.
// The scene maps 60 ft to LANE_LEN world units, so the true-scale width follows
// directly from that ratio (≈ 2.26 units). The 레인 폭 배율 slider widens it
// for analysis views.
const BASE_WIDTH = LANE_LEN * (LANE_WIDTH_INCH / (LANE_LENGTH_FEET * 12));
const FOUL_Z = LANE_LEN / 2; // 20
const feetToZ = (ft) => FOUL_Z - (ft / LANE_LENGTH_FEET) * LANE_LEN;

// ---- Bowling pin (lathe profile, normalised height ~1.25) ----------------
// Proportions follow the regulation pin: 38.1 cm (15") tall, 12.1 cm max
// diameter at the belly -> max radius ≈ 0.159 × height (0.199 on a 1.25 profile).
const PIN_PROFILE = [
  [0.0, 0.0],
  [0.105, 0.0],
  [0.115, 0.05],
  [0.145, 0.2],
  [0.18, 0.36],
  [0.199, 0.5],
  [0.18, 0.62],
  [0.128, 0.78],
  [0.078, 0.9],
  [0.1, 1.0],
  [0.11, 1.07],
  [0.092, 1.15],
  [0.05, 1.22],
  [0.0, 1.25],
].map(([r, y]) => new THREE.Vector2(r, y));

// 10-pin triangle: [lateral offset (in pin-spacing units), row index].
// Head pin (row 0) nearest the bowler; rows step back toward the pit.
const PIN_LAYOUT = [
  [0, 0],
  [-0.5, 1],
  [0.5, 1],
  [-1, 2],
  [0, 2],
  [1, 2],
  [-1.5, 3],
  [-0.5, 3],
  [0.5, 3],
  [1.5, 3],
];
const PIN_HEIGHT_INCH = 15; // regulation pin height (38.08 cm)
const PIN_SPACING_INCH = 12; // centre-to-centre pin spacing (30.48 cm)
// Rows of an equilateral triangle: 12" × sin 60° ≈ 10.39" front-to-back.
const PIN_ROW_DEPTH_INCH = PIN_SPACING_INCH * Math.sin(Math.PI / 3);

// Real pin geometry derived from the lane width so proportions always match:
// head pin centred at 60 ft, 12" between pin centres (7-10 back row spans 36",
// leaving ~2.3" to each gutter, like a real pin deck).
function usePinDims(halfWidth) {
  const unitPerInch = (halfWidth * 2) / LANE_WIDTH_INCH;
  const rowDepth = PIN_ROW_DEPTH_INCH * unitPerInch;
  return {
    scale: (PIN_HEIGHT_INCH * unitPerInch) / 1.25,
    spacing: PIN_SPACING_INCH * unitPerInch,
    rowDepth,
    headZ: feetToZ(60),
    // pin-deck depth: the pin triangle plus ~12" of room behind the back row
    deckDepth: rowDepth * 3 + 12 * unitPerInch,
  };
}

function Pins({ halfWidth }) {
  const pinGeo = useMemo(() => new THREE.LatheGeometry(PIN_PROFILE, 24), []);
  useEffect(() => () => pinGeo.dispose(), [pinGeo]);
  const { scale, spacing, rowDepth, headZ } = usePinDims(halfWidth);
  return (
    <group>
      {PIN_LAYOUT.map(([lat, row], i) => {
        const x = lat * spacing;
        const z = headZ - row * rowDepth;
        return (
          <group key={i} position={[x, 0, z]} scale={scale}>
            <mesh geometry={pinGeo}>
              <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.05} />
            </mesh>
            {[0.96, 1.04].map((sy) => (
              <mesh key={sy} position={[0, sy, 0]} rotation-x={Math.PI / 2}>
                <torusGeometry args={[0.1, 0.013, 8, 20]} />
                <meshStandardMaterial color="#dc2626" roughness={0.3} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// Pin deck: the platform behind the 60 ft mark that carries the pin triangle.
// It continues the lane's 39-board texture so the boards run seamlessly under
// the pins (the lane surface itself ends at 60 ft where the head pin stands).
function PinDeck({ width }) {
  const { headZ, deckDepth } = usePinDims(width / 2);
  const tex = useMemo(() => makeDeckTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, headZ - deckDepth / 2]} receiveShadow>
      <planeGeometry args={[width, deckDepth]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

function WoodLane({ width }) {
  const tex = useMemo(() => makeLaneTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[width, LANE_LEN, 1, 1]} />
      <meshStandardMaterial map={tex} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

function FoulLine({ width }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, FOUL_Z]}>
      <planeGeometry args={[width, Math.max(0.1, width * 0.04)]} />
      <meshStandardMaterial color="#b91c1c" emissive="#7f1d1d" emissiveIntensity={0.3} />
    </mesh>
  );
}

function Gutters({ width }) {
  const half = width / 2;
  // Real gutters are ~9.25" wide; size them from the lane width so the
  // proportions hold at any width scale. They run past the 60 ft mark
  // alongside the pin deck, like real lanes.
  const unitPerInch = width / LANE_WIDTH_INCH;
  const gw = 9.25 * unitPerInch;
  const gh = gw * 0.32;
  const { deckDepth } = usePinDims(half);
  const len = LANE_LEN + deckDepth;
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (half + gw / 2), -gh / 2 - 0.01, -deckDepth / 2]}>
          <boxGeometry args={[gw, gh, len]} />
          <meshStandardMaterial color="#0b1326" roughness={0.85} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

// The printed graph tints its whole field a soft periwinkle from the foul line
// out to the pattern distance — a visual cue for how far the oil (and buffer
// film) runs down-lane. Sheet mode copies the print: a near-UNIFORM wash that
// simply stops at `fadeFeet`. Realistic mode keeps a subtle fading tint instead.
function BackgroundTint({ width, fadeFeet = 45, oilMode = 'sheet' }) {
  const sheet = oilMode !== 'realistic';
  const tex = useMemo(() => {
    const w = 2;
    const h = FEET_SAMPLES;
    const data = new Uint8Array(w * h * 4);
    const endRow = Math.round((fadeFeet / LANE_LENGTH_FEET) * FEET_SAMPLES);
    const tailRows = 8; // ~2 ft soft stop at the pattern end (sheet mode)
    for (let row = 0; row < h; row += 1) {
      let k;
      if (sheet) {
        // Uniform wash until fadeFeet, easing out over the last couple of feet.
        k = row >= endRow ? 0 : Math.min(1, (endRow - row) / tailRows);
        k *= 0.34;
      } else {
        k = (endRow > 0 ? Math.max(0, 1 - row / endRow) : 0) * 0.18;
      }
      const alpha = Math.round(k * 255);
      for (let x = 0; x < w; x += 1) {
        const o = (row * w + x) * 4;
        data[o] = 168; // periwinkle
        data[o + 1] = 182;
        data[o + 2] = 240;
        data[o + 3] = alpha;
      }
    }
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [fadeFeet, sheet]);
  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, 0]} renderOrder={-1}>
      <planeGeometry args={[width, LANE_LEN]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function OilSurface({ width, grid, max, layer, components, thickness, opacity, oilMode }) {
  const relief = thickness > 0;
  const { colorTex, dispTex } = useMemo(
    () => buildOilTextures(grid, max, layer, components, oilMode, relief),
    [grid, max, layer, components, oilMode, relief]
  );
  useEffect(
    () => () => {
      colorTex.dispose();
      dispTex.dispose();
    },
    [colorTex, dispTex]
  );

  const realistic = oilMode === 'realistic';
  // Relief height scales with the lane width so the oil slab keeps the same
  // visual proportion whether the lane is at true scale or widened for analysis.
  // Realistic mode keeps only a hint of relief: a real oil film is microns thick,
  // and a tall slab's shaded side walls read as dark smears around the block.
  const dispScale = thickness * (width / 9.1) * (realistic ? 0.15 : 1);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
      <planeGeometry args={[width, LANE_LEN, BOARD_COUNT, FEET_SAMPLES]} />
      {realistic ? (
        // Real-lane oil: a lit, glossy wet film. Low-ish metalness — with no
        // environment map, high metalness just turns the film black.
        <meshStandardMaterial
          map={colorTex}
          transparent
          opacity={opacity}
          displacementMap={thickness > 0 ? dispTex : null}
          displacementScale={dispScale}
          depthWrite={false}
          roughness={0.12}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      ) : (
        // Sheet mode: the print's flat legend colours must come out EXACTLY —
        // scene lights + ACES tone mapping wash navy into grey. Emitting the
        // texture (black base colour, white emissive) makes it unlit, and
        // toneMapped={false} bypasses the tone curve. `map` still supplies alpha.
        <meshStandardMaterial
          map={colorTex}
          color="#000000"
          emissive="#ffffff"
          emissiveMap={colorTex}
          toneMapped={false}
          transparent
          opacity={opacity}
          displacementMap={thickness > 0 ? dispTex : null}
          displacementScale={dispScale}
          depthWrite={false}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
        />
      )}
    </mesh>
  );
}

// Right-hand feet scale — the only floating labels kept besides the
// pattern-end marker (per user request).
function FeetLabels({ width }) {
  const half = width / 2;
  const feetMarks = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  return (
    <group>
      {feetMarks.map((ft) => (
        // No distanceFactor: labels keep a constant on-screen size regardless of
        // zoom or the lane width scale, so the scale reads like a clean ruler.
        <Html key={ft} position={[half + 1, 0.1, feetToZ(ft)]} center occlude={false} zIndexRange={[10, 0]}>
          <div className="select-none whitespace-nowrap rounded-md border border-slate-200 bg-white/90 px-1.5 py-px font-mono text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/85 dark:text-sky-200">
            {ft}ft
          </div>
        </Html>
      ))}
    </group>
  );
}

// Thin cross-lane cursor showing where the 분석 tab's cross-section slider sits.
function SliceIndicator({ feet, width, lift = 0.045 }) {
  if (feet == null || feet < 0 || feet > LANE_LENGTH_FEET) return null;
  const half = width / 2;
  return (
    <group>
      <mesh position={[0, lift, feetToZ(feet)]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[width, 0.1]} />
        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={0.55} />
      </mesh>
      <Html position={[-(half + 1.1), 0.1, feetToZ(feet)]} center zIndexRange={[10, 0]}>
        <div className="select-none whitespace-nowrap rounded-md bg-cyan-400 px-1.5 py-px font-mono text-[10px] font-semibold text-slate-900 shadow-sm">
          단면 {feet.toFixed(2).replace(/\.?0+$/, '')}ft
        </div>
      </Html>
    </group>
  );
}

function DistanceMarker({ distance, width }) {
  if (!distance || distance <= 0 || distance > LANE_LENGTH_FEET) return null;
  const half = width / 2;
  return (
    <group>
      <mesh position={[0, 0.05, feetToZ(distance)]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[width, 0.16]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6} />
      </mesh>
      <Html position={[-(half + 1.1), 0.1, feetToZ(distance)]} center zIndexRange={[10, 0]}>
        <div className="select-none whitespace-nowrap rounded-md bg-amber-400 px-1.5 py-px font-mono text-[10px] font-semibold text-slate-900 shadow-sm">
          끝 {distance}ft
        </div>
      </Html>
    </group>
  );
}

export default function Lane({
  grid,
  max,
  layer,
  components,
  thickness,
  opacity,
  showOil,
  showLabels,
  showPins,
  widthScale = 1,
  patternDistance,
  oilMode = 'sheet',
  ballSim,
  showPath,
  replayKey,
  ballPlaying,
  ballPlaySpeed,
  ballClockRef,
  ballScrub = null,
  sliceFeet,
  showSlice,
}) {
  const width = BASE_WIDTH * widthScale;
  // Keep the shot overlay above the displaced oil relief (same scale factor
  // the OilSurface uses for its displacement map).
  const pathLift = 0.08 + 0.55 * thickness * (width / 9.1) * (oilMode === 'realistic' ? 0.15 : 1);
  return (
    <group>
      <WoodLane width={width} />
      <FoulLine width={width} />
      <Gutters width={width} />
      {showOil && layer !== 'none' && (
        <>
          <BackgroundTint width={width} fadeFeet={patternDistance || 45} oilMode={oilMode} />
          <OilSurface
            width={width}
            grid={grid}
            max={max}
            layer={layer}
            components={components}
            thickness={thickness}
            opacity={opacity}
            oilMode={oilMode}
          />
        </>
      )}
      {showPins && (
        <>
          <PinDeck width={width} />
          <Pins halfWidth={width / 2} />
        </>
      )}
      {ballSim && (
        <BallPath
          sim={ballSim}
          width={width}
          feetToZ={feetToZ}
          lift={pathLift}
          replayKey={replayKey}
          showLine={showPath}
          playing={ballPlaying}
          playSpeed={ballPlaySpeed}
          clockRef={ballClockRef}
          scrub={ballScrub}
        />
      )}
      {showSlice && <SliceIndicator feet={sliceFeet} width={width} lift={pathLift} />}
      {showLabels && (
        <>
          <FeetLabels width={width} />
          <DistanceMarker distance={patternDistance} width={width} />
        </>
      )}
    </group>
  );
}
