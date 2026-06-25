import { boardFromNotation } from './boardUtils.js';

// ---------------------------------------------------------------------------
// Parses the raw "pass" tables copied out of a Kegel/FLEX lane-machine sheet.
//
// Two column layouts are supported (the only difference is the optional TANK
// column found on some sheets):
//
//   idx START STOP LOADS SPEED BUFFER        CROSSED START END FEET T.OIL
//   idx START STOP LOADS SPEED BUFFER TANK   CROSSED START END FEET T.OIL
//
// The leading row index is optional. Lines that don't look like data rows
// (headers, blanks) are skipped.
// ---------------------------------------------------------------------------

const toNum = (t) => {
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};

const isBoardToken = (t) => /^\d+(?:\.\d+)?[LRC]?$/i.test(t) && /[LRC]/i.test(t);
const isLetter = (t) => /^[A-Za-z]$/.test(t);

export function parsePassLine(line, direction) {
  let tokens = String(line).trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 9) return null;

  // Drop a leading numeric row index ("1", "2", ...) when present.
  if (/^\d+$/.test(tokens[0]) && tokens[1] && isBoardToken(tokens[1])) {
    tokens = tokens.slice(1);
  }

  // START / STOP must be board tokens, otherwise this isn't a data row.
  if (!isBoardToken(tokens[0]) || !isBoardToken(tokens[1])) return null;

  const start = tokens[0];
  const stop = tokens[1];
  const loads = toNum(tokens[2]);
  const speed = toNum(tokens[3]);
  const buffer = toNum(tokens[4]);

  let i = 5;
  let tank = null;
  if (tokens[i] && isLetter(tokens[i])) {
    tank = tokens[i].toUpperCase();
    i += 1;
  }

  const crossed = toNum(tokens[i++]);
  const startFt = toNum(tokens[i++]);
  const endFt = toNum(tokens[i++]);
  const feet = toNum(tokens[i++]);
  const totalOil = tokens[i] != null ? toNum(tokens[i++]) : 0;

  const boardA = boardFromNotation(start);
  const boardB = boardFromNotation(stop);
  if (boardA == null || boardB == null) return null;

  return {
    start,
    stop,
    boardMin: Math.min(boardA, boardB),
    boardMax: Math.max(boardA, boardB),
    loads,
    speed,
    buffer,
    tank,
    crossed,
    startFt,
    endFt,
    feet,
    feetMin: Math.min(startFt, endFt),
    feetMax: Math.max(startFt, endFt),
    totalOil,
    direction,
  };
}

export function parsePassTable(text, direction) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map((line) => parsePassLine(line, direction))
    .filter(Boolean);
}

// Sum of measured oil (T.OIL) across a set of passes, in millilitres.
export function totalOilMl(passes) {
  const ul = passes.reduce((sum, p) => sum + (p.totalOil || 0), 0);
  return ul / 1000;
}
