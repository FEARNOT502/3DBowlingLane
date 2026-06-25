import React from 'react';
import { rampCss } from '../lib/colorScale.js';

export default function Legend({ layer }) {
  const label =
    layer === 'forward' ? 'Forward' : layer === 'reverse' ? 'Reverse' : 'Combined';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>{label} 오일 두께</span>
        <span>얇음 → 두꺼움</span>
      </div>
      <div
        className="h-3 w-full rounded"
        style={{ background: layer === 'none' ? '#1e293b' : rampCss(layer) }}
      />
    </div>
  );
}
