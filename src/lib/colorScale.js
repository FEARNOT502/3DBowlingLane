// Heatmap colour ramps. Oil thickness maps from sky-blue (thin) to deep navy
// (thick). Each direction gets its own ramp so the user can tell layers apart,
// mirroring the machine sheet (Forward = cyan, Reverse = blue, Combined =
// navy build-up). The ramps are intentionally saturated/deep so even a thin
// film reads clearly against the wood.

// Ramps tuned to the Kegel/FLEX oil graph: each ramp goes light (thin film) to
// dark/saturated (thick). The legend assigns Forward = cyan, Reverse = blue,
// Combined(overlap) = navy; in the combined view we blend these three by layer
// composition (see oilTexture) so the picture matches the printed graphic.
const RAMPS = {
  forward: [
    [0.0, [165, 243, 252]], // cyan-200 (thin)
    [0.4, [34, 211, 238]], // cyan-400
    [0.8, [6, 182, 212]], // cyan-500
    [1.0, [14, 116, 144]], // cyan-800
  ],
  reverse: [
    [0.0, [191, 219, 254]], // blue-200 (thin)
    [0.4, [96, 165, 250]], // blue-400
    [0.8, [37, 99, 235]], // blue-600
    [1.0, [23, 37, 84]], // blue-950
  ],
  // Tuned to the FLEX/Kegel printed graph: light cyan shoulders, a broad bright
  // blue mid-range, deepening to a ROYAL navy core (not near-black). The sheet's
  // densest centre is still a recognisable blue, so the deepest stop stays well
  // above black to keep the stepped terraces readable.
  combined: [
    [0.0, [165, 223, 252]], // light cyan (thinnest shoulder)
    [0.25, [99, 179, 247]], // sky blue (thin edges)
    [0.55, [45, 110, 224]], // bright blue (mid block)
    [0.8, [30, 64, 165]], // blue (inner block)
    [1.0, [20, 38, 110]], // royal navy (thick core)
  ],
  // PBA "real lane" look: the oil is a translucent teal film over honey-coloured
  // wood. Thin film is a pale blue-green that barely tints the wood; thicker oil
  // deepens to a stronger teal/blue. Used with low alpha so the boards show
  // through (see oilTexture REALISTIC mode).
  realistic: [
    [0.0, [175, 205, 215]], // near-invisible cool sheen (thinnest wash)
    [0.35, [130, 175, 200]], // pale blue-grey glaze
    [0.7, [95, 145, 185]], // blue glaze (main block)
    [1.0, [70, 115, 165]], // deepest glaze (heavy heads oil)
  ],
};

const lerp = (a, b, t) => a + (b - a) * t;

function sampleRamp(stops, t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i += 1) {
    const [p0, c0] = stops[i - 1];
    const [p1, c1] = stops[i];
    if (x <= p1) {
      const k = p1 === p0 ? 0 : (x - p0) / (p1 - p0);
      return [
        Math.round(lerp(c0[0], c1[0], k)),
        Math.round(lerp(c0[1], c1[1], k)),
        Math.round(lerp(c0[2], c1[2], k)),
      ];
    }
  }
  return [...stops[stops.length - 1][1]];
}

// Returns [r, g, b] for a normalised value t in [0, 1].
export function densityColor(t, layer = 'combined') {
  return sampleRamp(RAMPS[layer] || RAMPS.combined, t);
}

// Combined-view colour for one cell, matching the printed graph's legend:
//   forward present + reverse present -> navy (combined)
//   forward present only             -> cyan
//   reverse present only             -> blue
// pf / pr are layer PRESENCE in [0, 1] (travel-inclusive coverage); t is the
// THICKNESS (0..1) used to pick how light/dark within each ramp. Weighting by
// presence — not by oil amount — keeps the overlap solid navy regardless of which
// layer happens to be thicker, exactly like the sheet.
const PRES_THRESHOLD = 0.3; // blurred coverage above this counts as "present"

// FLAT layer colours matching the printed sheet's 3-swatch legend exactly:
//   Forward = cyan, Reverse = blue, Combined(overlap) = navy.
// These are SOLID — oil VOLUME is shown by HEIGHT (displacement), not by shading,
// so the colour only encodes which layer(s) cover a cell, like the sheet.
export const LAYER_COLORS = {
  forward: [34, 211, 238], // cyan
  reverse: [37, 99, 235], // blue
  combined: [23, 37, 84], // navy
};

// Returns the flat layer colour for a cell from its forward/reverse presence:
//   forward + reverse -> navy, forward only -> cyan, reverse only -> blue.
// `t` (thickness) is intentionally ignored — volume is conveyed by height.
export function layeredColor(pf, pr, _t) {
  const f = Math.min(1, pf / PRES_THRESHOLD);
  const r = Math.min(1, pr / PRES_THRESHOLD);
  const wo = f * r; // both -> navy
  const wf = f * (1 - r); // forward only -> cyan
  const wr = r * (1 - f); // reverse only -> blue
  const sum = wo + wf + wr;
  if (sum <= 0) return [...LAYER_COLORS.combined];
  const cO = LAYER_COLORS.combined;
  const cF = LAYER_COLORS.forward;
  const cR = LAYER_COLORS.reverse;
  return [
    Math.round((cO[0] * wo + cF[0] * wf + cR[0] * wr) / sum),
    Math.round((cO[1] * wo + cF[1] * wf + cR[1] * wr) / sum),
    Math.round((cO[2] * wo + cF[2] * wf + cR[2] * wr) / sum),
  ];
}

// Like the machine sheet, ANY oil — even the thin film on the side boards or the
// light coat near the foul line — must read as a solid coloured tint, not as
// bare wood. So the alpha floor is HIGH (0.8): the gradient you see across the
// block is carried by the COLOUR ramp (bright cyan → deep navy), not by fading
// to transparency. Only genuinely dry wood (t = 0) shows through.
export function densityAlpha(t) {
  if (t <= 0) return 0;
  return Math.round(255 * Math.min(1, 0.8 + t * 0.2));
}

// CSS gradient string for the on-screen legend.
export function rampCss(layer = 'combined') {
  const stops = RAMPS[layer] || RAMPS.combined;
  const parts = stops.map(([p, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${Math.round(p * 100)}%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}
