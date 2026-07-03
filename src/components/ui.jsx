import React, { useState } from 'react';
import { IconCopy, IconCheck, IconChevron } from './icons.jsx';

// ---------------------------------------------------------------------------
// Shared UI primitives — flat, typography-first "infographic" style.
// Neutral surfaces + hairline borders; near-black primary actions; blue is
// reserved for data (forward/reverse layers, slider fills, key numbers).
// Every surface pairs a light class with a `dark:` fallback.
// ---------------------------------------------------------------------------

// Each section is a floating white card on the panel's light-grey canvas —
// the sidebar reads as a stack of cards rather than one long divided column.
export function Section({ title, children, hint, action }) {
  return (
    <section className="mx-3 mt-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/60 dark:border-white/10 dark:bg-slate-900 dark:shadow-none sm:mx-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex shrink-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-200">
          <span className="h-3.5 w-1 rounded-full bg-blue-500 dark:bg-sky-400" />
          {title}
        </h2>
        {action}
      </div>
      {hint && (
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">{hint}</p>
      )}
      {children}
    </section>
  );
}

// Inset panel used INSIDE a Section card — a soft grey well.
export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.03] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '', type = 'button' }) {
  const styles = {
    primary:
      'bg-blue-600 text-white shadow-sm shadow-blue-600/25 hover:bg-blue-500 active:scale-[0.99] dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400',
    soft:
      'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-600 active:scale-[0.99] dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:shadow-none dark:hover:border-sky-400/50 dark:hover:text-sky-300',
    ghost:
      'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06]',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Toggle({ label, checked, onChange, color }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="group flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
    >
      <span className="flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-200">
        {color && <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />}
        {label}
      </span>
      <span
        className={`relative h-[18px] w-[34px] shrink-0 rounded-full transition-colors ${
          checked ? 'bg-blue-600 dark:bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </button>
  );
}

export function Slider({ label, value, min, max, step, onChange, fmt = (v) => v, suffix }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="px-2 py-2">
      <div className="mb-2 flex items-baseline justify-between text-xs text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums text-blue-600 dark:text-sky-300">
          {fmt(value)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="range-input h-1 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(90deg, var(--slider-fill) ${pct}%, var(--slider-rest) ${pct}%)`,
        }}
      />
    </div>
  );
}

// Infographic stat tile: tiny caps label on top, large tabular number, muted unit.
export function Stat({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className="font-mono text-lg font-semibold leading-none tabular-nums text-slate-900 dark:text-white"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {sub && <span className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</span>}
      </div>
    </div>
  );
}

// Key/value list for the full sheet metadata. Rows whose value is empty/nullish
// are dropped so a sheet that omits a field simply doesn't show that row.
export function MetaList({ rows }) {
  const visible = rows.filter((r) => r.value != null && r.value !== '');
  if (!visible.length) return null;
  return (
    <Card className="divide-y divide-slate-100 dark:divide-white/[0.06]">
      {visible.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{r.label}</span>
          <span className="text-right font-mono text-[11px] tabular-nums text-slate-900 dark:text-slate-200">
            {r.value}
            {r.suffix ? <span className="text-slate-400 dark:text-slate-500"> {r.suffix}</span> : null}
          </span>
        </div>
      ))}
    </Card>
  );
}

export function CopyButton({ text, children, className = '' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button variant="soft" onClick={copy} className={className}>
      {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
      {copied ? '복사됨' : children}
    </Button>
  );
}

// Segmented control — neutral rectangular switcher.
export function Segmented({ options, value, onChange, size = 'md', className = '' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';
  return (
    <div
      className={`flex rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-white/10 dark:bg-white/[0.06] ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 whitespace-nowrap rounded-[5px] font-semibold transition-all ${pad} ${
            value === o.id
              ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Collapsible disclosure — hairline bordered, chevron rotates on open.
export function Disclosure({ summary, children, defaultOpen = false }) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.02]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
        <span className="flex items-center gap-2">{summary}</span>
        <IconChevron
          size={14}
          className="text-slate-400 transition-transform group-open:rotate-180 dark:text-slate-500"
        />
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-relaxed text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
      {children}
    </p>
  );
}
