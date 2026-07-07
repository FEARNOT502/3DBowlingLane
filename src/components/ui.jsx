import React, { useState } from 'react';
import { IconCopy, IconCheck, IconChevron } from './icons.jsx';

// ---------------------------------------------------------------------------
// Shared UI primitives — "studio white" (1a): airy minimal, warm paper-white
// surfaces, hairline borders, tiny caps section headers, cool indigo accent
// oklch(0.55 0.13 262). Numbers stay monospace + tabular-nums.
// Every surface pairs a light class with a `dark:` fallback.
// ---------------------------------------------------------------------------

// Sections are plain groups on the white sidebar, separated by hairline rules —
// the header is a tiny letterspaced caption, not a card title.
export function Section({ title, children, hint, action }) {
  return (
    <section className="border-b border-[#f1ede6] px-5 py-5 last:border-b-0 dark:border-white/[0.06]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#bdb7ac] dark:text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      {hint && (
        <p className="mb-3 text-[11px] leading-relaxed text-[#a8a297] dark:text-slate-500">{hint}</p>
      )}
      {children}
    </section>
  );
}

// Bordered white panel used INSIDE a Section (AI import card, setup rows…).
export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-[#ece7dd] bg-white dark:border-white/10 dark:bg-white/[0.03] ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '', type = 'button' }) {
  const styles = {
    primary:
      'bg-[oklch(0.55_0.13_262)] text-white shadow-[0_1px_4px_rgba(91,110,224,0.28)] hover:bg-[oklch(0.6_0.13_262)] active:scale-[0.99] dark:bg-sky-500 dark:shadow-none dark:hover:bg-sky-400',
    soft:
      'bg-[#f4f1eb] text-[oklch(0.5_0.13_262)] hover:bg-[#efeadf] active:scale-[0.99] dark:border dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:border-sky-400/50 dark:hover:text-sky-300',
    ghost:
      'text-[#6b665c] hover:bg-[#f4f1eb] dark:text-slate-300 dark:hover:bg-white/[0.06]',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
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
      className="group flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 text-left transition-colors hover:bg-[#faf8f4] dark:hover:bg-white/[0.04]"
    >
      <span className="flex items-center gap-2.5 text-[13px] text-[#4b463e] dark:text-slate-200">
        {color && <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />}
        {label}
      </span>
      <span
        className={`relative h-[18px] w-[34px] shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[oklch(0.55_0.13_262)] dark:bg-sky-500' : 'bg-[#d8d2c6] dark:bg-slate-600'
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

// `reverse` flips the track left↔right so the handle position matches a physical
// frame of reference (e.g. board 1 = the hand-side gutter on the right for a
// righty). The value/range stay the same; only the on-screen direction flips.
export function Slider({ label, value, min, max, step, onChange, fmt = (v) => v, suffix, reverse = false }) {
  const pct = ((value - min) / (max - min)) * 100;
  // `direction: rtl` flips the native thumb/track but NOT the CSS background, so
  // place the filled portion on the correct side manually: left→thumb normally,
  // right→thumb when reversed.
  const fillBg = reverse
    ? `linear-gradient(90deg, var(--slider-rest) ${100 - pct}%, var(--slider-fill) ${100 - pct}%)`
    : `linear-gradient(90deg, var(--slider-fill) ${pct}%, var(--slider-rest) ${pct}%)`;
  return (
    <div className="px-2 py-2">
      <div className="mb-2 flex items-baseline justify-between text-xs text-[#6b665c] dark:text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums text-[oklch(0.55_0.13_262)] dark:text-sky-300">
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
        style={{ direction: reverse ? 'rtl' : 'ltr', background: fillBg }}
      />
    </div>
  );
}

// Infographic stat tile: tiny caps label on top, large tabular number, muted
// unit. `accent` colours a 2px top border + the label (values stay neutral).
export function Stat({ label, value, sub, accent }) {
  return (
    <div
      className="min-w-0 rounded-[10px] border border-[#f0ebe1] bg-white px-2 py-2.5 dark:border-white/10 dark:bg-white/[0.03]"
      style={accent ? { borderTop: `2px solid ${accent}` } : undefined}
    >
      <div
        className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#b3ada1] dark:text-slate-500"
        style={accent ? { color: accent } : undefined}
      >
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="font-mono text-base font-bold leading-none tabular-nums text-[#1c1b1a] dark:text-white">
          {value}
        </span>
        {sub && <span className="text-[10px] text-[#c2bbab] dark:text-slate-500">{sub}</span>}
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
    <div className="divide-y divide-[#f4f0e8] dark:divide-white/[0.06]">
      {visible.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-2">
          <span className="text-xs text-[#8a857b] dark:text-slate-400">{r.label}</span>
          <span className="text-right font-mono text-xs font-semibold tabular-nums text-[#1c1b1a] dark:text-slate-200">
            {r.value}
            {r.suffix ? <span className="font-normal text-[#c2bbab] dark:text-slate-500"> {r.suffix}</span> : null}
          </span>
        </div>
      ))}
    </div>
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
      className={`flex rounded-lg bg-[#f4f1eb] p-[3px] dark:border dark:border-white/10 dark:bg-white/[0.06] ${className}`}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 whitespace-nowrap rounded-md transition-all ${pad} ${
            value === o.id
              ? 'bg-white font-semibold text-[oklch(0.55_0.13_262)] shadow-[0_1px_3px_rgba(0,0,0,.06)] dark:bg-slate-700 dark:text-white'
              : 'font-medium text-[#a8a297] hover:text-[#6b665c] dark:text-slate-400 dark:hover:text-slate-200'
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
      className="group rounded-[10px] border border-[#ece7dd] bg-white dark:border-white/10 dark:bg-white/[0.02]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-medium text-[#6b665c] dark:text-slate-300">
        <span className="flex items-center gap-2">{summary}</span>
        <IconChevron
          size={14}
          className="text-[#bdb7ac] transition-transform group-open:rotate-180 dark:text-slate-500"
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
