import React, { useRef, useState } from 'react';
import Legend from './Legend.jsx';
import BoardProfileChart from './BoardProfileChart.jsx';

function Section({ title, children, hint, action }) {
  return (
    <section className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
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
    <div className={`rounded-xl border border-white/5 bg-white/[0.03] ${className}`}>{children}</div>
  );
}

function Toggle({ label, checked, onChange, color }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span className="flex items-center gap-2 text-sm text-slate-200">
        {color && (
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        )}
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-gradient-to-r from-sky-400 to-cyan-400' : 'bg-slate-700'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt = (v) => v, suffix }) {
  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex justify-between text-xs text-slate-300">
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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-400"
      />
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <Card className="px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-mono text-base font-medium text-sky-200">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
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
        className={`flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
          drag
            ? 'border-sky-400 bg-sky-400/10'
            : 'border-slate-600 bg-white/[0.02] hover:border-sky-500/60 hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className="text-2xl">{importing ? '⏳' : '📄'}</span>
        <span className="text-sm font-medium text-slate-200">
          {importing ? 'PDF 분석 중…' : 'PDF 패턴 시트 업로드'}
        </span>
        <span className="text-[11px] text-slate-500">끌어다 놓거나 클릭하여 선택</span>
      </button>
      {importError && (
        <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
          {importError}
        </p>
      )}
    </div>
  );
}

export default function Sidebar({
  patterns,
  activeId,
  onLoadSample,
  onImportPdf,
  importing,
  importError,
  pageImage,
  importInfo,
  onOcr,
  ocrBusy,
  ocrProgress,
  meta,
  onDistanceChange,
  forwardText,
  reverseText,
  onForwardTextChange,
  onReverseTextChange,
  onApply,
  parseInfo,
  view,
  onViewChange,
  layer,
  stats,
  chartData,
  totals,
  trackZones,
}) {
  return (
    <aside className="scroll-thin flex h-full w-[384px] shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-slate-900/80">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-white/5 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800/90 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500 text-lg shadow-lg shadow-sky-500/20">
            🎳
          </span>
          <div>
            <h1 className="text-[15px] font-bold leading-tight text-white">Lane Oil Pattern 3D</h1>
            <p className="text-[11px] text-slate-400">오일 패턴 시각화 &amp; 분석</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        <Section title="패턴 불러오기">
          <PdfDrop onImportPdf={onImportPdf} importing={importing} importError={importError} />
          <div className="mt-3 flex flex-wrap gap-2">
            {patterns.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onLoadSample(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeId === p.id
                    ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow'
                    : 'bg-white/[0.04] text-slate-300 ring-1 ring-white/5 hover:bg-white/[0.08]'
                }`}
              >
                {p.name}
              </button>
            ))}
            {activeId === 'pdf' && (
              <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300">
                PDF 가져옴
              </span>
            )}
          </div>

          {pageImage && (
            <div className="mt-3 space-y-2">
              {importInfo && !importInfo.tablesFromText && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                  이 시트는 표가 <b>이미지</b>로 저장되어 있어 메타데이터만 자동 입력됐습니다.
                  아래 원본을 보며 값을 입력하거나, <b>OCR 자동 인식</b>을 시도하세요(검수 필요).
                </p>
              )}
              <details open className="overflow-hidden rounded-xl border border-white/5 bg-black/30">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-300">
                  원본 시트 보기
                </summary>
                <img src={pageImage} alt="업로드한 패턴 시트" className="w-full" />
              </details>
              <button
                type="button"
                onClick={onOcr}
                disabled={ocrBusy}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/10 hover:bg-white/[0.1] disabled:opacity-60"
              >
                {ocrBusy
                  ? `OCR 인식 중… ${Math.round((ocrProgress || 0) * 100)}%`
                  : '🔎 표 OCR 자동 인식 (실험적)'}
              </button>
            </div>
          )}
        </Section>

        <Section title="패턴 정보">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-xs text-slate-300" htmlFor="distance">
              Oil Pattern Distance
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id="distance"
                type="number"
                value={meta.distance}
                onChange={(e) => onDistanceChange(parseFloat(e.target.value) || 0)}
                className="w-16 rounded-lg bg-slate-800 px-2 py-1 text-right font-mono text-sm text-sky-200 outline-none ring-1 ring-white/10 focus:ring-sky-500"
              />
              <span className="text-xs text-slate-400">ft</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Volume" value={totals.combinedMl.toFixed(1)} sub="mL" />
            <Stat label="Forward" value={totals.forwardMl.toFixed(1)} sub="mL" />
            <Stat label="Reverse" value={totals.reverseMl.toFixed(1)} sub="mL" />
          </div>
        </Section>

        <Section
          title="레이어 표시"
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
            label="파울라인부터 넓게 (방향 뒤집기)"
            checked={view.flipPattern}
            onChange={(v) => onViewChange('flipPattern', v)}
          />
          <div className="mt-3">
            <Legend layer={layer} />
          </div>
        </Section>

        <Section title="시각화 옵션">
          <Toggle label="오일 표시" checked={view.showOil} onChange={(v) => onViewChange('showOil', v)} />
          <Toggle label="볼링핀 표시" checked={view.showPins} onChange={(v) => onViewChange('showPins', v)} />
          <Toggle
            label="피트/보드 라벨"
            checked={view.showLabels}
            onChange={(v) => onViewChange('showLabels', v)}
          />
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
            label="레인 폭 배율 (분석용)"
            value={view.widthScale}
            min={0.7}
            max={2}
            step={0.1}
            fmt={(v) => `${v}×`}
            onChange={(v) => onViewChange('widthScale', v)}
          />
        </Section>

        <Section
          title="데이터 직접 편집"
          hint="시트의 표 행을 붙여넣으세요: START STOP LOADS SPEED BUFFER [TANK] CROSSED START END FEET T.OIL"
        >
          <label className="mb-1 block text-[11px] font-medium text-cyan-300">Forward Pass</label>
          <textarea
            value={forwardText}
            onChange={(e) => onForwardTextChange(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full resize-y rounded-lg bg-slate-950/80 p-2.5 font-mono text-[10px] leading-snug text-slate-200 outline-none ring-1 ring-white/10 focus:ring-cyan-500"
          />
          <label className="mb-1 mt-3 block text-[11px] font-medium text-blue-300">Reverse Pass</label>
          <textarea
            value={reverseText}
            onChange={(e) => onReverseTextChange(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full resize-y rounded-lg bg-slate-950/80 p-2.5 font-mono text-[10px] leading-snug text-slate-200 outline-none ring-1 ring-white/10 focus:ring-blue-500"
          />
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onApply}
              className="rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-1.5 text-xs font-semibold text-white shadow hover:from-sky-400 hover:to-cyan-400"
            >
              적용 / 다시 계산
            </button>
            <span className="text-[11px] text-slate-400">
              {parseInfo.error ? (
                <span className="text-rose-400">{parseInfo.error}</span>
              ) : (
                `F ${parseInfo.forwardCount} · R ${parseInfo.reverseCount} pass`
              )}
            </span>
          </div>
        </Section>

        <Section title="보드별 오일 분포">
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

        <Section title="Track Zone Ratio">
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
