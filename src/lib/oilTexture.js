import * as THREE from 'three';
import { BOARD_COUNT, FEET_SAMPLES } from './laneConstants.js';
import { densityColor, densityAlpha } from './colorScale.js';

// Turns an oil density grid into two GPU textures:
//   - colorTex: RGBA heatmap (alpha lets the wood show through where dry)
//   - dispTex:  greyscale height map used for optional 3D thickness relief
//
// Texture layout matches the density grid: width = boards, height = feet
// samples, row 0 = foul line. flipY is left at its default (false) so row 0
// maps to v = 0 (the near end of the lane).
export function buildOilTextures(grid, max, layer) {
  const w = BOARD_COUNT;
  const h = FEET_SAMPLES;
  const color = new Uint8Array(w * h * 4);
  const disp = new Uint8Array(w * h * 4);
  const inv = max > 0 ? 1 / max : 0;

  for (let i = 0; i < w * h; i += 1) {
    const raw = Math.min(1, grid[i] * inv);
    // Gamma boost: lift low/mid densities so the thinner oil on the SIDES of the
    // block reads clearly instead of washing out under the dense centre. A
    // stronger lift (0.5) keeps the buffer zone at the edges of the block from
    // looking like bare, dry wood.
    const t = raw > 0 ? Math.pow(raw, 0.5) : 0;
    const [r, g, b] = densityColor(t, layer);
    const a = densityAlpha(t);
    const o = i * 4;
    color[o] = r;
    color[o + 1] = g;
    color[o + 2] = b;
    color[o + 3] = a;

    const v = Math.round(Math.min(1, Math.max(0, t)) * 255);
    disp[o] = v;
    disp[o + 1] = v;
    disp[o + 2] = v;
    disp[o + 3] = 255;
  }

  const colorTex = new THREE.DataTexture(color, w, h, THREE.RGBAFormat);
  colorTex.magFilter = THREE.LinearFilter;
  colorTex.minFilter = THREE.LinearFilter;
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.needsUpdate = true;

  const dispTex = new THREE.DataTexture(disp, w, h, THREE.RGBAFormat);
  dispTex.magFilter = THREE.LinearFilter;
  dispTex.minFilter = THREE.LinearFilter;
  dispTex.needsUpdate = true;

  return { colorTex, dispTex };
}
