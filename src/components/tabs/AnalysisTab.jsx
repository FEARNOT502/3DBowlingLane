import React from 'react';
import BoardProfileChart from '../BoardProfileChart.jsx';
import { Section, Card, Button, Stat, Disclosure } from '../ui.jsx';

// Full pass table — renders every column from the parsed sheet rows so no data
// is hidden. Horizontally scrollable to fit the narrow panel.
function PassTable({ title, color, passes }) {
  if (!passes || !passes.length) return null;
  const cols = ['START', 'STOP', 'LOAD', 'SPD', 'BUF', 'TANK', 'CRS', 'ST', 'END', 'FT', 'T.OIL'];
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium" style={{ color }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
        {title}
        <span className="text-slate-400 dark:text-slate-500">· {passes.length} pass</span>
      </div>
      <div className="scroll-thin overflow-x-auto rounded-lg ring-1 ring-slate-200 dark:ring-white/10">
        <table className="w-full min-w-[340px] border-collapse text-[9px]">
          <thead className="bg-slate-50 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-1.5 py-1 text-right font-medium first:text-left">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono text-slate-600 dark:text-slate-300">
            {passes.map((p, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                <td className="px-1.5 py-1 text-left text-cyan-700 dark:text-sky-200">{p.start}</td>
                <td className="px-1.5 py-1 text-right text-cyan-700 dark:text-sky-200">{p.stop}</td>
                <td className="px-1.5 py-1 text-right">{p.loads}</td>
                <td className="px-1.5 py-1 text-right">{p.speed}</td>
                <td className="px-1.5 py-1 text-right">{p.buffer}</td>
                <td className="px-1.5 py-1 text-right text-slate-400">{p.tank || '-'}</td>
                <td className="px-1.5 py-1 text-right">{p.crossed}</td>
                <td className="px-1.5 py-1 text-right">{p.startFt}</td>
                <td className="px-1.5 py-1 text-right">{p.endFt}</td>
                <td className="px-1.5 py-1 text-right">{p.feet}</td>
                <td className="px-1.5 py-1 text-right text-slate-800 dark:text-slate-200">{p.totalOil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 분석 tab — board distribution chart, pass tables, direct edit, track zones.
// ---------------------------------------------------------------------------

export default function AnalysisTab({
  forwardText,
  reverseText,
  onForwardTextChange,
  onReverseTextChange,
  onApply,
  parseInfo,
  forwardPasses,
  reversePasses,
  view,
  stats,
  chartData,
  trackZones,
}) {
  return (
    <div className="pb-4">
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

      <Section
        title="패턴 표 (Pass Tables)"
        hint="시트의 Forward·Reverse 표 전체 컬럼입니다. 좌우로 스크롤하세요."
      >
        <div className="space-y-3">
          <PassTable title="Forward Pass" color="#0891b2" passes={forwardPasses} />
          <PassTable title="Reverse Pass" color="#2563eb" passes={reversePasses} />
          {!forwardPasses?.length && !reversePasses?.length && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">표시할 패턴 행이 없습니다.</p>
          )}
        </div>

        <div className="mt-3">
          <Disclosure summary={<>직접 편집</>}>
            <p className="mb-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
              형식: START STOP LOADS SPEED BUFFER [TANK] CROSSED START END FEET T.OIL
            </p>
            <label className="mb-1 block text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
              Forward Pass
            </label>
            <textarea
              value={forwardText}
              onChange={(e) => onForwardTextChange(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full resize-y rounded-lg bg-white p-2.5 font-mono text-[10px] leading-snug text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-cyan-400 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-white/10"
            />
            <label className="mb-1 mt-3 block text-[11px] font-medium text-blue-700 dark:text-blue-300">
              Reverse Pass
            </label>
            <textarea
              value={reverseText}
              onChange={(e) => onReverseTextChange(e.target.value)}
              rows={6}
              spellCheck={false}
              className="w-full resize-y rounded-lg bg-white p-2.5 font-mono text-[10px] leading-snug text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-400 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-white/10"
            />
            <div className="mt-3 flex items-center justify-between">
              <Button onClick={onApply}>적용 / 다시 계산</Button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {parseInfo.error ? (
                  <span className="text-rose-500 dark:text-rose-400">{parseInfo.error}</span>
                ) : (
                  `F ${parseInfo.forwardCount} · R ${parseInfo.reverseCount} pass`
                )}
              </span>
            </div>
          </Disclosure>
        </div>
      </Section>

      <Section title="Track Zone Ratio">
        {trackZones && trackZones.length ? (
          <Card className="overflow-hidden">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Zone</th>
                  <th className="px-2.5 py-1.5 text-left font-medium">설명</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Ratio</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-600 dark:text-slate-300">
                {trackZones.map((z) => (
                  <tr key={z.item} className="border-t border-slate-100 dark:border-white/5">
                    <td className="px-2.5 py-1.5">{z.item}</td>
                    <td className="px-2.5 py-1.5 text-slate-400">{z.desc}</td>
                    <td className="px-2.5 py-1.5 text-right text-indigo-600 dark:text-sky-200">{z.ratio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            추출된 Track Zone 데이터가 없습니다.
          </p>
        )}
      </Section>

      <div className="px-4 py-4 text-[10px] leading-relaxed text-slate-400 dark:text-slate-600 sm:px-5">
        밀도 = T.OIL ÷ (보드 수 × 피트 길이). LOADS/SPEED가 반영된 T.OIL을 사용하며, 값이 없으면
        LOADS × 50µl × 보드 수로 추정합니다.
      </div>
    </div>
  );
}
