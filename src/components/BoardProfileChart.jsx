import React from 'react';

// Cross-lane oil distribution: stacked forward (cyan) + reverse (blue) volume
// per board, mirroring the bar chart at the bottom of the machine sheet.
export default function BoardProfileChart({ data, showForward, showReverse }) {
  const max = Math.max(
    1,
    ...data.map((d) => {
      let v = 0;
      if (showForward) v += d.forward;
      if (showReverse) v += d.reverse;
      return v;
    })
  );

  const W = 300;
  const H = 120;
  const gap = 1;
  const bw = (W - gap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="board oil distribution">
      {data.map((d, i) => {
        const x = i * (bw + gap);
        const fwdH = showForward ? (d.forward / max) * H : 0;
        const revH = showReverse ? (d.reverse / max) * H : 0;
        return (
          <g key={d.board}>
            {showReverse && (
              <rect x={x} y={H - revH} width={bw} height={revH} fill="#2563eb" />
            )}
            {showForward && (
              <rect x={x} y={H - revH - fwdH} width={bw} height={fwdH} fill="#22d3ee" />
            )}
            {(d.board - 1) % 5 === 0 && (
              <text
                x={x + bw / 2}
                y={H + 12}
                textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500"
                fontSize="7"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
      <line x1="0" y1={H} x2={W} y2={H} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
    </svg>
  );
}
