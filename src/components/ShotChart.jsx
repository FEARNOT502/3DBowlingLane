import React from 'react';

// ---------------------------------------------------------------------------
// ShotChart — how the ball evolves down the lane: forward speed (line) and the
// skid→roll transition (slip, filled area) against distance. The breakpoint is
// marked so the reader can tie the numbers to the shape of the shot.
// ---------------------------------------------------------------------------
const LANE_FT = 60;

export default function ShotChart({ sim }) {
  if (!sim || !sim.points || sim.points.length < 2) return null;
  const W = 300;
  const H = 96;
  const pts = sim.points;

  const speeds = pts.map((p) => p.speed);
  const vMax = Math.max(...speeds, 1);
  const vMin = Math.min(...speeds, 0);
  const x = (ft) => (ft / LANE_FT) * W;
  const ySlip = (s) => H - s * H; // slip 1 (skid) at top, 0 (roll) at bottom
  const ySpeed = (v) => (vMax > vMin ? H - ((v - vMin) / (vMax - vMin)) * (H - 6) - 3 : H / 2);

  const slipArea =
    `M ${x(0)} ${H} ` +
    pts.map((p) => `L ${x(p.feet).toFixed(1)} ${ySlip(p.slip).toFixed(1)}`).join(' ') +
    ` L ${x(pts[pts.length - 1].feet)} ${H} Z`;
  const speedLine = pts
    .map((p, i) => `${i ? 'L' : 'M'} ${x(p.feet).toFixed(1)} ${ySpeed(p.speed).toFixed(1)}`)
    .join(' ');

  const bpFt = sim.breakpoint?.feet || 0;
  const KMH = 0.911344;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full" role="img" aria-label="shot speed and slip">
        <defs>
          <linearGradient id="slipFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        {/* arrows (15ft) + pattern-ish grid ticks */}
        {[15, 30, 45].map((ft) => (
          <line key={ft} x1={x(ft)} y1="0" x2={x(ft)} y2={H} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="0.5" />
        ))}
        {/* slip transition band */}
        <path d={slipArea} fill="url(#slipFill)" />
        {/* speed line */}
        <path d={speedLine} fill="none" stroke="#2563eb" strokeWidth="1.6" className="dark:stroke-sky-400" />
        {/* breakpoint */}
        {bpFt > 6 && (
          <line x1={x(bpFt)} y1="0" x2={x(bpFt)} y2={H} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" />
        )}
        <line x1="0" y1={H} x2={W} y2={H} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth="0.5" />
        {[0, 20, 40, 60].map((ft) => (
          <text key={ft} x={x(ft)} y={H + 11} textAnchor={ft === 0 ? 'start' : ft === 60 ? 'end' : 'middle'} className="fill-slate-400 dark:fill-slate-500" fontSize="7">
            {ft}ft
          </text>
        ))}
      </svg>
      <div className="mt-1 flex items-center gap-3 px-1 text-[9px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1"><span className="h-[2px] w-3 rounded bg-blue-600 dark:bg-sky-400" /> 스피드 {(vMin / KMH).toFixed(0)}~{(vMax / KMH).toFixed(0)}km/h</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400/40" /> 슬립(스키드→롤)</span>
        <span className="flex items-center gap-1"><span className="h-[2px] w-3 rounded bg-amber-400" /> BP</span>
      </div>
    </div>
  );
}
