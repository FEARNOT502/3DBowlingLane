import {
  BOARD_COUNT,
  FEET_SAMPLES,
  FEET_RESOLUTION,
  DEFAULT_OIL_PER_BOARD_UL,
} from './laneConstants.js';

// ===========================================================================
// Oil density model
// ===========================================================================
// Each pass deposits oil across a rectangular footprint of the lane defined by
// its board span (START -> STOP) and its down-lane span (START ft -> END ft).
//
// We model the deposited oil as evenly spread over that footprint, expressed as
// a DENSITY in "micro-litres per board-foot" so the value is independent of the
// grid resolution:
//
//     density = oilForThePass / (boardsCovered * feetLength)
//
// The oil for a pass is taken from the measured T.OIL column when available.
// When it is missing we estimate it from the machine settings the user asked us
// to honour — LOADS (how many oil layers are laid) and SPEED (buffer speed):
//
//     oil ≈ LOADS * OIL_PER_BOARD * boardsCovered            (volume laid)
//     density already divides by feetLength, and feetLength grows with SPEED,
//     so a faster buffer naturally produces a thinner film.
//
// Because passes within one direction tile the lane down-lane (each owns a
// different foot range) while the wide passes cover more boards than the narrow
// ones, summing the grid reproduces the classic centre-heavy "house" cross
// section seen on the machine sheet.
// ===========================================================================

const gridIndex = (row, col) => row * BOARD_COUNT + col;

function blankGrid() {
  return new Float32Array(FEET_SAMPLES * BOARD_COUNT);
}

function oilForPass(pass) {
  if (pass.totalOil && pass.totalOil > 0) return pass.totalOil;
  const nBoards = pass.boardMax - pass.boardMin + 1;
  return (pass.loads || 0) * DEFAULT_OIL_PER_BOARD_UL * nBoards;
}

function accumulate(grid, pass) {
  const nBoards = pass.boardMax - pass.boardMin + 1;
  const feetLength = Math.max(pass.feetMax - pass.feetMin, FEET_RESOLUTION);
  const oil = oilForPass(pass);
  if (oil <= 0 || nBoards <= 0) return;

  const density = oil / (nBoards * feetLength); // ul per board-foot

  const rowStart = Math.max(0, Math.floor(pass.feetMin / FEET_RESOLUTION));
  const rowEnd = Math.min(FEET_SAMPLES - 1, Math.ceil(pass.feetMax / FEET_RESOLUTION) - 1);
  const colStart = Math.max(0, Math.round(pass.boardMin) - 1);
  const colEnd = Math.min(BOARD_COUNT - 1, Math.round(pass.boardMax) - 1);

  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      grid[gridIndex(row, col)] += density;
    }
  }
}

function gridMax(grid) {
  let max = 0;
  for (let i = 0; i < grid.length; i += 1) if (grid[i] > max) max = grid[i];
  return max;
}

// 90th-percentile of the non-zero cells — a normalisation reference that is
// not dominated by a single sharp density spike.
function robustNorm(grid) {
  const vals = [];
  for (let i = 0; i < grid.length; i += 1) if (grid[i] > 0) vals.push(grid[i]);
  if (!vals.length) return 1;
  vals.sort((a, b) => a - b);
  const v = vals[Math.floor(vals.length * 0.9)];
  return v > 0 ? v : vals[vals.length - 1];
}

// Sum down-lane to get total oil volume per board (ul per board) — this is the
// cross-lane distribution shown in the machine's bottom bar chart.
function boardTotals(grid) {
  const totals = new Float32Array(BOARD_COUNT);
  for (let row = 0; row < FEET_SAMPLES; row += 1) {
    for (let col = 0; col < BOARD_COUNT; col += 1) {
      totals[col] += grid[gridIndex(row, col)] * FEET_RESOLUTION;
    }
  }
  return totals;
}

// Sum across boards to get an oil profile down the lane (ul per foot).
function downLaneProfile(grid) {
  const profile = new Float32Array(FEET_SAMPLES);
  for (let row = 0; row < FEET_SAMPLES; row += 1) {
    let sum = 0;
    for (let col = 0; col < BOARD_COUNT; col += 1) sum += grid[gridIndex(row, col)];
    profile[row] = sum;
  }
  return profile;
}

// The machine sheets list the buffer loads from the foul line outward, which
// for these patterns puts the narrow loads at the foul line and the wide loads
// down-lane. Bowlers read the pattern the other way round — widest at the foul
// line, tapering toward the pins — so by default we mirror each pass's
// down-lane position around the furthest *oiled* foot, anchoring the pattern at
// the foul line. Set { flip: false } to keep the raw sheet orientation.
export function buildOilModel(forwardPasses = [], reversePasses = [], options = {}) {
  const flip = options.flip !== false;
  const forward = blankGrid();
  const reverse = blankGrid();
  const combined = blankGrid();

  let maxOiledFeet = 0;
  [...forwardPasses, ...reversePasses].forEach((p) => {
    if (oilForPass(p) > 0 && p.feetMax > maxOiledFeet) maxOiledFeet = p.feetMax;
  });

  const orient = (p) => {
    if (!flip || maxOiledFeet <= 0) return p;
    return { ...p, feetMin: maxOiledFeet - p.feetMax, feetMax: maxOiledFeet - p.feetMin };
  };

  forwardPasses.forEach((p) => accumulate(forward, orient(p)));
  reversePasses.forEach((p) => accumulate(reverse, orient(p)));
  for (let i = 0; i < combined.length; i += 1) combined[i] = forward[i] + reverse[i];

  const maxForward = gridMax(forward);
  const maxReverse = gridMax(reverse);
  const maxCombined = gridMax(combined);

  return {
    forward,
    reverse,
    combined,
    max: { forward: maxForward, reverse: maxReverse, combined: maxCombined },
    // Robust normalisation reference (90th percentile of wet cells). Using this
    // instead of the raw max keeps the narrow high-density spike from washing
    // out the thinner oil on the SIDES of the block — the spike just clips.
    norm: {
      forward: robustNorm(forward),
      reverse: robustNorm(reverse),
      combined: robustNorm(combined),
    },
    boardTotals: {
      forward: boardTotals(forward),
      reverse: boardTotals(reverse),
      combined: boardTotals(combined),
    },
    profile: {
      forward: downLaneProfile(forward),
      reverse: downLaneProfile(reverse),
      combined: downLaneProfile(combined),
    },
  };
}

// Combine an arbitrary set of enabled layers into a single grid + its max,
// used to drive the heatmap when the user toggles Forward / Reverse on or off.
export function selectGrid(model, showForward, showReverse) {
  if (showForward && showReverse) {
    return { grid: model.combined, max: model.norm.combined, layer: 'combined' };
  }
  // Normalise each single-layer view against its OWN robust reference, otherwise
  // dividing by the (larger) combined reference dims the layer and makes the
  // thinner oil on the sides of the block read as dry wood.
  if (showForward) return { grid: model.forward, max: model.norm.forward, layer: 'forward' };
  if (showReverse) return { grid: model.reverse, max: model.norm.reverse, layer: 'reverse' };
  return { grid: blankGrid(), max: 1, layer: 'none' };
}
