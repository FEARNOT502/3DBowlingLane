import React, { useEffect, useRef, useState } from 'react';

function Chip({ active, onClick, title, children, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-all active:scale-95 ${
        active
          ? 'bg-[oklch(0.55_0.13_262)] text-white shadow-[0_1px_4px_rgba(91,110,224,0.28)] dark:bg-sky-500'
          : 'text-[#a8a297] hover:bg-[#f4f1eb] hover:text-[#6b665c] dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300'
      }`}
    >
      {dot && (
        <span
          className="inline-block h-2 w-2 rounded-[2px]"
          style={{ background: dot, opacity: active ? 1 : 0.4 }}
        />
      )}
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-[#eae5db] dark:bg-white/10" />;
}

// Floating quick-access toolbar over the 3D canvas. Mirrors the most-used view
// controls so the side panel / bottom sheet can stay closed while exploring.
// The width popover is rendered OUTSIDE the horizontally-scrolling row —
// overflow-x:auto would clip anything positioned above the bar.
export default function Toolbar({ view, onViewChange }) {
  const [widthOpen, setWidthOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!widthOpen) return;
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setWidthOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [widthOpen]);

  const widthPct = ((view.widthScale - 0.7) / (6 - 0.7)) * 100;

  return (
    <div ref={rootRef} className="pointer-events-auto relative max-w-[calc(100vw-24px)]">
      {widthOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-[#eae5db] bg-white p-3 shadow-[0_6px_22px_rgba(40,40,60,.1)] dark:border-white/10 dark:bg-slate-800">
          <div className="mb-2 flex justify-between text-[11px] text-[#6b665c] dark:text-slate-300">
            <span>레인 폭 배율</span>
            <span className="font-mono font-semibold tabular-nums text-[oklch(0.55_0.13_262)] dark:text-sky-300">
              {view.widthScale.toFixed(1)}×
            </span>
          </div>
          <input
            type="range"
            min={0.7}
            max={6}
            step={0.1}
            value={view.widthScale}
            onChange={(e) => onViewChange('widthScale', parseFloat(e.target.value))}
            className="range-input h-1 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(90deg, var(--slider-fill) ${widthPct}%, var(--slider-rest) ${widthPct}%)`,
            }}
          />
          <div className="mt-1 flex justify-between text-[10px] text-[#a8a297] dark:text-slate-500">
            <span>1× 실제</span>
            <span>5× 패턴표</span>
          </div>
        </div>
      )}

      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-[14px] border border-[#eae5db] bg-white/95 px-1.5 py-1.5 shadow-[0_6px_22px_rgba(40,40,60,.1)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/90">
        {/* oil display mode */}
        <div className="flex shrink-0 rounded-[9px] bg-[#f4f1eb] p-[3px] dark:bg-white/[0.06]">
          {[
            { id: 'sheet', label: '패턴표' },
            { id: 'realistic', label: '실제' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onViewChange('oilMode', m.id)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] transition-all ${
                view.oilMode === m.id
                  ? 'bg-white font-semibold text-[oklch(0.55_0.13_262)] shadow-[0_1px_3px_rgba(0,0,0,.06)] dark:bg-slate-600 dark:text-white'
                  : 'font-medium text-[#a8a297] dark:text-slate-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Divider />

        <Chip
          active={view.showForward}
          onClick={() => onViewChange('showForward', !view.showForward)}
          title="Forward 레이어"
          dot="#22d3ee"
        >
          F
        </Chip>
        <Chip
          active={view.showReverse}
          onClick={() => onViewChange('showReverse', !view.showReverse)}
          title="Reverse 레이어"
          dot="#3b82f6"
        >
          R
        </Chip>

        <Divider />

        <Chip
          active={view.showLabels}
          onClick={() => onViewChange('showLabels', !view.showLabels)}
          title="피트/보드 라벨"
        >
          라벨
        </Chip>
        <Chip
          active={view.showPins}
          onClick={() => onViewChange('showPins', !view.showPins)}
          title="볼링핀 표시"
        >
          핀
        </Chip>

        <Divider />

        <button
          type="button"
          onClick={() => setWidthOpen((o) => !o)}
          title="레인 폭 배율"
          aria-expanded={widthOpen}
          className={`flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 font-mono text-[11px] font-semibold tabular-nums transition-all ${
            widthOpen
              ? 'bg-[oklch(0.55_0.13_262)] text-white dark:bg-sky-500'
              : 'text-[#8a857b] hover:bg-[#f4f1eb] dark:text-slate-400 dark:hover:bg-white/[0.06]'
          }`}
        >
          폭 {view.widthScale.toFixed(1)}×
        </button>
      </div>
    </div>
  );
}
