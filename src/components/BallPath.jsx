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
const REPLAY_HOLD_SEC = 1.3; // rest at the pins before the loop restarts

function absToX(abs, width) {
  return ((abs - 0.5) / BOARD_COUNT - 0.5) * width;
}

const BALL_RADIUS_FT = BALL_DIAMETER_INCH / 2 / 12; // real radius, for spin rate
const AXIS_ROTATION_RAD = (55 * Math.PI) / 180; // release axis rotation (tweener-ish)
const MAX_OIL_RINGS = 12;
const RING_SPACING_FEET = 3.2; // lay a new track ring every few feet of oiled travel
// PAP (positive axis point) sits ~5.5" over from the grip centre — ~73° of arc
// on an 8.5" ball. Anchoring the spin axis here puts the oil track right next
// to the finger/thumb holes, where a real ball tracks.
const PAP_FROM_GRIP_RAD = (73 * Math.PI) / 180;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const UP = new THREE.Vector3(0, 1, 0);

// Marbled coverstock texture (equirectangular, wraps the sphere). Seeded so
// every ball renders the same swirl.
function makeMarbleTexture() {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let seed = 20260705;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // deep blue base with a subtle vertical shade
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#1e3a8a');
  base.addColorStop(0.5, '#1d4ed8');
  base.addColorStop(1, '#1e40af');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // swirled veins in lighter/darker blues and a few pale streaks. Drawing the
  // whole pass twice, offset by W, keeps the horizontal wrap seam invisible.
  const veins = [
    { color: 'rgba(96,165,250,0.5)', width: [6, 26], n: 9 },
    { color: 'rgba(23,37,84,0.55)', width: [8, 30], n: 8 },
    { color: 'rgba(147,197,253,0.35)', width: [3, 12], n: 7 },
    { color: 'rgba(224,242,254,0.22)', width: [2, 7], n: 6 },
  ];
  for (const v of veins) {
    for (let i = 0; i < v.n; i += 1) {
      const x0 = rnd() * W;
      const y0 = rnd() * H;
      const segs = 3 + Math.floor(rnd() * 3);
      const lw = v.width[0] + rnd() * (v.width[1] - v.width[0]);
      for (const off of [0, -W, W]) {
        ctx.beginPath();
        ctx.moveTo(x0 + off, y0);
        let px = x0;
        let py = y0;
        // rewind the generator per copy so all three copies share one shape
        // (px/py restart from x0/y0 above for the same reason)
        const s0 = seed;
        for (let sIdx = 0; sIdx < segs; sIdx += 1) {
          const cx = px + (rnd() - 0.5) * 340;
          const cy = py + (rnd() - 0.5) * 240;
          px += (rnd() - 0.5) * 420;
          py += (rnd() - 0.5) * 260;
          ctx.quadraticCurveTo(cx + off, cy, px + off, py);
        }
        if (off !== W) seed = s0;
        ctx.strokeStyle = v.color;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function RollingBall({ sim, width, feetToZ, lift, replayKey, playing = true, playSpeed = 1 }) {
  const group = useRef();
  const ball = useRef();
  const ringRefs = useRef([]);
  const idx = useRef(0);
  const progress = useRef(0); // seconds into the loop cycle (pausable, scalable)
  const prev = useRef(null);
  const ringCount = useRef(0);
  const lastRingFeet = useRef(-Infinity);
  const oriented = useRef(false); // release orientation applied for this shot
  const trackAxisLocal = useRef(null); // ball-local PAP the track rings share
  const radius = (BALL_DIAMETER_INCH / 2) * (width / LANE_WIDTH_INCH);

  const resetShot = () => {
    idx.current = 0;
    prev.current = null;
    ringCount.current = 0;
    lastRingFeet.current = -Infinity;
    oriented.current = false;
    trackAxisLocal.current = null;
    ringRefs.current.forEach((m) => m && (m.visible = false));
  };

  useEffect(() => {
    progress.current = 0;
    resetShot();
  }, [replayKey, sim]);

  useFrame((_, frameDt) => {
    if (!group.current || !ball.current || !sim.points.length) return;
    const T = sim.totalTime;
    // Own clock so playback can pause and change speed: advance only while
    // playing. The rest at the pins stays real-time regardless of playSpeed —
    // only the roll itself should feel faster/slower.
    const rawDt = Math.min(frameDt, 0.05);
    const wasHolding = progress.current > T;
    const dt = wasHolding ? rawDt : rawDt * playSpeed;
    if (playing) {
      progress.current += dt;
      if (progress.current >= T + REPLAY_HOLD_SEC) {
        progress.current = 0;
        resetShot();
      }
    }
    const holding = progress.current > T;
    const t = holding ? T : progress.current;

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

    if (prev.current && !holding && playing) {
      const delta = pos.clone().sub(prev.current);
      delta.y = 0;
      if (delta.lengthSq() > 1e-12) {
        // Spin axis: at release the axis is ROTATED toward the travel direction
        // (side rotation — that's what makes the ball hook); as slip converts to
        // roll the axis migrates to pure end-over-end, exactly like a real ball.
        // Forward roll about up×dir (right-hand rule: moving -z needs ω along
        // -x, or the ball visibly spins backwards).
        const dir = delta.normalize();
        const rollAxis = UP.clone().cross(dir).normalize();
        const sign = sim.hand === 'L' ? -1 : 1;
        const spinAxis = rollAxis
          .clone()
          .applyAxisAngle(UP, sign * AXIS_ROTATION_RAD * slip)
          .normalize();

        // Release orientation (once per shot): hold the ball so its local PAP
        // lies on the release spin axis with the grip facing up — exactly how
        // a real hand delivers it. The oil track then forms beside the grip.
        if (!oriented.current) {
          // holes[] place the middle/ring finger inserts at +x (righty); the
          // track must sit on the OPPOSITE side (-x), so flip the sign here.
          const pLocal = new THREE.Vector3(
            (sim.hand === 'L' ? 1 : -1) * Math.sin(PAP_FROM_GRIP_RAD),
            Math.cos(PAP_FROM_GRIP_RAD),
            0
          ).normalize();
          const q = new THREE.Quaternion().setFromUnitVectors(pLocal, spinAxis);
          // free twist about the axis: use it to point the grip upward
          const g = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
          const gp = g.clone().addScaledVector(spinAxis, -g.dot(spinAxis));
          const upp = UP.clone().addScaledVector(spinAxis, -UP.dot(spinAxis));
          if (gp.lengthSq() > 1e-8 && upp.lengthSq() > 1e-8) {
            gp.normalize();
            upp.normalize();
            let ang = Math.acos(THREE.MathUtils.clamp(gp.dot(upp), -1, 1));
            if (gp.clone().cross(upp).dot(spinAxis) < 0) ang = -ang;
            q.premultiply(new THREE.Quaternion().setFromAxisAngle(spinAxis, ang));
          }
          ball.current.quaternion.copy(q);
          trackAxisLocal.current = pLocal;
          oriented.current = true;
        }
        // Spin rate: the bowler's rev rate while slipping, surface-matching
        // (v/r) once rolled — the visible "rev up" through the transition.
        const omega =
          slip * ((sim.revRpm || 350) * Math.PI * 2) / 60 +
          (1 - slip) * (speed / BALL_RADIUS_FT);
        ball.current.rotateOnWorldAxis(spinAxis, omega * dt);

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
          if (ring && trackAxisLocal.current) {
            const axisL = trackAxisLocal.current;
            const flareStep =
              THREE.MathUtils.degToRad(2.6) *
              Math.min(1.9, Math.max(0.3, (sim.diff || 0.048) / 0.048)) *
              Math.sqrt((sim.revRpm || 350) / 350);
            // latitude of this ring: the first ring is the great circle that
            // passes just OUTSIDE the middle-finger insert (left of it for a
            // righty); each flare ring then walks further away from the grip
            const theta = Math.PI / 2 + ringCount.current * flareStep;
            ring.quaternion.setFromUnitVectors(Z_AXIS, axisL);
            ring.position.copy(axisL).multiplyScalar(radius * Math.cos(theta));
            ring.scale.setScalar(Math.max(0.4, Math.sin(theta)));
            // fresher rings carry more conditioner — older ones read fainter
            ring.material.opacity = 0.45 + 0.45 * (ringCount.current / MAX_OIL_RINGS);
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
  // below them. Flat discs sitting on the surface — drilled holes don't stick
  // OUT of a real ball.
  const holes = useMemo(
    () =>
      [
        { dir: new THREE.Vector3(0.14, 0.97, 0.2).normalize(), r: 0.075 }, // 중지
        { dir: new THREE.Vector3(-0.14, 0.97, 0.2).normalize(), r: 0.075 }, // 약지
        { dir: new THREE.Vector3(0, 0.78, -0.63).normalize(), r: 0.1 }, // 엄지
      ].map((h) => ({
        ...h,
        quat: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, h.dir),
      })),
    []
  );

  const marbleTex = useMemo(() => makeMarbleTexture(), []);
  useEffect(() => () => marbleTex.dispose(), [marbleTex]);

  return (
    <group ref={group}>
      <mesh ref={ball}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial map={marbleTex} roughness={0.14} metalness={0.12} />
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
          <mesh
            key={`h${i}`}
            position={h.dir.clone().multiplyScalar(radius * 1.002).toArray()}
            quaternion={h.quat}
          >
            <circleGeometry args={[radius * h.r, 24]} />
            <meshStandardMaterial color="#0b1220" roughness={0.45} />
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

export default function BallPath({
  sim,
  width,
  feetToZ,
  lift = 0.1,
  replayKey,
  showLine = true,
  showBall = true,
  playing = true,
  playSpeed = 1,
}) {
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
      {showLine && (
        <>
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
        </>
      )}

      {showBall && (
        <RollingBall
          sim={sim}
          width={width}
          feetToZ={feetToZ}
          lift={lift}
          replayKey={replayKey}
          playing={playing}
          playSpeed={playSpeed}
        />
      )}
    </group>
  );
}
