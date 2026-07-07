import * as THREE from 'three';
import { BOARD_WIDTH_FEET } from './laneConstants.js';
import { clamp } from './utils.js';
import { axisTiltRel, DIFF_REF } from './ballMotion.js';

// ---------------------------------------------------------------------------
// Flare model — pure math shared by the 3D scene ball and the inspector ball
// (no R3F/scene code here).
// ---------------------------------------------------------------------------

export const BALL_DIAMETER_INCH = 8.5;
export const BALL_RADIUS_FT = BALL_DIAMETER_INCH / 2 / 12; // real radius, for spin rate
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
export const PAP_FROM_GRIP_RAD = (73 * Math.PI) / 180;
export const Z_AXIS = new THREE.Vector3(0, 0, 1);
export const UP = new THREE.Vector3(0, 1, 0);

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
  const diff = sim.diff || DIFF_REF;
  // centred so 15° tilt = the reference flare; more tilt = less flare.
  const tiltRel = axisTiltRel(sim.axisTiltDeg);
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
  const diffFactor = clamp(diff / DIFF_REF, 0.3, 1.9) * (1 - 0.6 * tiltRel);

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
export function stateAt(pts, t) {
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

export function spinAxisFrom(dir, slip, hand, axisRotRad) {
  const rollAxis = UP.clone().cross(dir).normalize();
  const sign = hand === 'L' ? -1 : 1;
  return rollAxis.applyAxisAngle(UP, sign * axisRotRad * slip).normalize();
}
