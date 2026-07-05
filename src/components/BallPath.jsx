import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { BOARD_COUNT, LANE_WIDTH_INCH, BOARD_WIDTH_FEET } from '../lib/laneConstants.js';

// ---------------------------------------------------------------------------
// 3D shot overlay: the simulated trajectory coloured by phase (skid / hook /
// roll), a breakpoint marker, and a regulation-size ball that rolls the line.
// Board -> world x uses the same mapping as the oil texture (board 1 = -x).
//
// The ball's rotation and its accumulating oil-track flare are shared with the
// top-right inspector window through <FlareBall> + a common playback clock ref,
// so the inspector always shows exactly the current shot's spin and flare.
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
const MAX_OIL_RINGS = 12;
// Track flare is driven by REVOLUTIONS, not distance: a real ball lays one oil
// line per pass and its axis migrates a little each rev, so higher rev rates
// pack more rings into the same stretch of lane.
const REVS_PER_RING = 1.5; // fresh track ring every ~1.5 revolutions
const FLARE_PER_REV = (4 * Math.PI) / 180; // spin-axis migration per rev at full slip
const MAX_FLARE_RAD = (55 * Math.PI) / 180; // total flare spread cap (outermost track)
// PAP (positive axis point) sits ~5.5" over from the grip centre — ~73° of arc
// on an 8.5" ball. Anchoring the spin axis here puts the oil track right next
// to the finger/thumb holes, where a real ball tracks.
const PAP_FROM_GRIP_RAD = (73 * Math.PI) / 180;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Marbled coverstock texture (equirectangular, wraps the sphere). Seeded so
// every ball renders the same swirl.
export function makeMarbleTexture() {
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

// ---------------------------------------------------------------------------
// Flare model — deterministic pass over the simulated shot.
// ---------------------------------------------------------------------------
// One oil ring per ~1.5 revs while the ball still slips through oil. Each ring
// is the great circle perpendicular to the CURRENT (migrated) spin axis; since
// successive axes lie in one plane, the rings pass through the same two points
// — the real oil-track "bowtie". Returned in BALL-LOCAL space with the time the
// ring is laid, so both the rolling ball and the inspector can reveal it in sync
// and scrubbing can show exactly the rings laid so far.
export function computeFlareRings(sim) {
  const rings = [];
  if (!sim || !sim.points || sim.points.length < 2) return rings;
  const hand = sim.hand;
  const sign = hand === 'L' ? -1 : 1;
  const revRpm = sim.revRpm || 350;
  const diff = sim.diff || 0.048;
  // centred so 15° tilt = the reference flare; more tilt = less flare.
  const tiltRel = clamp(((sim.axisTiltDeg ?? 15) - 15) / 90, -0.17, 0.5);
  // ball-local PAP (release spin axis) and the axis it migrates about.
  const pLocal = new THREE.Vector3(
    (hand === 'L' ? 1 : -1) * Math.sin(PAP_FROM_GRIP_RAD),
    Math.cos(PAP_FROM_GRIP_RAD),
    0
  ).normalize();
  const migL = new THREE.Vector3().crossVectors(pLocal, UP);
  if (migL.lengthSq() < 1e-6) migL.set(1, 0, 0);
  migL.normalize();
  // higher axis tilt = less flare (spillier release rolls out sooner).
  const diffFactor = clamp(diff / 0.048, 0.3, 1.9) * (1 - 0.6 * tiltRel);

  let revAccum = 0;
  let lastRingRev = -Infinity;
  let flareArc = 0;
  const pts = sim.points;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const dt = b.t - a.t;
    if (dt <= 0) continue;
    const slip = (a.slip + b.slip) / 2;
    const speed = (a.speed + b.speed) / 2;
    const oil = ((a.oil || 0) + (b.oil || 0)) / 2;
    const omega = slip * ((revRpm * Math.PI * 2) / 60) + (1 - slip) * (speed / BALL_RADIUS_FT);
    const dRevs = (omega * dt) / (2 * Math.PI);
    revAccum += dRevs;
    flareArc = Math.min(MAX_FLARE_RAD, flareArc + FLARE_PER_REV * diffFactor * slip * dRevs);
    if (
      oil > 0.06 &&
      slip > 0.05 &&
      revAccum - lastRingRev >= REVS_PER_RING &&
      rings.length < MAX_OIL_RINGS
    ) {
      const axisL = pLocal.clone().applyAxisAngle(migL, sign * flareArc).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(Z_AXIS, axisL);
      rings.push({ quaternion: q, t: b.t, opacity: 0.55 + 0.4 * (rings.length / MAX_OIL_RINGS) });
      lastRingRev = revAccum;
    }
  }
  return rings;
}

// Interpolated shot state at time t, plus the (canonical, real-proportion)
// travel direction used to build the spin axis.
function stateAt(pts, t) {
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].t <= t) i += 1;
  const a = pts[i];
  const b = pts[Math.min(i + 1, pts.length - 1)];
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  const slip = a.slip + (b.slip - a.slip) * f;
  const speed = a.speed + (b.speed - a.speed) * f;
  // real-proportion tangent: board step scaled to feet so lateral vs down-lane
  // stay physical regardless of the view's width stretch.
  const dx = (b.abs - a.abs) * BOARD_WIDTH_FEET;
  const dz = -(b.feet - a.feet);
  const dir = new THREE.Vector3(dx, 0, dz);
  return { slip, speed, dir: dir.lengthSq() > 1e-9 ? dir.normalize() : null };
}

function spinAxisFrom(dir, slip, hand, axisRotRad) {
  const rollAxis = UP.clone().cross(dir).normalize();
  const sign = hand === 'L' ? -1 : 1;
  return rollAxis.applyAxisAngle(UP, sign * axisRotRad * slip).normalize();
}

// Orient a ball mesh so its local PAP lies on the release spin axis with the
// grip facing up — exactly how a real hand delivers it, so the oil track forms
// beside the grip.
function orientBall(mesh, spinAxis, hand) {
  const pLocal = new THREE.Vector3(
    (hand === 'L' ? 1 : -1) * Math.sin(PAP_FROM_GRIP_RAD),
    Math.cos(PAP_FROM_GRIP_RAD),
    0
  ).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(pLocal, spinAxis);
  const g = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const gp = g.clone().addScaledVector(spinAxis, -g.dot(spinAxis));
  const upp = UP.clone().addScaledVector(spinAxis, -UP.dot(spinAxis));
  if (gp.lengthSq() > 1e-8 && upp.lengthSq() > 1e-8) {
    gp.normalize();
    upp.normalize();
    let ang = Math.acos(clamp(gp.dot(upp), -1, 1));
    if (gp.clone().cross(upp).dot(spinAxis) < 0) ang = -ang;
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(spinAxis, ang));
  }
  mesh.quaternion.copy(q);
}

// ---------------------------------------------------------------------------
// FlareBall — the ball itself: marbled cover, grip holes, and the accumulating
// oil-track rings. Time-driven off `clockRef` (shared between the main scene and
// the inspector), so it spins and reveals flare identically in both places.
// ---------------------------------------------------------------------------
export const FlareBall = forwardRef(function FlareBall({ sim, radius, clockRef }, ref) {
  const ball = useRef();
  const ringRefs = useRef([]);
  const oriented = useRef(false);
  const prevT = useRef(-1);
  const axisRotRad = ((sim.axisRotDeg ?? 55) * Math.PI) / 180;

  const rings = useMemo(() => computeFlareRings(sim), [sim]);
  const marbleTex = useMemo(() => makeMarbleTexture(), []);
  useEffect(() => () => marbleTex.dispose(), [marbleTex]);

  // Grip layout: middle/ring inserts side by side, thumb apart below. Flat discs
  // sitting on the surface (drilled holes don't stick OUT of a real ball).
  const holes = useMemo(
    () =>
      [
        { dir: new THREE.Vector3(0.14, 0.97, 0.2).normalize(), r: 0.075 },
        { dir: new THREE.Vector3(-0.14, 0.97, 0.2).normalize(), r: 0.075 },
        { dir: new THREE.Vector3(0, 0.78, -0.63).normalize(), r: 0.1 },
      ].map((h) => ({ ...h, quat: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, h.dir) })),
    []
  );

  useImperativeHandle(ref, () => ({ reset: () => { oriented.current = false; prevT.current = -1; } }), []);

  useFrame(() => {
    if (!ball.current || !clockRef?.current || !sim.points.length) return;
    const T = clockRef.current.T || sim.totalTime || 1;
    const t = clamp(clockRef.current.t || 0, 0, T);
    // Loop restart (time jumped back): re-orient for the fresh shot.
    if (t < prevT.current - 1e-3) oriented.current = false;

    const st = stateAt(sim.points, t);
    if (st.dir) {
      const spinAxis = spinAxisFrom(st.dir, st.slip, sim.hand, axisRotRad);
      if (!oriented.current) {
        orientBall(ball.current, spinAxis, sim.hand);
        oriented.current = true;
      } else {
        const dt = clamp(t - prevT.current, 0, 0.05);
        if (dt > 0) {
          const omega = st.slip * ((sim.revRpm || 350) * Math.PI * 2) / 60 + (1 - st.slip) * (st.speed / BALL_RADIUS_FT);
          ball.current.rotateOnWorldAxis(spinAxis, omega * dt);
        }
      }
    }
    // Reveal every ring laid up to the current time.
    for (let i = 0; i < rings.length; i += 1) {
      const m = ringRefs.current[i];
      if (m) m.visible = t >= rings[i].t;
    }
    prevT.current = t;
  });

  return (
    <mesh ref={ball}>
      <sphereGeometry args={[radius, 48, 48]} />
      <meshStandardMaterial map={marbleTex} roughness={0.14} metalness={0.12} />
      {/* oil-track rings — bright, thick enough to read on the moving ball */}
      {rings.map((r, i) => (
        <mesh
          key={i}
          visible={false}
          quaternion={r.quaternion}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
        >
          <torusGeometry args={[radius * 0.99, radius * 0.03, 8, 72]} />
          <meshStandardMaterial
            color="#f0feff"
            emissive="#eafcff"
            emissiveIntensity={0.9}
            toneMapped={false}
            transparent
            opacity={r.opacity}
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
  );
});

// The rolling ball: owns the playback clock (writing it into clockRef so the
// inspector can follow), moves the group along the line, and hosts a FlareBall.
function RollingBall({ sim, width, feetToZ, lift, replayKey, playing = true, playSpeed = 1, clockRef, scrub = null }) {
  const group = useRef();
  const flareRef = useRef();
  const progress = useRef(0); // seconds into the loop cycle (pausable, scalable)
  const radius = (BALL_DIAMETER_INCH / 2) * (width / LANE_WIDTH_INCH);

  useEffect(() => {
    progress.current = 0;
    flareRef.current?.reset();
  }, [replayKey, sim]);

  useFrame((_, frameDt) => {
    if (!group.current || !sim.points.length) return;
    const T = sim.totalTime;

    if (scrub != null) {
      // Scrubbing: park playback at the scrub fraction; no auto-advance.
      progress.current = clamp(scrub, 0, 1) * T;
    } else {
      const rawDt = Math.min(frameDt, 0.05);
      const wasHolding = progress.current > T;
      const dt = wasHolding ? rawDt : rawDt * playSpeed;
      if (playing) {
        progress.current += dt;
        if (progress.current >= T + REPLAY_HOLD_SEC) {
          progress.current = 0;
          flareRef.current?.reset();
        }
      }
    }

    const holding = progress.current > T;
    const t = holding ? T : progress.current;
    if (clockRef?.current) {
      clockRef.current.t = t;
      clockRef.current.T = T;
    }

    const pts = sim.points;
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].t <= t) i += 1;
    const a = pts[i];
    const b = pts[Math.min(i + 1, pts.length - 1)];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
    const abs = a.abs + (b.abs - a.abs) * f;
    const feet = a.feet + (b.feet - a.feet) * f;
    group.current.position.set(absToX(abs, width), lift + radius, feetToZ(feet));
  });

  return (
    <group ref={group}>
      <FlareBall ref={flareRef} sim={sim} radius={radius} clockRef={clockRef} />
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
  clockRef,
  scrub = null,
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
          clockRef={clockRef}
          scrub={scrub}
        />
      )}
    </group>
  );
}
