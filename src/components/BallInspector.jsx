import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { FlareBall, computeFlareRings } from './BallPath.jsx';
import { IconX } from './icons.jsx';

// ---------------------------------------------------------------------------
// Ball inspector — a floating window (top-right of the canvas) that shows the
// ball on its own, isolated and enlarged, spinning and laying its oil-track
// flare in sync with the main playback. Sync comes for free: it renders the
// same <FlareBall> driven by the SAME shared playback clock ref, so its spin and
// the rings appearing always match the shot rolling down the lane.
// ---------------------------------------------------------------------------
export default function BallInspector({ sim, clockRef, theme = 'light', onClose, className = 'right-4 top-4' }) {
  const rings = useMemo(() => computeFlareRings(sim), [sim]);
  const dark = theme === 'dark';
  if (!sim || !sim.points || sim.points.length < 2) return null;

  return (
    <div className={`pointer-events-auto absolute z-30 w-[156px] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/90 sm:w-[190px] ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/10">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold text-slate-800 dark:text-white">볼 회전 · 트랙 플레어</div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500">재생과 동기화</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="닫기"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            <IconX size={13} />
          </button>
        )}
      </div>

      <div className="relative h-[172px] w-full sm:h-[190px]">
        <Canvas dpr={[1, 2]} camera={{ position: [0.5, 0.9, 4.6], fov: 30 }} gl={{ antialias: true }}>
          <color attach="background" args={[dark ? '#0b1120' : '#eef2f9']} />
          <ambientLight intensity={dark ? 0.7 : 0.95} />
          <hemisphereLight args={['#cfe0ff', dark ? '#0a0f1c' : '#c8d2e0', 0.6]} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} />
          <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#a9c5ff" />
          <FlareBall sim={sim} radius={1} clockRef={clockRef} />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI - 0.2}
            rotateSpeed={0.7}
          />
        </Canvas>
      </div>

      <div className="flex items-center justify-between gap-1 px-3 py-1.5 text-[9px] font-medium text-slate-500 dark:text-slate-400">
        <span>플레어 <span className="font-mono font-semibold text-slate-800 dark:text-sky-300">{rings.length}</span>줄</span>
        <span>축 <span className="font-mono font-semibold text-slate-800 dark:text-sky-300">{Math.round(sim.axisRotDeg ?? 55)}°</span></span>
        <span>틸트 <span className="font-mono font-semibold text-slate-800 dark:text-sky-300">{Math.round(sim.axisTiltDeg ?? 15)}°</span></span>
      </div>
    </div>
  );
}
