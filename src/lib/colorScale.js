// Heatmap colour ramps. Oil thickness maps from sky-blue (thin) to deep navy
// (thick). Each direction gets its own ramp so the user can tell layers apart,
// mirroring the machine sheet (Forward = cyan, Reverse = blue, Combined =
// navy build-up). The ramps are intentionally saturated/deep so even a thin
// film reads clearly against the wood.

const RAMPS = {
  forward: [
    [0.0, [103, 232, 249]], // cyan-300
    [0.45, [34, 211, 238]], // cyan-400
    [0.75, [8, 145, 178]], // cyan-700
    [1.0, [22, 78, 99]], // cyan-900
  ],
  reverse: [
    [0.0, [96, 165, 250]], // blue-400
    [0.45, [59, 130, 246]], // blue-500
    [0.75, [37, 99, 235]], // blue-600
    [1.0, [23, 37, 84]], // blue-950
  ],
  combined: [
    [0.0, [125, 211, 252]], // sky-300
    [0.3, [56, 189, 248]], // sky-400
    [0.55, [37, 99, 235]], // blue-600
    [0.8, [30, 58, 138]], // blue-900
    [1.0, [8, 15, 48]], // deep navy
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

// Alpha so that bare lane wood shows through only where it is genuinely dry,
// but ANY real film — including the thin oil on the sides of the block — reads
// as a clear tint over the wood. A high floor (0.62) prevents the side buffer
// from disappearing into the wood; it then ramps up and holds near opaque.
export function densityAlpha(t) {
  if (t <= 0) return 0;
  return Math.round(255 * Math.min(1, 0.62 + t * 0.38));
}

// CSS gradient string for the on-screen legend.
export function rampCss(layer = 'combined') {
  const stops = RAMPS[layer] || RAMPS.combined;
  const parts = stops.map(([p, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${Math.round(p * 100)}%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}
