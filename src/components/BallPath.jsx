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

function absToX(abs, width) {
  return ((abs - 0.5) / BOARD_COUNT - 0.5) * width;
}

const BALL_RADIUS_FT = BALL_DIAMETER_INCH / 2 / 12; // real radius, for spin rate
const AXIS_ROTATION_RAD = (55 * Math.PI) / 180; // release axis rotation (tweener-ish)
const MAX_OIL_RINGS = 12;
const RING_SPACING_FEET = 3.2; // lay a new track ring every few feet of oiled travel
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const UP = new THREE.Vector3(0, 1, 0);

function RollingBall({ sim, width, feetToZ, lift, replayKey }) {
  const group = useRef();
  const ball = useRef();
  const ringRefs = useRef([]);
  const idx = useRef(0);
  const startT = useRef(null);
  const prev = useRef(null);
  const ringCount = useRef(0);
  const lastRingFeet = useRef(-Infinity);
  const trackAxisLocal = useRef(null); // ball-local axis the track rings share
  const radius = (BALL_DIAMETER_INCH / 2) * (width / LANE_WIDTH_INCH);

  const resetShot = () => {
    idx.current = 0;
    prev.current = null;
    ringCount.current = 0;
    lastRingFeet.current = -Infinity;
    trackAxisLocal.current = null;
    ringRefs.current.forEach((m) => m && (m.visible = false));
  };

  useEffect(() => {
    startT.current = null;
    resetShot();
  }, [replayKey, sim]);

  useFrame(({ clock }, frameDt) => {
    if (!group.current || !ball.current || !sim.points.length) return;
    if (startT.current == null) startT.current = clock.elapsedTime;
    const T = sim.totalTime;
    // Plays ONCE per replay press (or sim change); the ball then rests at the
    // pins until the next 볼 굴리기.
    let t = clock.elapsedTime - startT.current;
    const holding = t >= T;
    if (holding) t = T;

    const pts = sim.points;
    while (idx.current < pts.length - 2 && pts[idx.current + 1].t <= t) idx.current += 1;
    const a = pts[idx.current];
    const b = pts[Math.min(idx.current + 1, pts.length - 1)];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    const abs = a.abs + (b.abs - a.abs) * f;
    const feet = a.feet + (b.feet - a.feet) * f;
    const slip = a.slip + (b.slip - a.slip) * f;
    const speed = a.speed + (b.speed - a.speed) * f; // ft/s
    const oil = (a.oil || 0) + ((b.oil || 0) - (a.oil || 0)) * f;

    const pos = new THREE.Vector3(absToX(abs, width), lift + radius, feetToZ(feet));

    if (prev.current && !holding) {
      const delta = pos.clone().sub(prev.current);
      delta.y = 0;
      if (delta.lengthSq() > 1e-12) {
        // Spin axis: at release the axis is ROTATED toward the travel direction
        // (side rotation — that's what makes the ball hook); as slip converts to
        // roll the axis migrates to pure end-over-end, exactly like a real ball.
        const dir = delta.normalize();
        const rollAxis = dir.clone().cross(UP).normalize();
        const sign = sim.hand === 'L' ? 1 : -1;
        const spinAxis = rollAxis
          .clone()
          .applyAxisAngle(UP, sign * AXIS_ROTATION_RAD * slip)
          .normalize();
        // Spin rate: the bowler's rev rate while slipping, surface-matching
        // (v/r) once rolled — the visible "rev up" through the transition.
        const omega =
          slip * ((sim.revRpm || 350) * Math.PI * 2) / 60 +
          (1 - slip) * (speed / BALL_RADIUS_FT);
        ball.current.rotateOnWorldAxis(spinAxis, omega * Math.min(frameDt, 0.05));

        // Oil track: rings the conditioner paints around the spin axis. Flare
        // precession walks the contact circle a couple of degrees of latitude
        // per revolution set — scaled by Diff (flare potential) and rev rate —
        // so the track reads as a CLEAN stack of parallel rings (like a real
        // ball's flare lines), not a fan crossing at the poles.
        if (
          oil > 0.06 &&
          feet - lastRingFeet.current >= RING_SPACING_FEET &&
          ringCount.current < MAX_OIL_RINGS
        ) {
          const ring = ringRefs.current[ringCount.current];
          if (ring) {
            if (!trackAxisLocal.current) {
              // all rings share the axis captured at first oil contact,
              // expressed in the ball's local frame (invariant under its spin)
              trackAxisLocal.current = spinAxis
                .clone()
                .applyQuaternion(ball.current.quaternion.clone().invert())
                .normalize();
            }
            const axisL = trackAxisLocal.current;
            const flareStep =
              THREE.MathUtils.degToRad(2.6) *
              Math.min(1.9, Math.max(0.3, (sim.diff || 0.048) / 0.048)) *
              Math.sqrt((sim.revRpm || 350) / 350);
            // latitude of this ring: start at the equator (great circle) and
            // migrate toward the axis a step per ring
            const theta = Math.PI / 2 - ringCount.current * flareStep;
            ring.quaternion.setFromUnitVectors(Z_AXIS, axisL);
            ring.position.copy(axisL).multiplyScalar(radius * Math.cos(theta));
            ring.scale.setScalar(Math.max(0.4, Math.sin(theta)));
            ring.visible = true;
            ringCount.current += 1;
            lastRingFeet.current = feet;
          }
        }
      }
    }
    prev.current = pos;
    group.current.position.copy(pos);
  });

  // Grip layout: middle/ring finger inserts side by side, thumb hole apart
  // below them — they make the roll (and flare) easy to read.
  const holes = useMemo(
    () => [
      { dir: new THREE.Vector3(0.14, 0.97, 0.2).normalize(), r: 0.075 }, // 중지
      { dir: new THREE.Vector3(-0.14, 0.97, 0.2).normalize(), r: 0.075 }, // 약지
      { dir: new THREE.Vector3(0, 0.78, -0.63).normalize(), r: 0.1 }, // 엄지
    ],
    []
  );

  return (
    <group ref={group}>
      <mesh ref={ball}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.15} metalness={0.15} />
        {/* oil track rings — hidden until the ball actually rolls through oil */}
        {Array.from({ length: MAX_OIL_RINGS }, (_, i) => (
          <mesh
            key={i}
            visible={false}
            ref={(el) => {
              ringRefs.current[i] = el;
            }}
          >
            <torusGeometry args={[radius * 0.99, radius * 0.013, 6, 64]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.3}
              transparent
              opacity={0.9}
              roughness={0.05}
              metalness={0.05}
            />
          </mesh>
        ))}
        {holes.map((h, i) => (
          <mesh key={`h${i}`} position={h.dir.clone().multiplyScalar(radius * 0.97).toArray()}>
            <sphereGeometry args={[radius * h.r, 10, 10]} />
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
