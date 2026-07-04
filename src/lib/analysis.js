import { BOARD_COUNT, FEET_RESOLUTION, FEET_SAMPLES } from './laneConstants.js';
import { boardLabel } from './boardUtils.js';

const avgRange = (arr, fromIdx, toIdx) => {
  let sum = 0;
  let n = 0;
  for (let i = fromIdx; i <= toIdx; i += 1) {
    if (i >= 0 && i < arr.length) {
      sum += arr[i];
      n += 1;
    }
  }
  return n ? sum / n : 0;
};

// Derived, transparent analytics computed from the combined density grid.
export function computeStats(model) {
  const totals = model.boardTotals.combined;
  const profile = model.profile.combined;

  // Peak board (highest oil volume across the lane width).
  let peakIdx = 0;
  for (let i = 1; i < totals.length; i += 1) if (totals[i] > totals[peakIdx]) peakIdx = i;

  // Pattern length: furthest foot that still carries oil.
  let lastRow = 0;
  for (let r = 0; r < profile.length; r += 1) if (profile[r] > 1e-6) lastRow = r;
  const patternEndFeet = (lastRow + 1) * FEET_RESOLUTION;

  // Centre-to-track oil ratio (derived): centre 5 boards (18-22) over the
  // track / "outside" zones (boards 13-17 & 23-27, i.e. the 3L-7L / 3R-7R area
  // the sheet uses). Labelled as derived so it isn't confused with the
  // machine's own Track Zone Ratio.
  const centre = avgRange(totals, 17, 21); // boards 18..22
  const track = (avgRange(totals, 12, 16) + avgRange(totals, 22, 26)) / 2; // 13..17 & 23..27
  const trackRatio = track > 0 ? centre / track : 0;

  return {
    peakBoard: boardLabel(peakIdx + 1),
    peakBoardVolume: totals[peakIdx],
    patternEndFeet,
    trackRatio,
  };
}

// Cross-section at a single down-lane distance: per-board densities (µl per
// board-foot) for the forward/reverse/combined layers. Same row shape as
// boardChartData so the two share one chart component.
export function sliceChartData(model, feet) {
  const row = Math.min(FEET_SAMPLES - 1, Math.max(0, Math.round(feet / FEET_RESOLUTION)));
  const out = [];
  for (let b = 0; b < BOARD_COUNT; b += 1) {
    const i = row * BOARD_COUNT + b;
    out.push({
      board: b + 1,
      label: boardLabel(b + 1),
      forward: model.forward[i],
      reverse: model.reverse[i],
      combined: model.combined[i],
    });
  }
  return out;
}

// Per-board forward/reverse totals (ul per board) for the cross-lane bar chart.
export function boardChartData(model) {
  const out = [];
  for (let b = 0; b < BOARD_COUNT; b += 1) {
    out.push({
      board: b + 1,
      label: boardLabel(b + 1),
      forward: model.boardTotals.forward[b],
      reverse: model.boardTotals.reverse[b],
      combined: model.boardTotals.combined[b],
    });
  }
  return out;
}
