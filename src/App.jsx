import React, { useMemo, useState, useCallback } from 'react';
import Scene from './components/Scene.jsx';
import Sidebar from './components/Sidebar.jsx';
import { SAMPLE_PATTERNS, KBA_40 } from './data/samplePatterns.js';
import { parsePassTable, totalOilMl } from './lib/parsePattern.js';
import { buildOilModel, selectGrid } from './lib/oilModel.js';
import { computeStats, boardChartData } from './lib/analysis.js';
import { importPatternFromPdf, ocrPatternTables } from './lib/pdfImport.js';

function parseTexts(forwardText, reverseText) {
  const forwardPasses = parsePassTable(forwardText, 'forward');
  const reversePasses = parsePassTable(reverseText, 'reverse');
  const total = forwardPasses.length + reversePasses.length;
  return {
    forwardPasses,
    reversePasses,
    parseInfo: {
      forwardCount: forwardPasses.length,
      reverseCount: reversePasses.length,
      error: total === 0 ? '데이터를 인식하지 못했습니다.' : null,
    },
  };
}

export default function App() {
  const initial = KBA_40;
  const [activeId, setActiveId] = useState(initial.id);
  const [meta, setMeta] = useState({ ...initial.meta, name: initial.name });
  const [trackZones, setTrackZones] = useState(initial.trackZones);
  const [forwardText, setForwardText] = useState(initial.forwardText);
  const [reverseText, setReverseText] = useState(initial.reverseText);
  const [applied, setApplied] = useState(() => parseTexts(initial.forwardText, initial.reverseText));

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [pageImage, setPageImage] = useState(null);
  const [importInfo, setImportInfo] = useState(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const [view, setView] = useState({
    showForward: true,
    showReverse: true,
    showOil: true,
    showLabels: true,
    showPins: true,
    flipPattern: true,
    opacity: 0.95,
    thickness: 0.8,
    widthScale: 1,
  });

  const onViewChange = useCallback((field, value) => {
    setView((v) => ({ ...v, [field]: value }));
  }, []);

  const loadSample = useCallback((id) => {
    const p = SAMPLE_PATTERNS.find((s) => s.id === id);
    if (!p) return;
    setImportError(null);
    setPageImage(null);
    setImportInfo(null);
    setActiveId(id);
    setMeta({ ...p.meta, name: p.name });
    setTrackZones(p.trackZones);
    setForwardText(p.forwardText);
    setReverseText(p.reverseText);
    setApplied(parseTexts(p.forwardText, p.reverseText));
  }, []);

  const onApply = useCallback(() => {
    setActiveId('custom');
    setApplied(parseTexts(forwardText, reverseText));
  }, [forwardText, reverseText]);

  const onDistanceChange = useCallback((distance) => {
    setMeta((m) => ({ ...m, distance }));
  }, []);

  const onImportPdf = useCallback(async (file) => {
    if (!file) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await importPatternFromPdf(file);
      setActiveId('pdf');
      setMeta({ ...res.meta });
      setTrackZones(res.trackZones || []);
      setForwardText(res.forwardText);
      setReverseText(res.reverseText);
      setApplied(parseTexts(res.forwardText, res.reverseText));
      setPageImage(res.pageImage);
      setImportInfo({ tablesFromText: res.tablesFromText, hasText: res.meta.hasText });
    } catch (e) {
      setImportError(e?.message || 'PDF 분석에 실패했습니다.');
    } finally {
      setImporting(false);
    }
  }, []);

  const onOcr = useCallback(async () => {
    if (!pageImage) return;
    setOcrBusy(true);
    setOcrProgress(0);
    setImportError(null);
    try {
      const res = await ocrPatternTables(pageImage, setOcrProgress);
      setForwardText(res.forwardText);
      setReverseText(res.reverseText);
      if (res.trackZones && res.trackZones.length) setTrackZones(res.trackZones);
      setApplied(parseTexts(res.forwardText, res.reverseText));
    } catch (e) {
      setImportError(`OCR 실패: ${e?.message || ''}`);
    } finally {
      setOcrBusy(false);
    }
  }, [pageImage]);

  const { forwardPasses, reversePasses, parseInfo } = applied;

  const model = useMemo(
    () => buildOilModel(forwardPasses, reversePasses, { flip: view.flipPattern }),
    [forwardPasses, reversePasses, view.flipPattern]
  );

  const selected = useMemo(
    () => selectGrid(model, view.showForward, view.showReverse),
    [model, view.showForward, view.showReverse]
  );

  const stats = useMemo(() => computeStats(model), [model]);
  const chartData = useMemo(() => boardChartData(model), [model]);

  const totals = useMemo(
    () => ({
      forwardMl: totalOilMl(forwardPasses),
      reverseMl: totalOilMl(reversePasses),
      combinedMl: totalOilMl(forwardPasses) + totalOilMl(reversePasses),
    }),
    [forwardPasses, reversePasses]
  );

  return (
    <div className="flex h-full w-full bg-slate-950">
      <Sidebar
        patterns={SAMPLE_PATTERNS}
        activeId={activeId}
        onLoadSample={loadSample}
        onImportPdf={onImportPdf}
        importing={importing}
        importError={importError}
        pageImage={pageImage}
        importInfo={importInfo}
        onOcr={onOcr}
        ocrBusy={ocrBusy}
        ocrProgress={ocrProgress}
        meta={meta}
        onDistanceChange={onDistanceChange}
        forwardText={forwardText}
        reverseText={reverseText}
        onForwardTextChange={setForwardText}
        onReverseTextChange={setReverseText}
        onApply={onApply}
        parseInfo={parseInfo}
        view={view}
        onViewChange={onViewChange}
        layer={selected.layer}
        stats={stats}
        chartData={chartData}
        totals={totals}
        trackZones={trackZones}
      />

      <main className="relative flex-1">
        <Scene
          grid={selected.grid}
          max={selected.max}
          layer={selected.layer}
          thickness={view.thickness}
          opacity={view.opacity}
          showOil={view.showOil}
          showLabels={view.showLabels}
          showPins={view.showPins}
          widthScale={view.widthScale}
          patternDistance={meta.distance}
        />

        <div className="pointer-events-none absolute left-5 top-5 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 backdrop-blur-md">
          <div className="text-sm font-semibold text-white">{meta.name || '패턴'}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {meta.distance}ft · {totals.combinedMl.toFixed(1)}mL
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500">
            드래그 회전 · 휠 줌 · 우클릭 이동
          </div>
        </div>
      </main>
    </div>
  );
}
