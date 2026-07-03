import { CENTER_BOARD, BOARD_COUNT } from './laneConstants.js';

// Kegel / FLEX board notation counts boards in from EACH gutter, not from the
// centre board:
//   "4L"  -> 4th board from the left gutter  = board 4
//   "4R"  -> 4th board from the right gutter = board 36 (BOARD_COUNT + 1 - 4)
//   "20"  -> absolute board number / centre
// So "4L-4R" is a WIDE span (boards 4..36) and "14L-15R" a narrow one (14..25).
// The sheet's CROSSED column confirms this: CROSSED = LOADS × boards covered
// (e.g. 3 loads × 33 boards for 4L-4R = 99).
export function boardFromNotation(raw) {
  if (raw == null) return null;
  const token = String(raw).trim().toUpperCase();
  if (token === '') return null;

  const match = token.match(/^(\d+(?:\.\d+)?)\s*([LRC]?)$/);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const side = match[2];

  let board;
  if (side === 'L') board = value;
  else if (side === 'R') board = BOARD_COUNT + 1 - value;
  else if (side === 'C') board = CENTER_BOARD;
  else board = value; // absolute board number

  return clampBoard(board);
}

export function clampBoard(board) {
  return Math.min(BOARD_COUNT, Math.max(1, board));
}

// Human-readable label for an absolute board number (used in charts/legends).
// Mirrors the sheet notation: boards count in from each gutter.
export function boardLabel(board) {
  if (board === CENTER_BOARD) return '20';
  return board < CENTER_BOARD ? `${board}L` : `${BOARD_COUNT + 1 - board}R`;
}

// Inclusive board span [min, max] covered by a START->STOP pair.
export function boardSpan(startNotation, stopNotation) {
  const a = boardFromNotation(startNotation);
  const b = boardFromNotation(stopNotation);
  if (a == null || b == null) return null;
  return [Math.min(a, b), Math.max(a, b)];
}
