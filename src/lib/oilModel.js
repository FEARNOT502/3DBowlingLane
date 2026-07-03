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

// ---------------------------------------------------------------------------
// Cross-lane / down-lane smoothing
// ---------------------------------------------------------------------------
// Each pass is laid down as a hard rectangle, but on a real lane the buffer
// brush feathers the oil sideways so the block has a smooth, tapering shoulder
// — the light-blue gradient you see on the SIDES of the pattern on the machine
// sheet. We reproduce that by running a separable Gaussian blur over the
// density grid: a wider kernel across boards (the visible side gradient) and a
// gentle one down-lane (to soften the seams between consecutive passes).

function gaussianKernel(sigma) {
  const radius = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i += 1) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i += 1) kernel[i] /= sum;
  return { kernel, radius };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Separable Gaussian blur with edge clamping. sigmaX is in boards, sigmaY in
// feet-samples. Returns a new grid; the input is left untouched.
function blurGrid(grid, sigmaX, sigmaY) {
  const w = BOARD_COUNT;
  const h = FEET_SAMPLES;
  const tmp = new Float32Array(grid.length);
  const out = new Float32Array(grid.length);

  // Horizontal pass (across boards) — this is what creates the side gradient.
  const { kernel: kx, radius: rx } = gaussianKernel(sigmaX);
  for (let row = 0; row < h; row += 1) {
    const base = row * w;
    for (let col = 0; col < w; col += 1) {
      let acc = 0;
      for (let k = -rx; k <= rx; k += 1) {
        acc += grid[base + clamp(col + k, 0, w - 1)] * kx[k + rx];
      }
      tmp[base + col] = acc;
    }
  }

  // Vertical pass (down-lane) — softens the seams between stacked passes.
  const { kernel: ky, radius: ry } = gaussianKernel(sigmaY);
  for (let col = 0; col < w; col += 1) {
    for (let row = 0; row < h; row += 1) {
      let acc = 0;
      for (let k = -ry; k <= ry; k += 1) {
        acc += tmp[clamp(row + k, 0, h - 1) * w + col] * ky[k + ry];
      }
      out[row * w + col] = acc;
    }
  }
  return out;
}

function oilForPass(pass) {
  if (pass.totalOil && pass.totalOil > 0) return pass.totalOil;
  // "Travel" rows (LOADS = 0, no T.OIL) lay no fresh oil — skip them. Note these
  // are narrow CENTRE passes (e.g. 2L->2R = boards 18..22), not a full-width
  // band, so they must not be synthesised into oil or they create a stray nub of
  // film at the foul line / pin end.
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

// ---------------------------------------------------------------------------
// Buffer-brush base film
// ---------------------------------------------------------------------------
// The buffer brush is a FULL-lane-width cylinder: while it is down it leaves a
// thin film of conditioner gutter-to-gutter, no matter how narrow the oil head's
// board span is. On the printed sheet this is the pale lavender wash that covers
// the whole lane width from the foul line out to the pattern distance (the bare
// wood only starts past the buff-out). We lay a faint full-width film from 0 ft
// out to the direction's buff reach, tapering slightly down-lane (the brush
// carries less conditioner the further it travels).
const BASE_FILM_DENSITY = 2; // ul per board-foot (thin wash; passes are ~5-140/bf)

function accumulateBaseFilm(grid, reachFeet) {
  if (!(reachFeet > 0)) return;
  const rowEnd = Math.min(FEET_SAMPLES - 1, Math.ceil(reachFeet / FEET_RESOLUTION) - 1);
  for (let row = 0; row <= rowEnd; row += 1) {
    const taper = 1 - 0.5 * (row / Math.max(1, rowEnd));
    const d = BASE_FILM_DENSITY * taper;
    for (let col = 0; col < BOARD_COUNT; col += 1) {
      grid[gridIndex(row, col)] += d;
    }
  }
}

// Furthest down-lane foot that actually receives oil in a set of passes.
function oiledReach(passes) {
  let reach = 0;
  for (const p of passes) {
    if (oilForPass(p) > 0 && p.feetMax > reach) reach = p.feetMax;
  }
  return reach;
}

// ---------------------------------------------------------------------------
// Buffer drag to the foul line
// ---------------------------------------------------------------------------
// The last oil load of a direction can stop short of the foul line (e.g. the
// reverse run's final load ends a few feet out, then only a LOADS = 0 travel row
// remains). The brush keeps buffing to the foul line and drags the remaining
// film with it at the width of that last load — which is why the printed graph
// shows the block running all the way into the foul line at (nearly) full
// width. We synthesise that as an extra pass covering 0 ft -> the first oiled
// foot with the same board span and density as the nearest oiled pass.
function dragToFoulPass(orientedPasses) {
  let first = null;
  for (const p of orientedPasses) {
    if (oilForPass(p) <= 0) continue;
    if (!first || p.feetMin < first.feetMin) first = p;
  }
  if (!first || first.feetMin <= FEET_RESOLUTION) return null;
  const nBoards = first.boardMax - first.boardMin + 1;
  const len = Math.max(first.feetMax - first.feetMin, FEET_RESOLUTION);
  const density = oilForPass(first) / (nBoards * len);
  return {
    ...first,
    feetMin: 0,
    feetMax: first.feetMin,
    totalOil: density * nBoards * first.feetMin,
  };
}

// Marks the footprint of a pass as "this layer is present here". Only passes
// that actually lay oil count: LOADS = 0 travel rows are just the machine
// repositioning with the brush up, and letting them paint presence creates
// artefacts the printed graph doesn't have (e.g. a navy centre stripe through
// the cyan forward-only cap at the end of the pattern).
function accumulatePresence(grid, pass) {
  if (oilForPass(pass) <= 0) return;
  const rowStart = Math.max(0, Math.floor(pass.feetMin / FEET_RESOLUTION));
  const rowEnd = Math.min(FEET_SAMPLES - 1, Math.ceil(pass.feetMax / FEET_RESOLUTION) - 1);
  const colStart = Math.max(0, Math.round(pass.boardMin) - 1);
  const colEnd = Math.min(BOARD_COUNT - 1, Math.round(pass.boardMax) - 1);
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) {
      grid[gridIndex(row, col)] = 1;
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

// Kegel sheets list forward loads from the foul line (0 ft) outward with the
// widest loads first, so the raw orientation is already foul-anchored — no
// mirroring needed. { flip: true } mirrors each pass's down-lane position
// around the furthest *oiled* foot, kept as an option for sheets (or user
// preference) that read the other way round.
export function buildOilModel(forwardPasses = [], reversePasses = [], options = {}) {
  const flip = options.flip === true;
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

  const forwardOriented = forwardPasses.map(orient);
  const reverseOriented = reversePasses.map(orient);

  // Buffer drag: extend each direction's nearest oiled pass to the foul line
  // (see dragToFoulPass). The synthetic pass carries real oil, so it shapes both
  // the density and the presence (hue) grids, exactly like the printed graph.
  const forwardAll = [...forwardOriented];
  const reverseAll = [...reverseOriented];
  const fDrag = dragToFoulPass(forwardOriented);
  const rDrag = dragToFoulPass(reverseOriented);
  if (fDrag) forwardAll.push(fDrag);
  if (rDrag) reverseAll.push(rDrag);

  forwardAll.forEach((p) => accumulate(forward, p));
  reverseAll.forEach((p) => accumulate(reverse, p));

  // Thin FULL-WIDTH buffer-brush wash (the lavender background on the printed
  // sheet). Forward buffs out to the pattern distance (buffOutFeet when the
  // caller knows it); reverse buffs from its brush-drop point back to the foul.
  const filmForward = forwardAll.length
    ? Math.max(oiledReach(forwardAll), options.buffOutFeet || 0)
    : 0;
  const filmReverse = reverseAll.length ? oiledReach(reverseAll) : 0;
  accumulateBaseFilm(forward, filmForward);
  accumulateBaseFilm(reverse, filmReverse);

  // Layer-presence grids (used only for HUE: cyan / blue / navy). Oiled passes
  // only — travel rows and the base film are excluded so the composition matches
  // the printed graph's legend colours.
  const forwardPresence = blankGrid();
  const reversePresence = blankGrid();
  forwardAll.forEach((p) => accumulatePresence(forwardPresence, p));
  reverseAll.forEach((p) => accumulatePresence(reversePresence, p));

  // Feather the hard pass rectangles into the smooth, tapering block seen on the
  // machine sheet. The cross-lane sigma is the visible "side gradient"; the
  // down-lane sigma just blends consecutive passes. `smooth` lets callers tune
  // or disable it (sigma in boards / feet-samples).
  //
  // The buffer brush feathers oil noticeably SIDEWAYS (across boards) — that soft
  // light-blue gradient running down both edges of the block on the printed sheet
  // — so the cross-lane sigma is WIDE (~2.2 boards). The down-lane sigma stays
  // TIGHT (~0.7) so the printed graph's stepped terraces survive: each pass is a
  // distinct board-width rung and we want those steps visible, just anti-aliased.
  const sx = options.smoothBoards != null ? options.smoothBoards : 2.2;
  const sy = options.smoothFeet != null ? options.smoothFeet : 0.7;
  const fwd = sx > 0 || sy > 0 ? blurGrid(forward, sx, sy) : forward;
  const rev = sx > 0 || sy > 0 ? blurGrid(reverse, sx, sy) : reverse;
  for (let i = 0; i < combined.length; i += 1) {
    forward[i] = fwd[i];
    reverse[i] = rev[i];
    combined[i] = fwd[i] + rev[i];
  }

  // Soften the presence masks the same way so the hue boundaries line up with
  // the (blurred) oil block edges.
  const fPres = sx > 0 || sy > 0 ? blurGrid(forwardPresence, sx, sy) : forwardPresence;
  const rPres = sx > 0 || sy > 0 ? blurGrid(reversePresence, sx, sy) : reversePresence;

  const maxForward = gridMax(forward);
  const maxReverse = gridMax(reverse);
  const maxCombined = gridMax(combined);

  return {
    forward,
    reverse,
    combined,
    presence: { forward: fPres, reverse: rPres },
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
    // Carry the component grids so the combined view can colour each cell by its
    // forward/reverse composition (cyan / blue / navy), like the printed graph.
    return {
      grid: model.combined,
      max: model.norm.combined,
      layer: 'combined',
      // Hue comes from layer PRESENCE (travel-inclusive); thickness from the grid.
      components: { forward: model.presence.forward, reverse: model.presence.reverse },
    };
  }
  // Normalise each single-layer view against its OWN robust reference, otherwise
  // dividing by the (larger) combined reference dims the layer and makes the
  // thinner oil on the sides of the block read as dry wood. Presence still rides
  // along so the texture can split "oil block" (legend colour) from "buffer
  // wash" (pale background) cells.
  if (showForward) {
    return {
      grid: model.forward,
      max: model.norm.forward,
      layer: 'forward',
      components: { forward: model.presence.forward, reverse: null },
    };
  }
  if (showReverse) {
    return {
      grid: model.reverse,
      max: model.norm.reverse,
      layer: 'reverse',
      components: { forward: null, reverse: model.presence.reverse },
    };
  }
  return { grid: blankGrid(), max: 1, layer: 'none' };
}
