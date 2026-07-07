import React from 'react';
import { IconSun, IconMoon, LogoMark } from './icons.jsx';

export function ThemeToggle({ theme, setTheme, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
      className={`grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-[#e6e1d8] bg-white text-[#b8b2a7] transition-all hover:border-[oklch(0.55_0.13_262)] hover:text-[oklch(0.55_0.13_262)] active:scale-95 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-white/30 dark:hover:text-slate-100 ${className}`}
    >
      {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
    </button>
  );
}

export default function AppHeader({ theme, setTheme }) {
  return (
    <div className="flex shrink-0 items-center gap-3.5 border-b border-[#eeeae2] bg-white px-8 py-[18px] dark:border-white/10 dark:bg-slate-900">
      <LogoMark size={36} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[18px] font-semibold leading-tight tracking-[-0.02em] text-[#1c1b1a] dark:text-white">
          Lane Oil Pattern 3D
        </h1>
        <p className="text-xs text-[#a29c92] dark:text-slate-400">오일 패턴 시각화 · 분석</p>
      </div>
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
}
