// ===========================================================================
// ballDesigns.js — 볼 커버스톡: Midnight Flake (깊은 네이비 솔리드 + 금속 플레이크)
// ---------------------------------------------------------------------------
// makeBallTexture() 로 커버스톡 텍스처를, BALL_DESIGNS 로 재질 파라미터를 얻어
// <meshPhysicalMaterial> 에 넣으면 됩니다.  three@0.169 / R3F 그대로 동작.
// ===========================================================================
import * as THREE from 'three';

// base(세로 그라데이션 3색) + veins(휘몰이 무늬) + sparkle(플레이크) + mat(재질)
export const BALL_DESIGNS = {
  midnightFlake: {
    id: 'midnightFlake',
    name: 'Midnight Flake',
    korName: '미드나잇 플레이크',
    desc: '깊은 네이비 솔리드 + 금속 플레이크 새틴',
    base: ['#0f172a', '#172554', '#0f1e40'],
    veins: [
      { color: 'rgba(30,58,138,0.50)', width: [10, 34], n: 5 },
      { color: 'rgba(37,99,235,0.30)', width: [6, 20], n: 4 },
    ],
    sparkle: { n: 1100, colors: ['#93c5fd', '#e0f2fe', '#60a5fa', '#bfdbfe'] },
    mat: { roughness: 0.30, metalness: 0.60, clearcoat: 0.5, clearcoatRoughness: 0.22 },
  },
};

export const DEFAULT_DESIGN = 'midnightFlake';

// ---------------------------------------------------------------------------
// makeBallTexture — 커버스톡 텍스처(equirectangular, 구에 감김).
// seed 를 주면 볼마다 다른 무늬, 생략하면 항상 같은 무늬.
// ---------------------------------------------------------------------------
export function makeBallTexture(designId = DEFAULT_DESIGN, seed0 = 20260705) {
  const cfg = BALL_DESIGNS[designId] || BALL_DESIGNS[DEFAULT_DESIGN];
  const W = 1024, H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let seed = seed0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // base — 세로 그라데이션
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, cfg.base[0]);
  base.addColorStop(0.5, cfg.base[1]);
  base.addColorStop(1, cfg.base[2]);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // veins — 좌우 wrap seam 을 감추려 [0,-W,W] 3회 그림
  for (const v of cfg.veins) {
    for (let i = 0; i < v.n; i += 1) {
      const x0 = rnd() * W;
      const y0 = rnd() * H;
      const segs = 3 + Math.floor(rnd() * 3);
      const lw = v.width[0] + rnd() * (v.width[1] - v.width[0]);
      for (const off of [0, -W, W]) {
        ctx.beginPath();
        ctx.moveTo(x0 + off, y0);
        let px = x0, py = y0;
        const s0 = seed;
        for (let s = 0; s < segs; s += 1) {
          const cx = px + (rnd() - 0.5) * 340;
          const cy = py + (rnd() - 0.5) * 240;
          px += (rnd() - 0.5) * 420;
          py += (rnd() - 0.5) * 260;
          ctx.quadraticCurveTo(cx + off, cy, px + off, py);
        }
        if (off !== W) seed = s0;
        ctx.strokeStyle = v.color;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }
  }

  // sparkle — 금속 플레이크
  if (cfg.sparkle) {
    for (let i = 0; i < cfg.sparkle.n; i += 1) {
      const x = rnd() * W, y = rnd() * H, r = 0.4 + rnd() * 1.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = cfg.sparkle.colors[Math.floor(rnd() * cfg.sparkle.colors.length)];
      ctx.globalAlpha = 0.5 + rnd() * 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
