// ===========================================================================
// ballDesigns.js — 파란 베이스 커버스톡 3종 (Cobalt Storm / Midnight Flake / Electric Ice)
// ---------------------------------------------------------------------------
// 기존 BallPath.jsx 의 makeMarbleTexture() 를 대체합니다.
// makeBallTexture(designId) 로 커버스톡 텍스처를, BALL_DESIGNS 로 재질 파라미터를
// 얻어 <meshPhysicalMaterial> 에 넣으면 됩니다.  three@0.169 / R3F 그대로 동작.
// ===========================================================================
import * as THREE from 'three';

// 각 디자인: base(세로 그라데이션 3색) + veins(휘몰이 무늬) + (옵션)sparkle + mat(재질)
export const BALL_DESIGNS = {
  cobaltStorm: {
    id: 'cobaltStorm',
    name: 'Cobalt Storm',
    korName: '코발트 스톰',
    desc: '로열블루·청록·화이트 펄 하이글로스 마블',
    base: ['#1e3a8a', '#1d4ed8', '#1e40af'],
    veins: [
      { color: 'rgba(45,212,191,0.55)', width: [8, 30], n: 9 },  // 청록
      { color: 'rgba(224,242,254,0.60)', width: [6, 26], n: 9 }, // 화이트 펄
      { color: 'rgba(96,165,250,0.40)', width: [4, 16], n: 7 },  // 라이트 블루
      { color: 'rgba(12,20,55,0.50)', width: [8, 28], n: 7 },    // 다크 네이비
    ],
    mat: { roughness: 0.12, metalness: 0.35, clearcoat: 1.0, clearcoatRoughness: 0.08 },
  },

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

  electricIce: {
    id: 'electricIce',
    name: 'Electric Ice',
    korName: '일렉트릭 아이스',
    desc: '시안·코발트 위 흰 크랙 초광택 펄',
    base: ['#0ea5e9', '#2563eb', '#1e40af'],
    veins: [
      { color: 'rgba(255,255,255,0.85)', width: [2, 10], n: 13 }, // 흰 얼음 균열
      { color: 'rgba(186,230,253,0.60)', width: [3, 12], n: 8 },  // 페일 시안
      { color: 'rgba(3,105,161,0.45)', width: [6, 20], n: 6 },    // 딥 시안 음영
    ],
    mat: { roughness: 0.07, metalness: 0.20, clearcoat: 1.0, clearcoatRoughness: 0.03 },
  },
};

export const DEFAULT_DESIGN = 'cobaltStorm';

// ---------------------------------------------------------------------------
// makeBallTexture — 커버스톡 텍스처(equirectangular, 구에 감김).
// seed 를 주면 볼마다 다른 무늬, 생략하면 항상 같은 무늬(기존 동작과 동일).
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

  // sparkle — 금속 플레이크 (Midnight Flake 전용)
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
