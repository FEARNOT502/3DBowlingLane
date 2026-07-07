import * as THREE from 'three';
import { BOARD_COUNT, FEET_SAMPLES } from './laneConstants.js';
import { LAYER_COLORS, layeredColor, densityColor, PRES_THRESHOLD } from './colorScale.js';

// Turns an oil density grid into two GPU textures:
//   - colorTex: RGBA layer map (alpha lets the wood show through where dry)
//   - dispTex:  greyscale height map driving the 3D thickness relief
//
// Texture layout matches the density grid: width = boards, height = feet
// samples, row 0 = foul line. The board axis maps straight through: grid col 0
// (board 1 = "1L", the board beside the LEFT gutter) renders on the viewer's
// left, since the camera sits behind the foul line like the bowler reading the
// sheet.
//
// IMPORTANT — this matches the printed sheet's 3-swatch legend literally:
//   * COLOUR encodes only WHICH LAYER(S) cover a cell — cyan = forward only,
//     blue = reverse only, navy = both. It is a FLAT colour, no light/dark shading.
//   * Oil VOLUME (thickness) is shown by HEIGHT (the displacement map), not colour.
// So a thin buffer-brush wash and a thick centre build-up read as the SAME colour;
// only their height differs.

// A cell reads as WET when it carries at least this much conditioner, in
// ABSOLUTE ul per board-foot. The cut must NOT be relative to the pattern's
// normalisation: the buffer-brush film is a fixed ~1-2 ul/bf, so on a dense
// pattern a relative threshold climbs above the film and chops the wash off
// well short of the buff-out distance (e.g. at 38-40 ft on a 44 ft pattern).
const WET_MIN_UL = 0.4;
const WASH_COLOR = [186, 196, 244]; // periwinkle

// Height saturation: divide by <1 so the dense centre reaches full relief while
// the thinner mid-block still has visible height. Only affects the HEIGHT map.
const SATURATE = 0.8;

// Fade the displacement (height) to 0 over the first/last few rows so the
// raised oil slab doesn't stand up as a wall at the foul line / pin end and
// overlap the foul line — the COLOUR still shows there, only the relief tapers.
const EDGE_FADE_ROWS = 7;

// Per-texel colour/alpha fill (see the legend note above: colour encodes which
// layer(s) cover a cell — or the buffer-wash background — never thickness).
function fillColorTexels(color, grid, inv, layer, components, realistic) {
  const w = BOARD_COUNT;
  const h = FEET_SAMPLES;
  const useLayers = layer === 'combined' && components && components.forward && components.reverse;
  const hasPresence = !!(components && (components.forward || components.reverse));

  for (let i = 0; i < w * h; i += 1) {
    const rawAll = grid[i] * inv;
    const wet = grid[i] >= WET_MIN_UL;

    const pf = hasPresence && components.forward ? components.forward[i] : 0;
    const pr = hasPresence && components.reverse ? components.reverse[i] : 0;
    // A cell belongs to the oil BLOCK (legend colour) when an oil load actually
    // covers it — i.e. its (blurred) presence clears PRES_THRESHOLD. Wet cells
    // with no presence only carry the buffer-brush film and are drawn as the
    // sheet's pale periwinkle background wash instead.
    const covered = hasPresence ? pf >= PRES_THRESHOLD || pr >= PRES_THRESHOLD : wet;

    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    if (wet) {
      if (realistic) {
        // PBA real-lane look: conditioner is a CLEAR glaze — on TV it reads as a
        // faint cool sheen over the wood, never a painted block. Two things keep
        // it that way:
        //  1. Reinhard-compress the density (d = x/(x+k)) instead of clipping,
        //     so the heavy heads area deepens smoothly rather than flooding the
        //     whole front of the lane with one flat max colour.
        //  2. Keep alpha LOW end-to-end: the thin buffer wash is barely there
        //     and even the densest oil stays translucent enough to see boards.
        const d = rawAll / (rawAll + 0.6);
        [r, g, b] = densityColor(d, 'realistic');
        // Thin wash still tints the wood lightly (~80) but the oil block ramps to
        // fully opaque (255) so at opacity 1.0 it covers the lane layout — the
        // down-lane material opacity slider scales this back down for the faint
        // TV-glaze look.
        a = Math.min(255, Math.round(80 + d * 220));
      } else if (!covered) {
        // Buffer-brush film only: on the printed sheet this is the pale
        // periwinkle background, NOT a legend colour — the 3 flat legend colours
        // are reserved for the actual oil block.
        [r, g, b] = WASH_COLOR;
        a = 150;
      } else if (useLayers) {
        // Sheet look: flat layer colour from presence (which layers reach here).
        [r, g, b] = layeredColor(pf, pr, 0);
        a = 255;
      } else {
        // Single-layer sheet view: solid layer colour (cyan or blue), no shading.
        [r, g, b] = LAYER_COLORS[layer] || LAYER_COLORS.combined;
        a = 255;
      }
    }
    const o = i * 4;
    color[o] = r;
    color[o + 1] = g;
    color[o + 2] = b;
    color[o + 3] = a;
  }
}

// Per-texel displacement (height) fill: greyscale thickness relief, edge-faded
// so the slab tapers at the foul line / pin end.
function fillHeightTexels(disp, grid, inv) {
  const w = BOARD_COUNT;
  const h = FEET_SAMPLES;
  const rowFade = (row) => {
    const d = Math.min(row, h - 1 - row);
    return d >= EDGE_FADE_ROWS ? 1 : d / EDGE_FADE_ROWS;
  };

  for (let i = 0; i < w * h; i += 1) {
    const row = Math.floor(i / w);
    const rawAll = grid[i] * inv;
    const wet = grid[i] >= WET_MIN_UL;
    // Height (volume) ramp: 0..1 of the thickness, gamma-spread so the wash is low
    // and the centre is tall.
    const raw = wet ? Math.min(1, rawAll / SATURATE) : 0;
    const t = raw > 0 ? Math.pow(raw, 1.3) : 0;

    const o = i * 4;
    const v = Math.round(Math.min(1, Math.max(0, t)) * rowFade(row) * 255);
    disp[o] = v;
    disp[o + 1] = v;
    disp[o + 2] = v;
    disp[o + 3] = 255;
  }
}

// Side-wall fill (sheet mode with relief): the displaced plane's wall slope
// hangs over the first texel OUTSIDE the block, whose alpha is 0 (dry wood)
// or 150 (buffer wash) — so the outer half of every wall renders transparent
// and the raised block's edges look hollowed-out and jagged. Fill any low
// texel that sits beside a clearly taller one with that neighbour's colour at
// full alpha. The filled texel keeps ZERO height, so the fill paints exactly
// the wall footprint and never leaks onto the flat floor beyond it.
function fillSideWalls(color, disp) {
  const w = BOARD_COUNT;
  const h = FEET_SAMPLES;
  const WALL_STEP = 16; // min height gap (0..255) that reads as a wall
  const srcColor = color.slice(); // fill from originals only — no cascading
  for (let i = 0; i < w * h; i += 1) {
    if (srcColor[i * 4 + 3] === 255) continue; // block cells keep their colour
    const row = Math.floor(i / w);
    const col = i % w;
    const own = disp[i * 4];
    let best = -1;
    let bestDisp = own + WALL_STEP;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
        const n = nr * w + nc;
        if (srcColor[n * 4 + 3] === 255 && disp[n * 4] >= bestDisp) {
          best = n;
          bestDisp = disp[n * 4];
        }
      }
    }
    if (best >= 0) {
      color[i * 4] = srcColor[best * 4];
      color[i * 4 + 1] = srcColor[best * 4 + 1];
      color[i * 4 + 2] = srcColor[best * 4 + 2];
      color[i * 4 + 3] = 255;
    }
  }
}

// `mode`:
//   'sheet'     — printed-sheet look: FLAT layer colour (cyan/blue/navy), volume
//                 shown by height. Matches the Kegel/FLEX 3-swatch legend.
//   'realistic' — PBA real-lane look: translucent teal film that deepens with
//                 thickness and lets the wood show through (low alpha).
// `relief` — true when the caller renders the height map (thickness > 0); it
// enables the side-wall colour fill, which is meaningless on a flat film.
export function buildOilTextures(grid, max, layer, components = null, mode = 'sheet', relief = false) {
  const w = BOARD_COUNT;
  const h = FEET_SAMPLES;
  const color = new Uint8Array(w * h * 4);
  const disp = new Uint8Array(w * h * 4);
  const inv = max > 0 ? 1 / max : 0;
  const realistic = mode === 'realistic';

  fillColorTexels(color, grid, inv, layer, components, realistic);
  fillHeightTexels(disp, grid, inv);
  if (relief && !realistic) fillSideWalls(color, disp);

  const colorTex = new THREE.DataTexture(color, w, h, THREE.RGBAFormat);
  // The texture is only 39 px across (one texel per board): linear magnification
  // smears colours across several boards and melts the printed graph's hard
  // board-quantised edges. Sheet mode uses NEAREST so each board is a crisp
  // column, exactly like the print; realistic mode keeps the soft linear blend.
  colorTex.magFilter = realistic ? THREE.LinearFilter : THREE.NearestFilter;
  colorTex.minFilter = THREE.LinearFilter;
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.needsUpdate = true;

  const dispTex = new THREE.DataTexture(disp, w, h, THREE.RGBAFormat);
  dispTex.magFilter = THREE.LinearFilter;
  dispTex.minFilter = THREE.LinearFilter;
  dispTex.needsUpdate = true;

  return { colorTex, dispTex };
}
