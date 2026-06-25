import { CENTER_BOARD, BOARD_COUNT } from './laneConstants.js';

// Kegel / CATS board notation uses distance from the centre board.
//   "2L"  -> 2 boards left of centre
//   "2R"  -> 2 boards right of centre
//   "20"  -> absolute board number / centre
// We map onto absolute board numbers 1..39 (board 20 = centre) so that the
// layout is symmetric around the middle of the lane.
export function boardFromNotation(raw) {
  if (raw == null) return null;
  const token = String(raw).trim().toUpperCase();
  if (token === '') return null;

  const match = token.match(/^(\d+(?:\.\d+)?)\s*([LRC]?)$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const side = match[2];

  let board;
  if (side === 'L') board = CENTER_BOARD - value;
  else if (side === 'R') board = CENTER_BOARD + value;
  else board = value; // absolute board number (or centre with no suffix)

  return clampBoard(board);
}

export function clampBoard(board) {
  return Math.min(BOARD_COUNT, Math.max(1, board));
}

// Human-readable label for an absolute board number (used in charts/legends).
export function boardLabel(board) {
  const delta = board - CENTER_BOARD;
  if (delta === 0) return '20';
  return delta < 0 ? `${Math.abs(delta)}L` : `${delta}R`;
}

// Inclusive board span [min, max] covered by a START->STOP pair.
export function boardSpan(startNotation, stopNotation) {
  const a = boardFromNotation(startNotation);
  const b = boardFromNotation(stopNotation);
  if (a == null || b == null) return null;
  return [Math.min(a, b), Math.max(a, b)];
}
