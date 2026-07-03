import React, { useEffect, useMemo, useRef, useState } from 'react';

// Mobile bottom sheet with three snap points. The 3D canvas stays visible
// behind it; `header` (drag handle + tab bar) is always on screen at the peek
// snap, content scrolls internally at half/full.
export const SHEET_PEEK = 88;

export default function BottomSheet({ snap, onSnapChange, header, children }) {
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  const [dragH, setDragH] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const heights = useMemo(
    () => ({ peek: SHEET_PEEK, half: Math.round(vh * 0.52), full: Math.round(vh * 0.92) }),
    [vh]
  );
  const height = dragH ?? heights[snap] ?? SHEET_PEEK;

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startH: height,
      lastY: e.clientY,
      lastT: performance.now(),
      vel: 0,
      moved: false,
    };
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.vel = (d.lastY - e.clientY) / dt; // px/ms, positive = dragging up
    d.lastY = e.clientY;
    d.lastT = now;
    const next = Math.min(heights.full, Math.max(heights.peek, d.startH + (d.startY - e.clientY)));
    if (Math.abs(e.clientY - d.startY) > 4) d.moved = true;
    setDragH(next);
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const h = dragH ?? heights[snap];
    setDragH(null);

    // Tap (no real movement) toggles peek <-> half.
    if (!d.moved) {
      onSnapChange(snap === 'peek' ? 'half' : 'peek');
      return;
    }

    const order = ['peek', 'half', 'full'];
    let target;
    if (Math.abs(d.vel) > 0.45) {
      // Fling: move one snap in the fling direction.
      const cur = order.reduce((best, k) =>
        Math.abs(heights[k] - d.startH) < Math.abs(heights[best] - d.startH) ? k : best
      , 'peek');
      const idx = order.indexOf(cur);
      target = order[Math.min(2, Math.max(0, idx + (d.vel > 0 ? 1 : -1)))];
    } else {
      target = order.reduce((best, k) =>
        Math.abs(heights[k] - h) < Math.abs(heights[best] - h) ? k : best
      , 'peek');
    }
    onSnapChange(target);
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border border-b-0 border-slate-200 bg-slate-50 shadow-[0_-8px_30px_rgba(15,23,42,0.15)] dark:border-white/10 dark:bg-slate-950 ${
        dragH == null ? 'transition-[height] duration-300 ease-out' : ''
      }`}
      style={{ height }}
    >
      {/* Drag handle — the only drag surface, so tab taps and content scroll stay clean */}
      <div
        className="sheet-drag flex shrink-0 cursor-grab items-center justify-center pb-1 pt-2.5 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
      </div>

      <div className="shrink-0 px-3 pb-2">{header}</div>

      <div
        className={`scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-safe ${
          snap === 'peek' && dragH == null ? 'pointer-events-none opacity-0' : 'opacity-100'
        } transition-opacity duration-200`}
      >
        {children}
      </div>
    </div>
  );
}
