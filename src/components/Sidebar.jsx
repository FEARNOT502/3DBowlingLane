import React, { useRef, useState } from 'react';
import Legend from './Legend.jsx';
import BoardProfileChart from './BoardProfileChart.jsx';
import { AI_PROMPT } from '../lib/aiImport.js';

// ---------------------------------------------------------------------------
// Reusable UI primitives
// ---------------------------------------------------------------------------

function Section({ title, icon, children, hint, action }) {
  return (
    <section className="px-5 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {icon && <span className="text-sm">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      {hint && <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{hint}</p>}
      {children}
    </section>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>
  );
}

function Button({ children, onClick, variant = 'primary', disabled, className = '', type = 'button' }) {
  const styles = {
    primary:
      'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-400 hover:to-sky-400 active:scale-[0.98]',
    soft: 'bg-white/[0.06] text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.1] active:scale-[0.98]',
    ghost: 'text-slate-300 hover:bg-white/[0.06]',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange, color }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="group flex w-full cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
    >
      <span className="flex items-center gap-2 text-sm text-slate-200">
        {color && (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/10"
            style={{ background: color }}
          />
        )}
        {label}
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-gradient-to-r from-indigo-400 to-sky-400' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt = (v) => v, suffix }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="px-2 py-2">
      <div className="mb-2 flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-sky-300">
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
        className="range-input h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(90deg, #818cf8 ${pct}%, #334155 ${pct}%)`,
        }}
      />
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <Card className="px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-mono text-base font-semibold text-sky-200">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </Card>
  );
}

// Key/value list for the full sheet metadata. Rows whose value is empty/nullish
// are dropped so a sheet that omits a field simply doesn't show that row.
function MetaList({ rows }) {
  const visible = rows.filter((r) => r.value != null && r.value !== '');
  if (!visible.length) return null;
  return (
    <Card className="divide-y divide-white/[0.06]">
      {visible.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
          <span className="text-[11px] text-slate-400">{r.label}</span>
          <span className="text-right font-mono text-[11px] text-slate-200">
            {r.value}
            {r.suffix ? <span className="text-slate-500"> {r.suffix}</span> : null}
          </span>
        </div>
      ))}
    </Card>
  );
}

// Full pass table — renders every column from the parsed sheet rows so no data
// is hidden. Horizontally scrollable to fit the narrow sidebar.
function PassTable({ title, color, passes }) {
  if (!passes || !passes.length) return null;
  const cols = ['START', 'STOP', 'LOAD', 'SPD', 'BUF', 'TANK', 'CRS', 'ST', 'END', 'FT', 'T.OIL'];
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium" style={{ color }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {title}
        <span className="text-slate-500">· {passes.length} pass</span>
      </div>
      <div className="scroll-thin overflow-x-auto rounded-lg ring-1 ring-white/10">
        <table className="w-full min-w-[340px] border-collapse text-[9px]">
          <thead className="bg-white/[0.05] text-slate-400">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-1.5 py-1 text-right font-medium first:text-left">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono text-slate-300">
            {passes.map((p, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="px-1.5 py-1 text-left text-sky-200">{p.start}</td>
                <td className="px-1.5 py-1 text-right text-sky-200">{p.stop}</td>
                <td className="px-1.5 py-1 text-right">{p.loads}</td>
                <td className="px-1.5 py-1 text-right">{p.speed}</td>
                <td className="px-1.5 py-1 text-right">{p.buffer}</td>
                <td className="px-1.5 py-1 text-right text-slate-400">{p.tank || '-'}</td>
                <td className="px-1.5 py-1 text-right">{p.crossed}</td>
                <td className="px-1.5 py-1 text-right">{p.startFt}</td>
                <td className="px-1.5 py-1 text-right">{p.endFt}</td>
                <td className="px-1.5 py-1 text-right">{p.feet}</td>
                <td className="px-1.5 py-1 text-right text-slate-200">{p.totalOil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CopyButton({ text, children, className = '' }) {
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
      {copied ? '✓ 복사됨' : children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// AI import — user converts the sheet image with ChatGPT/Claude (no API)
// ---------------------------------------------------------------------------

function AiImport({ aiText, onAiTextChange, onAiImport, aiError }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-white/10 bg-gradient-to-r from-indigo-500/10 to-sky-500/10 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
          <span>✨</span> AI로 패턴 가져오기
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          OCR보다 정확합니다. 아래 프롬프트를 복사해 ChatGPT·Claude에 <b>패턴 이미지와 함께</b>{' '}
          붙여넣고, 받은 결과를 다시 여기에 붙여넣으세요. (API 키 불필요)
        </p>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-300">
            1
          </span>
          <CopyButton text={AI_PROMPT} className="flex-1">
            📋 변환 프롬프트 복사
          </CopyButton>
        </div>

        <div className="flex items-start gap-2">
          <span className="mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-300">
            2
          </span>
          <div className="flex-1">
            <p className="mb-1.5 text-[11px] text-slate-400">AI가 준 텍스트를 붙여넣으세요</p>
            <textarea
              value={aiText}
              onChange={(e) => onAiTextChange(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder={'=== PATTERN ===\nNAME: ...\n\n=== FORWARD ===\n4L 4R 3 14 3 A 99 0.0 3.9 3.9 4950'}
              className="w-full resize-y rounded-lg bg-slate-950/70 p-2.5 font-mono text-[10px] leading-snug text-slate-200 outline-none ring-1 ring-white/10 placeholder:text-slate-600 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-[10px] font-bold text-indigo-300">
            3
          </span>
          <Button onClick={onAiImport} disabled={!aiText.trim()} className="flex-1">
            패턴으로 불러오기
          </Button>
        </div>

        {aiError && (
          <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-300 ring-1 ring-rose-500/20">
            {aiError}
          </p>
        )}
      </div>
    </Card>
  );
}

function PdfDrop({ onImportPdf, importing, importError }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = (files) => {
    const f = files && files[0];
    if (!f) return;
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) onImportPdf(f);
  };

  return (
    <div>
      {/* input kept OUTSIDE the trigger so we never nest interactive content */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center outline-none transition-colors ${
          drag
            ? 'border-indigo-400 bg-indigo-400/10'
            : 'border-slate-600 bg-white/[0.02] hover:border-indigo-500/60 hover:bg-white/[0.04] focus:border-indigo-500/60'
        }`}
      >
        <span className="text-2xl">{importing ? '⏳' : '📄'}</span>
        <span className="text-sm font-medium text-slate-200">
          {importing ? 'PDF 분석 중…' : 'PDF 패턴 시트 업로드'}
        </span>
        <span className="text-[11px] text-slate-500">끌어다 놓거나 클릭하여 선택</span>
      </div>
      {importError && (
        <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300 ring-1 ring-rose-500/20">
          {importError}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function Sidebar({
  patterns,
  activeId,
  onLoadSample,
  savedPatterns,
  onLoadSaved,
  onDeleteSaved,
  onImportPdf,
  importing,
  importError,
  pageImage,
  importInfo,
  aiText,
  onAiTextChange,
  onAiImport,
  aiError,
  meta,
  onDistanceChange,
  forwardText,
  reverseText,
  onForwardTextChange,
  onReverseTextChange,
  onApply,
  parseInfo,
  forwardPasses,
  reversePasses,
  view,
  onViewChange,
  layer,
  stats,
  chartData,
  totals,
  trackZones,
}) {
  return (
    <aside className="scroll-thin flex h-full w-[388px] shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-slate-900/80">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/85 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-xl shadow-lg shadow-indigo-500/30">
            🎳
          </span>
          <div>
            <h1 className="text-[15px] font-bold leading-tight text-white">Lane Oil Pattern 3D</h1>
            <p className="text-[11px] text-slate-400">오일 패턴 시각화 &amp; 분석</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/[0.07]">
        <Section title="패턴 불러오기" icon="📥">
          <div className="space-y-3">
            <AiImport
              aiText={aiText}
              onAiTextChange={onAiTextChange}
              onAiImport={onAiImport}
              aiError={aiError}
            />

            <details className="group rounded-xl border border-white/10 bg-white/[0.02]">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-medium text-slate-300">
                <span className="flex items-center gap-2">📄 PDF에서 가져오기</span>
                <span className="text-slate-500 transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="px-3 pb-3">
                <PdfDrop
                  onImportPdf={onImportPdf}
                  importing={importing}
                  importError={importError}
                />
                {pageImage && (
                  <div className="mt-3 space-y-2">
                    {importInfo && !importInfo.tablesFromText && (
                      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90 ring-1 ring-amber-500/20">
                        표가 <b>이미지</b>로 저장된 시트입니다. 위의 <b>AI로 가져오기</b>에 이
                        이미지를 올려 변환하세요.
                      </p>
                    )}
                    <details className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                      <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-300">
                        원본 시트 미리보기
                      </summary>
                      <img src={pageImage} alt="업로드한 패턴 시트" className="w-full" />
                    </details>
                  </div>
                )}
              </div>
            </details>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium text-slate-500">샘플 패턴</p>
            <div className="flex flex-wrap gap-2">
              {patterns.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onLoadSample(p.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97] ${
                    activeId === p.id
                      ? 'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow'
                      : 'bg-white/[0.04] text-slate-300 ring-1 ring-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
              {(activeId === 'pdf' || activeId === 'custom') && (
                <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                  {activeId === 'pdf' ? 'PDF 가져옴' : '직접 편집'}
                </span>
              )}
            </div>
          </div>

          {savedPatterns && savedPatterns.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium text-slate-500">
                내 패턴 <span className="text-slate-600">(저장됨)</span>
              </p>
              <div className="flex flex-col gap-1.5">
                {savedPatterns.map((p) => (
                  <div
                    key={p.id}
                    className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      activeId === p.id
                        ? 'bg-gradient-to-r from-indigo-500/20 to-sky-500/20 ring-1 ring-indigo-400/40'
                        : 'bg-white/[0.04] ring-1 ring-white/5 hover:bg-white/[0.07]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onLoadSaved(p.id)}
                      className="flex-1 truncate text-left font-medium text-slate-200"
                      title={p.name}
                    >
                      ✨ {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSaved(p.id)}
                      aria-label="삭제"
                      className="shrink-0 rounded px-1.5 py-0.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="패턴 정보" icon="📊">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs text-slate-300" htmlFor="distance">
              Oil Pattern Distance
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="distance"
                type="number"
                min={0}
                value={meta.distance}
                onChange={(e) => {
                  const v = e.target.value;
                  onDistanceChange(v === '' ? 0 : parseFloat(v) || 0);
                }}
                className="w-16 rounded-lg bg-slate-800 px-2 py-1 text-right font-mono text-sm text-sky-200 outline-none ring-1 ring-white/10 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-400">ft</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Volume" value={totals.combinedMl.toFixed(1)} sub="mL" />
            <Stat label="Forward" value={totals.forwardMl.toFixed(1)} sub="mL" />
            <Stat label="Reverse" value={totals.reverseMl.toFixed(1)} sub="mL" />
          </div>

          <p className="mb-2 mt-4 text-[11px] font-medium text-slate-500">시트 전체 값</p>
          <MetaList
            rows={[
              { label: 'Oil Pattern Distance', value: meta.distance, suffix: 'ft' },
              { label: 'Reverse Brush Drop', value: meta.reverseBrushDrop },
              { label: 'Oil Per Board', value: meta.oilPerBoard, suffix: 'µl' },
              { label: 'Forward Oil Total', value: meta.forwardTotal, suffix: 'mL' },
              { label: 'Reverse Oil Total', value: meta.reverseTotal, suffix: 'mL' },
              { label: 'Volume Oil Total', value: meta.volumeTotal, suffix: 'mL' },
              { label: 'Tank Configuration', value: meta.tankConfig },
              { label: 'Tank A Conditioner', value: meta.tankAConditioner },
              { label: 'Tank B Conditioner', value: meta.tankBConditioner },
              { label: 'Cleaner Main Mix', value: meta.cleanerMainMix },
              { label: 'Cleaner Back End Mix', value: meta.cleanerBackEndMix },
              { label: 'Back End Distance', value: meta.cleanerBackEndDistance },
              { label: 'Buffer RPM', value: meta.bufferRpm },
            ]}
          />
        </Section>

        <Section
          title="레이어 표시"
          icon="🎨"
          hint="Forward(전진)·Reverse(복귀)를 켜고 끄세요. 둘 다 켜면 Combined."
        >
          <Toggle
            label="Forward 도포량"
            color="#22d3ee"
            checked={view.showForward}
            onChange={(v) => onViewChange('showForward', v)}
          />
          <Toggle
            label="Reverse 도포량"
            color="#3b82f6"
            checked={view.showReverse}
            onChange={(v) => onViewChange('showReverse', v)}
          />
          <Toggle
            label="패턴 상하 반전 (시트 방향 뒤집기)"
            checked={view.flipPattern}
            onChange={(v) => onViewChange('flipPattern', v)}
          />
          <div className="mt-3 px-2">
            <Legend layer={layer} />
          </div>
        </Section>

        <Section title="시각화 옵션" icon="⚙️">
          <Toggle label="오일 표시" checked={view.showOil} onChange={(v) => onViewChange('showOil', v)} />
          <Toggle label="볼링핀 표시" checked={view.showPins} onChange={(v) => onViewChange('showPins', v)} />
          <Toggle
            label="피트/보드 라벨"
            checked={view.showLabels}
            onChange={(v) => onViewChange('showLabels', v)}
          />
          <div className="mt-1 space-y-1">
            <Slider
              label="오일 불투명도"
              value={view.opacity}
              min={0.3}
              max={1}
              step={0.05}
              fmt={(v) => v.toFixed(2)}
              onChange={(v) => onViewChange('opacity', v)}
            />
            <Slider
              label="3D 두께 강조"
              value={view.thickness}
              min={0}
              max={3}
              step={0.1}
              fmt={(v) => v.toFixed(1)}
              onChange={(v) => onViewChange('thickness', v)}
            />
            <Slider
              label="레인 폭 배율 (1 = 실제 비율 · 5 = 패턴표 비율)"
              value={view.widthScale}
              min={0.7}
              max={6}
              step={0.1}
              fmt={(v) => `${v}×`}
              onChange={(v) => onViewChange('widthScale', v)}
            />
          </div>
        </Section>

        <Section
          title="패턴 표 (Pass Tables)"
          icon="📋"
          hint="시트의 Forward·Reverse 표 전체 컬럼입니다. 좌우로 스크롤하세요."
        >
          <div className="space-y-3">
            <PassTable title="Forward Pass" color="#22d3ee" passes={forwardPasses} />
            <PassTable title="Reverse Pass" color="#3b82f6" passes={reversePasses} />
            {!forwardPasses?.length && !reversePasses?.length && (
              <p className="text-[11px] text-slate-500">표시할 패턴 행이 없습니다.</p>
            )}
          </div>

          <details className="group mt-3 rounded-xl border border-white/10 bg-white/[0.02]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-medium text-slate-300">
              <span className="flex items-center gap-2">✏️ 직접 편집</span>
              <span className="text-slate-500 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="px-3 pb-3">
              <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                형식: START STOP LOADS SPEED BUFFER [TANK] CROSSED START END FEET T.OIL
              </p>
              <label className="mb-1 block text-[11px] font-medium text-cyan-300">Forward Pass</label>
              <textarea
                value={forwardText}
                onChange={(e) => onForwardTextChange(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full resize-y rounded-lg bg-slate-950/70 p-2.5 font-mono text-[10px] leading-snug text-slate-200 outline-none ring-1 ring-white/10 focus:ring-cyan-500"
              />
              <label className="mb-1 mt-3 block text-[11px] font-medium text-blue-300">
                Reverse Pass
              </label>
              <textarea
                value={reverseText}
                onChange={(e) => onReverseTextChange(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full resize-y rounded-lg bg-slate-950/70 p-2.5 font-mono text-[10px] leading-snug text-slate-200 outline-none ring-1 ring-white/10 focus:ring-blue-500"
              />
              <div className="mt-3 flex items-center justify-between">
                <Button onClick={onApply}>적용 / 다시 계산</Button>
                <span className="text-[11px] text-slate-400">
                  {parseInfo.error ? (
                    <span className="text-rose-400">{parseInfo.error}</span>
                  ) : (
                    `F ${parseInfo.forwardCount} · R ${parseInfo.reverseCount} pass`
                  )}
                </span>
              </div>
            </div>
          </details>
        </Section>

        <Section title="보드별 오일 분포" icon="📈">
          <Card className="px-3 py-3">
            <BoardProfileChart
              data={chartData}
              showForward={view.showForward}
              showReverse={view.showReverse}
            />
          </Card>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="피크 보드" value={stats.peakBoard} sub={`${Math.round(stats.peakBoardVolume)} µl`} />
            <Stat label="실측 길이" value={stats.patternEndFeet.toFixed(1)} sub="ft" />
            <Stat label="중앙:트랙" value={stats.trackRatio.toFixed(1)} sub="비율(파생)" />
          </div>
        </Section>

        <Section title="Track Zone Ratio" icon="🎯">
          {trackZones && trackZones.length ? (
            <Card className="overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-white/[0.04] text-slate-300">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left font-medium">Zone</th>
                    <th className="px-2.5 py-1.5 text-left font-medium">설명</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Ratio</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-300">
                  {trackZones.map((z) => (
                    <tr key={z.item} className="border-t border-white/5">
                      <td className="px-2.5 py-1.5">{z.item}</td>
                      <td className="px-2.5 py-1.5 text-slate-400">{z.desc}</td>
                      <td className="px-2.5 py-1.5 text-right text-sky-200">{z.ratio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <p className="text-[11px] text-slate-500">추출된 Track Zone 데이터가 없습니다.</p>
          )}
        </Section>
      </div>

      <div className="px-5 py-4 text-[10px] leading-relaxed text-slate-600">
        밀도 = T.OIL ÷ (보드 수 × 피트 길이). LOADS/SPEED가 반영된 T.OIL을 사용하며, 값이 없으면
        LOADS × 50µl × 보드 수로 추정합니다.
      </div>
    </aside>
  );
}
