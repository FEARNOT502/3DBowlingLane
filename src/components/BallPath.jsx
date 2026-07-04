import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { BOARD_COUNT, LANE_WIDTH_INCH } from '../lib/laneConstants.js';

// ---------------------------------------------------------------------------
// 3D shot overlay: the simulated trajectory coloured by phase (skid / hook /
// roll), a breakpoint marker, and a regulation-size ball that rolls the line.
// Board -> world x uses the same mapping as the oil texture (board 1 = -x).
// ---------------------------------------------------------------------------

const PHASE_COLORS = {
  skid: new THREE.Color('#38bdf8'),
  hook: new THREE.Color('#f59e0b'),
  roll: new THREE.Color('#ef4444'),
};

const BALL_DIAMETER_INCH = 8.5;
const REPLAY_HOLD_SEC = 1.3; // pause at the pins before the loop restarts

function absToX(abs, width) {
  return ((abs - 0.5) / BOARD_COUNT - 0.5) * width;
}

function RollingBall({ sim, width, feetToZ, lift, replayKey }) {
  const group = useRef();
  const ball = useRef();
  const idx = useRef(0);
  const startT = useRef(null);
  const prev = useRef(null);
  const radius = (BALL_DIAMETER_INCH / 2) * (width / LANE_WIDTH_INCH);

  useEffect(() => {
    startT.current = null;
    idx.current = 0;
    prev.current = null;
  }, [replayKey, sim]);

  useFrame(({ clock }) => {
    if (!group.current || !sim.points.length) return;
    if (startT.current == null) startT.current = clock.elapsedTime;
    const T = sim.totalTime;
    let t = (clock.elapsedTime - startT.current) % (T + REPLAY_HOLD_SEC);
    if (t > T) t = T;

    const pts = sim.points;
    if (idx.current > 0 && pts[idx.current].t > t) {
      idx.current = 0;
      prev.current = null;
    }
    while (idx.current < pts.length - 2 && pts[idx.current + 1].t <= t) idx.current += 1;
    const a = pts[idx.current];
    const b = pts[Math.min(idx.current + 1, pts.length - 1)];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    const abs = a.abs + (b.abs - a.abs) * f;
    const feet = a.feet + (b.feet - a.feet) * f;

    const pos = new THREE.Vector3(absToX(abs, width), lift + radius, feetToZ(feet));
    // roll the ball by arc length around the axis perpendicular to travel
    if (prev.current && ball.current) {
      const delta = pos.clone().sub(prev.current);
      delta.y = 0;
      const ds = delta.length();
      if (ds > 1e-6 && ds < radius * 8) {
        const axis = delta.normalize().cross(new THREE.Vector3(0, 1, 0)).normalize();
        ball.current.rotateOnWorldAxis(axis, ds / radius);
      }
    }
    prev.current = pos;
    group.current.position.copy(pos);
  });

  // finger-hole cluster on the surface makes the roll (and flare) visible
  const holes = useMemo(() => {
    const dirs = [
      new THREE.Vector3(0.25, 0.95, 0.1),
      new THREE.Vector3(-0.05, 0.92, 0.38),
      new THREE.Vector3(0.38, 0.85, 0.36),
    ].map((v) => v.normalize());
    return dirs;
  }, []);

  return (
    <group ref={group}>
      <mesh ref={ball}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.15} metalness={0.15} />
        <mesh rotation-x={Math.PI / 2.6} rotation-z={0.5}>
          <torusGeometry args={[radius * 0.99, radius * 0.045, 8, 48]} />
          <meshStandardMaterial color="#93c5fd" roughness={0.3} />
        </mesh>
        {holes.map((d, i) => (
          <mesh key={i} position={d.clone().multiplyScalar(radius * 0.97).toArray()}>
            <sphereGeometry args={[radius * 0.09, 10, 10]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} />
          </mesh>
        ))}
      </mesh>
    </group>
  );
}

// Ring + floating label anchored to a lane position (stance / aim / breakpoint).
function Marker({ abs, feet, width, feetToZ, lift, ringColor, badgeClass, children }) {
  return (
    <group position={[absToX(abs, width), lift + 0.02, feetToZ(feet)]}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[width * 0.012, width * 0.02, 24]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.95} side={THREE.DoubleSide} />
      </mesh>
      <Html center zIndexRange={[10, 0]} position={[0, 0.1, 0]}>
        <div
          className={`pointer-events-none select-none whitespace-nowrap rounded-md px-1.5 py-px font-mono text-[10px] font-semibold shadow-sm ${badgeClass}`}
        >
          {children}
        </div>
      </Html>
    </group>
  );
}

export default function BallPath({ sim, width, feetToZ, lift = 0.1, replayKey, showBall = true }) {
  const { positions, colors } = useMemo(() => {
    const positions = [];
    const colors = [];
    for (const p of sim.points) {
      positions.push([absToX(p.abs, width), lift, feetToZ(p.feet)]);
      const c = PHASE_COLORS[p.phase] || PHASE_COLORS.skid;
      colors.push([c.r, c.g, c.b]);
    }
    return { positions, colors };
  }, [sim, width, feetToZ, lift]);

  if (!sim || sim.points.length < 2) return null;

  const bp = sim.breakpoint;
  const bpAbs = sim.hand === 'L' ? bp.board : BOARD_COUNT + 1 - bp.board;
  const showBp = bp.feet > 6; // launch point is not a real breakpoint
  const stance = sim.points[0];
  const aim = sim.points[Math.min(sim.points.length - 1, Math.round(15 / 0.25))]; // arrows row

  return (
    <group>
      <Line points={positions} vertexColors={colors} lineWidth={3} transparent opacity={0.95} />

      <Marker
        abs={stance.abs}
        feet={stance.feet}
        width={width}
        feetToZ={feetToZ}
        lift={lift}
        ringColor="#2563eb"
        badgeClass="bg-blue-600/95 text-white"
      >
        스탠스 {stance.board.toFixed(1)}보드
      </Marker>

      <Marker
        abs={aim.abs}
        feet={aim.feet}
        width={width}
        feetToZ={feetToZ}
        lift={lift}
        ringColor="#10b981"
        badgeClass="bg-emerald-500/95 text-white"
      >
        에임 {aim.board.toFixed(1)}보드
      </Marker>

      {showBp && (
        <Marker
          abs={bpAbs}
          feet={bp.feet}
          width={width}
          feetToZ={feetToZ}
          lift={lift}
          ringColor="#f59e0b"
          badgeClass="bg-amber-400/95 text-slate-900"
        >
          BP {bp.board.toFixed(1)}보드 · {bp.feet.toFixed(0)}ft
        </Marker>
      )}

      {showBall && (
        <RollingBall sim={sim} width={width} feetToZ={feetToZ} lift={lift} replayKey={replayKey} />
      )}
    </group>
  );
}
