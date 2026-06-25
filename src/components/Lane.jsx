import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { makeLaneTexture } from '../lib/laneTexture.js';
import { buildOilTextures } from '../lib/oilTexture.js';
import {
  BOARD_COUNT,
  FEET_SAMPLES,
  LANE_LENGTH_FEET,
  LANE_WIDTH_FEET,
} from '../lib/laneConstants.js';

// Layout follows the reference diagram (compressed length, "not to scale"):
//   foul line | 60 ft lane: release dots + 6 ft dots + arrows + gutters | pins
// 1 unit ~ proportional. Foul line at +Z (near the bowler/camera), pins at -Z.
const BASE_WIDTH = 13;
const LANE_LEN = 40; // foul line -> pins (represents 60 ft)
const FOUL_Z = LANE_LEN / 2; // 20
const feetToZ = (ft) => FOUL_Z - (ft / LANE_LENGTH_FEET) * LANE_LEN;

// ---- Bowling pin (lathe profile, normalised height ~1.25) ----------------
const PIN_PROFILE = [
  [0.0, 0.0],
  [0.1, 0.0],
  [0.108, 0.05],
  [0.13, 0.2],
  [0.165, 0.36],
  [0.185, 0.5],
  [0.165, 0.62],
  [0.12, 0.78],
  [0.085, 0.9],
  [0.1, 1.0],
  [0.11, 1.07],
  [0.092, 1.15],
  [0.05, 1.22],
  [0.0, 1.25],
].map(([r, y]) => new THREE.Vector2(r, y));

// 10-pin triangle: [lateral (in 12" units), row index]. Head pin nearest bowler.
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
const HALF_LANE_FT = LANE_WIDTH_FEET / 2; // ~1.69 ft
const PIN_SCALE = 3;
const ROW_DEPTH_WORLD = 1.6; // front-to-back spacing between pin rows
const BACK_ROW_Z = -18.5; // back row sits near the pin end

function Pins({ halfWidth }) {
  const pinGeo = useMemo(() => new THREE.LatheGeometry(PIN_PROFILE, 24), []);
  useEffect(() => () => pinGeo.dispose(), [pinGeo]);
  return (
    <group>
      {PIN_LAYOUT.map(([lat, row], i) => {
        const x = (lat / HALF_LANE_FT) * halfWidth * 0.82;
        const z = BACK_ROW_Z + (3 - row) * ROW_DEPTH_WORLD;
        return (
          <group key={i} position={[x, 0, z]} scale={PIN_SCALE}>
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
      <planeGeometry args={[width, 0.35]} />
      <meshStandardMaterial color="#b91c1c" emissive="#7f1d1d" emissiveIntensity={0.3} />
    </mesh>
  );
}

function Gutters({ width }) {
  const half = width / 2;
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (half + 0.75), -0.22, 0]}>
          <boxGeometry args={[1.4, 0.44, LANE_LEN]} />
          <meshStandardMaterial color="#0b1326" roughness={0.85} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function OilSurface({ width, grid, max, layer, thickness, opacity }) {
  const { colorTex, dispTex } = useMemo(
    () => buildOilTextures(grid, max, layer),
    [grid, max, layer]
  );
  useEffect(
    () => () => {
      colorTex.dispose();
      dispTex.dispose();
    },
    [colorTex, dispTex]
  );

  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
      <planeGeometry args={[width, LANE_LEN, BOARD_COUNT, FEET_SAMPLES]} />
      <meshStandardMaterial
        map={colorTex}
        transparent
        opacity={opacity}
        displacementMap={thickness > 0 ? dispTex : null}
        displacementScale={thickness}
        depthWrite={false}
        roughness={0.12}
        metalness={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function AxisLabels({ width }) {
  const half = width / 2;
  const feetMarks = [10, 20, 30, 40, 50, 60]; // 0 ft is shown as the FOUL LINE label
  return (
    <group>
      {feetMarks.map((ft) => (
        <Html key={ft} position={[half + 1, 0.1, feetToZ(ft)]} center distanceFactor={34} occlude={false}>
          <div className="select-none whitespace-nowrap rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-mono text-sky-200 ring-1 ring-sky-500/30">
            {ft}ft
          </div>
        </Html>
      ))}
      <Html position={[half + 1, 0.1, FOUL_Z]} center distanceFactor={34} occlude={false}>
        <div className="select-none whitespace-nowrap rounded bg-rose-900/85 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-rose-100">
          FOUL LINE
        </div>
      </Html>
      <Html position={[-(half + 1.1), 0.1, feetToZ(0.8)]} center distanceFactor={34} occlude={false}>
        <div className="select-none whitespace-nowrap rounded bg-slate-800/85 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
          릴리즈
        </div>
      </Html>
      <Html position={[-(half + 1.1), 0.1, feetToZ(6)]} center distanceFactor={34} occlude={false}>
        <div className="select-none whitespace-nowrap rounded bg-slate-800/85 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
          타겟 6ft
        </div>
      </Html>
      <Html position={[0, 0.1, feetToZ(60) - 1.4]} center distanceFactor={34} occlude={false}>
        <div className="select-none whitespace-nowrap rounded bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
          🎳 PINS
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
      <Html position={[-(half + 1.1), 0.1, feetToZ(distance)]} center distanceFactor={34}>
        <div className="select-none whitespace-nowrap rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-900">
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
  thickness,
  opacity,
  showOil,
  showLabels,
  showPins,
  widthScale = 1,
  patternDistance,
}) {
  const width = BASE_WIDTH * widthScale;
  return (
    <group>
      <WoodLane width={width} />
      <FoulLine width={width} />
      <Gutters width={width} />
      {showOil && layer !== 'none' && (
        <OilSurface
          width={width}
          grid={grid}
          max={max}
          layer={layer}
          thickness={thickness}
          opacity={opacity}
        />
      )}
      {showPins && <Pins halfWidth={width / 2} />}
      {showLabels && <AxisLabels width={width} />}
      <DistanceMarker distance={patternDistance} width={width} />
    </group>
  );
}
