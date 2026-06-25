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

// Procedurally draws the playing lane: 39 boards, board seams, the foul line,
// the release dots (at the foul line), the 6 ft target dots, the 7 targeting
// arrows (the centre arrow sits closest to the pins, like a real lane) and the
// pin-deck shading. UV space matches the oil heatmap (v = feet / 60, foul at
// the near end). The approach behind the foul line is intentionally omitted.
export function makeLaneTexture() {
  const W = 512;
  const H = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const feetToY = (ft) => (1 - ft / LANE_LENGTH_FEET) * H; // CanvasTexture flipY = true
  const boardToX = (b) => (b / BOARD_COUNT) * W;
  // boards 5,10,15,20,25,30,35 — the seven guide/target boards
  const TARGET_BOARDS = [5, 10, 15, 20, 25, 30, 35];

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

  // Pin deck shading at the far end.
  ctx.fillStyle = 'rgba(30, 20, 10, 0.18)';
  ctx.fillRect(0, 0, W, feetToY(57));

  // Foul line.
  ctx.fillStyle = 'rgba(120, 20, 20, 0.9)';
  ctx.fillRect(0, feetToY(0) - 5, W, 5);

  // Release dots — the row of locator dots right at the foul line where the
  // ball is released. Slightly larger so they read as the launch reference.
  ctx.fillStyle = 'rgba(40, 24, 10, 0.78)';
  TARGET_BOARDS.forEach((board) => {
    ctx.beginPath();
    ctx.arc(boardToX(board), feetToY(0.8), 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // 6 ft target dots — the downlane guide dots a bowler sights over.
  ctx.fillStyle = 'rgba(45, 28, 12, 0.72)';
  TARGET_BOARDS.forEach((board) => {
    ctx.beginPath();
    ctx.arc(boardToX(board), feetToY(6), 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 7 targeting arrows. Tips point down-lane toward the pins (canvas top = far
  // end). The CENTRE arrow (board 20) sits furthest down-lane — closest to the
  // pins — and the outer arrows step back toward the foul line, forming the
  // classic "^" pointing at the pins.
  ctx.fillStyle = 'rgba(45, 28, 12, 0.82)';
  TARGET_BOARDS.forEach((board) => {
    const fromCentre = Math.abs(board - 20) / 5; // 0 at centre .. 3 at edges
    const ft = 12 + (3 - fromCentre) * 1.4; // centre deepest (~16.2 ft), edges ~12 ft
    const x = boardToX(board);
    const y = feetToY(ft);
    const w = W / BOARD_COUNT;
    ctx.beginPath();
    ctx.moveTo(x, y - 26); // tip toward pins
    ctx.lineTo(x - w * 0.5, y + 16);
    ctx.lineTo(x + w * 0.5, y + 16);
    ctx.closePath();
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
