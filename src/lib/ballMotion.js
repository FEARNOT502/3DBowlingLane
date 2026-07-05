import {
  BOARD_COUNT,
  FEET_RESOLUTION,
  FEET_SAMPLES,
  LANE_LENGTH_FEET,
  BOARD_WIDTH_FEET,
} from './laneConstants.js';

// ===========================================================================
// Ball motion model
// ===========================================================================
// A grid-driven heuristic simulation: the ball is stepped down-lane row by row
// (0.25 ft), and at every step the LOCAL oil density under the ball sets the
// friction. Friction does three things, exactly like on a real lane:
//
//   1. spins the ball up (slip 1 -> 0): the transition skid -> hook -> roll
//   2. pushes the ball sideways while it still slips (the hook)
//   3. bleeds ball speed
//
// Ball specs map onto the model the way bowlers reason about them:
//   RG    — higher RG resists spinning up  -> longer skid, later breakpoint
//   Diff  — flare potential                -> scales total hook
//   PSA   — intermediate diff / angularity -> how ABRUPT the direction change
//           is at the breakpoint (smooth arc vs sharp flip)
//
// Coordinates: the simulation runs in BOWLER boards — counted in from the
// gutter on the bowler's hand side (right gutter for righties), which is how
// players call their line. Board 1 = gutter edge, the 1-3 (or 1-2) pocket sits
// at 17.5. The hook always pulls toward +boards (inward), so one code path
// serves both hands; only the grid lookup mirrors for right-handers.
// ===========================================================================

export const POCKET_BOWLER_BOARD = 17.5; // 1-3 pocket (R) / 1-2 pocket (L)
export const ARROWS_FEET = 15; // targeting row: the arrows

const G_FT = 32.174; // gravity, ft/s²
const KMH_TO_FTS = 0.911344;

export const DEFAULT_PLAYER = {
  hand: 'R',
  speedKmh: 30,
  revRpm: 350,
  rg: 2.5,
  diff: 0.048,
  psa: 0.015,
  // Release axis geometry. Rotation = how much the axis is turned toward the
  // travel line (side rotation → hook length). Tilt = how much the axis leans
  // up out of the lane (spiller) → LESS flare, earlier roll.
  axisRotDeg: 55,
  axisTiltDeg: 15,
  laydownBoard: 17,
  targetBoard: 10,
};

// Tunable physics constants (calibrated against a 40 ft house block so a
// tweener playing 2nd arrow enters the pocket at ~4-6°).
const P = {
  muOil: 0.012, // friction on saturated oil
  muDry: 0.23, // friction on bare wood
  dryK: 6, // (1-oil)^k — even a thin film stays slick, bare boards bite hard
  oilRef: 0.35, // fraction of the norm that already counts as "fully slick"
  slipDecay: 5.0, // how fast friction converts slip into roll
  hookGain: 1.0, // lateral force scale at full dry/slip/spec
  dragSlide: 1.1, // forward speed bleed while slipping
  dragRoll: 0.5, // forward speed bleed once rolling
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function bowlerToAbs(board, hand) {
  return hand === 'L' ? board : BOARD_COUNT + 1 - board;
}

// Normalised oil (0 = bare wood, 1 = fully saturated) under a continuous
// bowler-board position. Linear across neighbouring boards so the ball does
// not "step" over board seams.
function oilAt(grid, norm, feet, bowlerBoard, hand) {
  const row = clamp(Math.floor(feet / FEET_RESOLUTION), 0, FEET_SAMPLES - 1);
  const abs = clamp(bowlerToAbs(bowlerBoard, hand), 1, BOARD_COUNT);
  const colF = abs - 1;
  const c0 = Math.floor(colF);
  const c1 = Math.min(BOARD_COUNT - 1, c0 + 1);
  const f = colF - c0;
  const v = grid[row * BOARD_COUNT + c0] * (1 - f) + grid[row * BOARD_COUNT + c1] * f;
  return norm > 0 ? clamp(v / norm, 0, 1) : 0;
}

function frictionFromOil(oil) {
  const eff = clamp(oil / P.oilRef, 0, 1);
  return P.muOil + (P.muDry - P.muOil) * Math.pow(1 - eff, P.dryK);
}

// Ball-spec factors --------------------------------------------------------

function specFactors({ revRpm, rg, diff, psa, speedKmh, axisRotDeg, axisTiltDeg }) {
  const revN = clamp(revRpm / 350, 0.3, 2.2);
  // RG 2.46 (low, early) .. 2.60+ (high, long): scales how much slip the ball
  // starts with, i.e. how long it takes friction to stand it up.
  const rgN = clamp((rg - 2.46) / 0.14, -0.25, 1.9);
  // Diff 0.048 as the reference flare; scales lateral force.
  const diffN = clamp(diff / 0.048, 0.1, 1.9);
  // PSA (intermediate diff): 0 = smooth benchmark arc, 0.030+ = violent flip.
  const psaN = clamp((psa || 0) / 0.015, 0, 2.7);
  // Axis rotation 55° and tilt 15° are the tweener REFERENCE: both factors below
  // are centred to 1.0 there, so the default release reproduces the original
  // calibration exactly and only deviating from 55°/15° changes the shot.
  // More side rotation = more revs go sideways → more hook, stands up a touch
  // later. More tilt = "spiller" → less flare, earlier roll, less hook.
  const axisRotN = clamp((axisRotDeg ?? 55) / 55, 0.15, 1.75); // 1.0 at 55°
  const tiltRel = clamp(((axisTiltDeg ?? 15) - 15) / 90, -0.17, 0.5); // 0 at 15°
  const v0 = Math.max(8, speedKmh * KMH_TO_FTS);
  return {
    v0,
    // characteristic slip "budget" — bigger = longer skid phase
    slipBudget: (0.62 + 0.55 * rgN) * (v0 / 27.4) * (1 + 0.12 * (axisRotN - 1)),
    hookMul:
      Math.pow(revN, 0.9) *
      (0.45 + 0.55 * diffN) *
      (0.6 + 0.4 * axisRotN) *
      (1 - 0.6 * tiltRel),
    // hook-force shape vs remaining slip: s^exp. Small exponent (high PSA)
    // keeps the force at full strength until slip runs out -> sharp break.
    shapeExp: clamp(1.7 - 0.75 * psaN, 0.35, 1.7),
  };
}

// ---------------------------------------------------------------------------
// simulateShot — steps one shot down the lane over the given (combined) grid.
// ---------------------------------------------------------------------------
export function simulateShot(grid, norm, player) {
  const p = { ...DEFAULT_PLAYER, ...player };
  const spec = specFactors(p);

  // Launch: laydown at the foul line, aimed through the target at the arrows.
  const dy = FEET_RESOLUTION;
  let x = p.laydownBoard; // bowler boards
  let v = spec.v0; // ft/s along the lane (angles are tiny)
  let vx = ((p.targetBoard - p.laydownBoard) * BOARD_WIDTH_FEET / ARROWS_FEET) * v; // ft/s lateral
  let slip = 1;
  let t = 0;

  const points = [];
  let breakpoint = { feet: 0, board: x };
  let hookStartFeet = null;
  let rollFeet = null;
  let gutterFeet = null;
  let oilSum = 0;
  let oilN = 0;

  for (let feet = 0; feet <= LANE_LENGTH_FEET + 1e-6; feet += dy) {
    const oil = oilAt(grid, norm, feet, x, p.hand);
    const mu = frictionFromOil(oil);
    if (feet >= 8 && feet <= 45) {
      oilSum += oil;
      oilN += 1;
    }

    const phase = slip > 0.82 ? 'skid' : slip > 0.12 ? 'hook' : 'roll';
    points.push({ feet, board: x, abs: bowlerToAbs(x, p.hand), speed: v, slip, phase, t, oil });

    if (hookStartFeet == null && phase === 'hook') hookStartFeet = feet;
    if (rollFeet == null && phase === 'roll') rollFeet = feet;
    if (x < breakpoint.board) breakpoint = { feet, board: x };

    if (gutterFeet == null && (x < 0.5 || x > BOARD_COUNT + 0.5)) gutterFeet = feet;

    // --- step ---
    const dt = dy / Math.max(4, v);
    // lateral hook force: needs friction AND remaining slip
    const a = P.hookGain * G_FT * mu * spec.hookMul * Math.pow(slip, spec.shapeExp);
    if (gutterFeet == null) {
      vx += a * dt;
      x += (vx * dt) / BOARD_WIDTH_FEET;
    }
    // slip -> roll conversion, friction driven; RG/speed stretch it out
    slip = Math.max(0, slip - (P.slipDecay * mu * G_FT * dt) / (spec.slipBudget * 27.4));
    // speed bleed
    v = Math.max(6, v - (slip > 0.12 ? P.dragSlide : P.dragRoll) * mu * G_FT * dt);
    t += dt;
  }

  const last = points[points.length - 1];
  const entryBoard = last.board;
  const entryAngleDeg = (Math.atan2(vx, v) * 180) / Math.PI;
  const pocketOffset = entryBoard - POCKET_BOWLER_BOARD;

  let verdict;
  if (gutterFeet != null) verdict = 'gutter';
  else if (Math.abs(pocketOffset) <= 1) verdict = 'pocket';
  else if (pocketOffset > 1) verdict = 'high';
  else verdict = 'light';

  return {
    points,
    hand: p.hand,
    revRpm: p.revRpm,
    diff: p.diff,
    axisRotDeg: p.axisRotDeg ?? 55,
    axisTiltDeg: p.axisTiltDeg ?? 15,
    entryBoard,
    entryAngleDeg,
    entrySpeedKmh: last.speed / KMH_TO_FTS,
    pocketOffset,
    verdict,
    gutterFeet,
    breakpoint,
    hookStartFeet,
    rollFeet,
    totalTime: t,
    avgPathOil: oilN ? oilSum / oilN : 0,
  };
}

// ---------------------------------------------------------------------------
// recommendLines — searches laydown × target space and returns the best
// outside (윗장: 사용 손 쪽 바깥) and inside (아랫장: 안쪽) lines with scores
// and rationale.
// ---------------------------------------------------------------------------

function scoreShot(sim, tolFrac, patternFeet) {
  if (sim.verdict === 'gutter') return 0;
  const pocket = Math.exp(-Math.pow(sim.pocketOffset / 1.15, 2));
  // entry angle sweet spot ~5°; too straight deflects, too steep splits
  const angle = 0.35 + 0.65 * Math.exp(-Math.pow((sim.entryAngleDeg - 5) / 2.6, 2));
  // gutter flirting: breakpoints inside board ~3.5 are one bad release from a
  // washout, so discount them even when they pocket on paper
  const bp = sim.breakpoint;
  const gutterPen = bp.board < 3.5 ? Math.exp(-Math.pow((3.5 - bp.board) / 1.4, 2)) : 1;
  // a breakpoint far before the end of the pattern means the ball burns up
  const early = patternFeet ? Math.max(0, patternFeet - 12 - bp.feet) : 0;
  const earlyPen = Math.exp(-Math.pow(early / 10, 2));
  return pocket * angle * (0.55 + 0.45 * tolFrac) * gutterPen * earlyPen;
}

function evaluateLine(grid, norm, player, laydown, target, patternFeet) {
  const sim = simulateShot(grid, norm, { ...player, laydownBoard: laydown, targetBoard: target });
  if (sim.verdict === 'gutter') return { sim, score: 0, tolFrac: 0 };
  // miss room: nudge the target ±0.6 board and see if the pocket survives
  let ok = 0;
  for (const d of [-0.6, 0.6]) {
    const s = simulateShot(grid, norm, {
      ...player,
      laydownBoard: laydown,
      targetBoard: target + d,
    });
    if (s.verdict !== 'gutter' && Math.abs(s.pocketOffset) <= 1.6) ok += 1;
  }
  const tolFrac = ok / 2;
  return { sim, score: scoreShot(sim, tolFrac, patternFeet), tolFrac };
}

export function recommendLines(grid, norm, player, patternFeet) {
  const zones = {
    // 윗장(outside): 1st~2nd arrow territory. 아랫장(inside): 3rd arrow and deeper.
    outside: { targets: [4, 11], laydowns: [8, 22] },
    inside: { targets: [11.5, 22], laydowns: [16, 34] },
  };
  const rule31 = patternFeet ? Math.round((patternFeet - 31) * 10) / 10 : null;

  const result = {};
  for (const [key, z] of Object.entries(zones)) {
    let best = null;
    for (let target = z.targets[0]; target <= z.targets[1]; target += 1) {
      for (let laydown = Math.max(target + 1, z.laydowns[0]); laydown <= z.laydowns[1]; laydown += 1) {
        const ev = evaluateLine(grid, norm, player, laydown, target, patternFeet);
        if (!best || ev.score > best.score) {
          best = { ...ev, laydownBoard: laydown, targetBoard: target };
        }
      }
    }
    if (best && best.score > 0.05) {
      // refine the winner at half-board resolution
      for (const dt of [-0.5, 0, 0.5]) {
        for (const dl of [-0.5, 0, 0.5]) {
          if (!dt && !dl) continue;
          const ev = evaluateLine(
            grid,
            norm,
            player,
            best.laydownBoard + dl,
            best.targetBoard + dt,
            patternFeet
          );
          if (ev.score > best.score) {
            best = {
              ...ev,
              laydownBoard: best.laydownBoard + dl,
              targetBoard: best.targetBoard + dt,
            };
          }
        }
      }
      best.reasons = lineReasons(best, rule31);
      result[key] = best;
    } else {
      result[key] = null;
    }
  }
  return { ...result, rule31 };
}

function lineReasons(line, rule31) {
  const { sim, tolFrac } = line;
  const reasons = [];
  reasons.push(
    `엔트리 ${sim.entryBoard.toFixed(1)}보드 · ${sim.entryAngleDeg.toFixed(1)}° — 포켓(17.5보드) 기준 ${
      Math.abs(sim.pocketOffset) <= 1 ? '정타' : sim.pocketOffset > 0 ? '두꺼움' : '얇음'
    }, 이상적 진입각은 4~6°`
  );
  reasons.push(
    `브레이크포인트 ${sim.breakpoint.board.toFixed(1)}보드 @ ${sim.breakpoint.feet.toFixed(0)}ft${
      rule31 != null ? ` (Rule of 31 예상 ${rule31}보드)` : ''
    }`
  );
  reasons.push(
    tolFrac >= 1
      ? '타겟 ±0.6보드 미스에도 포켓 유지 — 관용도 높은 라인'
      : tolFrac > 0
        ? '한쪽 미스만 허용 — 릴리스 일관성 필요'
        : '미스 관용도 낮음 — 정확한 타겟팅 필요'
  );
  reasons.push(
    sim.avgPathOil > 0.55
      ? `진행 경로 평균 오일이 많아(${Math.round(sim.avgPathOil * 100)}%) 스키드가 길게 유지됨`
      : `진행 경로 오일이 적어(${Math.round(sim.avgPathOil * 100)}%) 볼 반응이 빠름 — 스피드 유지가 중요`
  );
  return reasons;
}
