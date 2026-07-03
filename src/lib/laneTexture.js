import * as THREE from 'three';
import { BOARD_COUNT, LANE_LENGTH_FEET } from './laneConstants.js';

const WOOD_TOP = '#caa069';
const WOOD_MID = '#d9b277';
const WOOD_BOT = '#c79a5e';

function woodGradient(ctx, H) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, WOOD_TOP);
  grad.addColorStop(0.55, WOOD_MID);
  grad.addColorStop(1, WOOD_BOT);
  return grad;
}

// Procedurally draws the playing lane with the real marking layout: 39 boards,
// board seams, the foul line, the 7 guide dots at 6 ft (boards 5..35), the 7
// targeting arrows at 12-16 ft (same boards, centre arrow closest to the pins)
// and the down-lane break-point range finders (inner pair at 34 ft on boards
// 15/25, outer pair at 40 ft on boards 10/30). UV space matches the oil
// heatmap (v = feet / 60, foul at the near end). The approach behind the foul
// line is intentionally omitted.
export function makeLaneTexture() {
  const W = 512;
  const H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const feetToY = (ft) => (1 - ft / LANE_LENGTH_FEET) * H; // CanvasTexture flipY = true
  const boardToX = (b) => (b / BOARD_COUNT) * W; // seam position (board edge)
  const boardCX = (b) => ((b - 0.5) / BOARD_COUNT) * W; // centre of board b
  const boardW = W / BOARD_COUNT;
  // boards 5,10,15,20,25,30,35 — the seven arrow (aim/target spot) boards
  const ARROW_BOARDS = [5, 10, 15, 20, 25, 30, 35];
  // guide dots 6 ft past the foul line: ten dots — boards 3,5,8,11,14 mirrored
  // on both sides, leaving the centre of the lane empty
  const GUIDE_DOT_BOARDS = [3, 5, 8, 11, 14, 26, 29, 32, 35, 37];

  ctx.fillStyle = woodGradient(ctx, H);
  ctx.fillRect(0, 0, W, H);

  for (let b = 0; b < BOARD_COUNT; b += 1) {
    if (b % 2 === 0) {
      ctx.fillStyle = 'rgba(120, 80, 40, 0.06)';
      ctx.fillRect(boardToX(b), 0, W / BOARD_COUNT, H);
    }
  }
  ctx.strokeStyle = 'rgba(60, 35, 10, 0.28)';
  ctx.lineWidth = 1;
  for (let b = 0; b <= BOARD_COUNT; b += 1) {
    const x = boardToX(b);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Foul line.
  ctx.fillStyle = 'rgba(120, 20, 20, 0.9)';
  ctx.fillRect(0, feetToY(0) - 5, W, 5);

  // Guide dots (가이드 스팟) — ten dots 6 ft past the foul line (5 per side,
  // centre of the lane left empty), centred on their boards.
  ctx.fillStyle = 'rgba(45, 28, 12, 0.72)';
  GUIDE_DOT_BOARDS.forEach((board) => {
    ctx.beginPath();
    ctx.arc(boardCX(board), feetToY(6), 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 7 targeting arrows (에임 스팟). Tips point down-lane toward the pins
  // (canvas top = far end). The CENTRE arrow (board 20) sits furthest down-lane
  // — closest to the pins — and the outer arrows step back toward the foul
  // line, forming the classic "^" pointing at the pins (12-16 ft).
  ctx.fillStyle = 'rgba(45, 28, 12, 0.82)';
  ARROW_BOARDS.forEach((board) => {
    const fromCentre = Math.abs(board - 20) / 5; // 0 at centre .. 3 at edges
    const ft = 12 + (3 - fromCentre) * 1.4; // centre deepest (~16.2 ft), edges ~12 ft
    const x = boardCX(board);
    const y = feetToY(ft);
    ctx.beginPath();
    ctx.moveTo(x, y - 26); // tip toward pins
    ctx.lineTo(x - boardW * 0.5, y + 16);
    ctx.lineTo(x + boardW * 0.5, y + 16);
    ctx.closePath();
    ctx.fill();
  });

  // Break-point range finders (브레이크 포인트 / 다운레인 마킹): four slim
  // 3 ft (0.914 m) bars — inner pair starting at 34 ft on boards 15/25, outer
  // pair starting at 40 ft on boards 10/30 — used to read the ball's break point.
  ctx.fillStyle = 'rgba(45, 28, 12, 0.7)';
  const drawRangeFinder = (board, startFt) => {
    const x = boardCX(board) - boardW * 0.32;
    const yFar = feetToY(startFt + 3);
    const yNear = feetToY(startFt);
    ctx.fillRect(x, yFar, boardW * 0.64, yNear - yFar);
  };
  [15, 25].forEach((b) => drawRangeFinder(b, 34));
  [10, 30].forEach((b) => drawRangeFinder(b, 40));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Plain board texture for the pin deck: the same 39 boards and seams as the
// lane (identical x positions, so the stripes run seamlessly under the pins)
// but without any markings. Colour matches the far end of the lane gradient.
export function makeDeckTexture() {
  const W = 512;
  const H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = WOOD_TOP; // far-end colour of the lane gradient
  ctx.fillRect(0, 0, W, H);

  const boardToX = (b) => (b / BOARD_COUNT) * W;
  for (let b = 0; b < BOARD_COUNT; b += 1) {
    if (b % 2 === 0) {
      ctx.fillStyle = 'rgba(120, 80, 40, 0.06)';
      ctx.fillRect(boardToX(b), 0, W / BOARD_COUNT, H);
    }
  }
  ctx.strokeStyle = 'rgba(60, 35, 10, 0.28)';
  ctx.lineWidth = 1;
  for (let b = 0; b <= BOARD_COUNT; b += 1) {
    const x = boardToX(b);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
