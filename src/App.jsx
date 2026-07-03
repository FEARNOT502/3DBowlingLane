import React, { useMemo, useState, useCallback } from 'react';
import Scene from './components/Scene.jsx';
import Sidebar from './components/Sidebar.jsx';
import { SAMPLE_PATTERNS, JINSEUNG_A } from './data/samplePatterns.js';
import { parsePassTable, totalOilMl } from './lib/parsePattern.js';
import { buildOilModel, selectGrid } from './lib/oilModel.js';
import { computeStats, boardChartData } from './lib/analysis.js';
import { importPatternFromPdf } from './lib/pdfImport.js';
import { parseAiImport } from './lib/aiImport.js';
import { loadSavedPatterns, savePattern, deletePattern } from './lib/storage.js';

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
  const initial = JINSEUNG_A;
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
  const [aiText, setAiText] = useState('');
  const [aiError, setAiError] = useState(null);
  const [saved, setSaved] = useState(() => loadSavedPatterns());

  const [view, setView] = useState({
    showForward: true,
    showReverse: true,
    showOil: true,
    showLabels: true,
    showPins: true,
    // Kegel 시트의 forward 테이블은 파울라인(0ft)에서 시작하므로 그대로가
    // 올바른 방향 — 반전은 옵션으로만 남긴다.
    flipPattern: false,
    opacity: 0.95,
    thickness: 0.8,
    // 1 = 실제 비율(레인은 60ft × 41.5"로 매우 가늘다). 기본값은 인쇄된
    // 패턴표 그래프와 같은 비율(실제 폭의 약 5배)로 설정.
    widthScale: 5,
    oilMode: 'sheet', // 'sheet' (패턴표) | 'realistic' (PBA 실제 레인)
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

  const onAiImport = useCallback(() => {
    setAiError(null);
    try {
      const res = parseAiImport(aiText);
      // Persist the imported pattern (with its name) to localStorage so it shows
      // up in "내 패턴" and survives reloads — works on a static GitHub Pages host.
      const entry = {
        id: `saved-${Date.now()}`,
        name: res.meta.name,
        meta: res.meta,
        trackZones: res.trackZones || [],
        forwardText: res.forwardText,
        reverseText: res.reverseText,
      };
      setSaved(savePattern(entry));
      setActiveId(entry.id);
      setMeta({ ...res.meta });
      setTrackZones(res.trackZones || []);
      setForwardText(res.forwardText);
      setReverseText(res.reverseText);
      setApplied(parseTexts(res.forwardText, res.reverseText));
      setPageImage(null);
      setImportInfo(null);
      setAiText('');
    } catch (e) {
      setAiError(e?.message || 'AI 텍스트를 인식하지 못했습니다.');
    }
  }, [aiText]);

  const onLoadSaved = useCallback((id) => {
    const p = saved.find((s) => s.id === id);
    if (!p) return;
    setImportError(null);
    setPageImage(null);
    setImportInfo(null);
    setActiveId(id);
    setMeta({ ...p.meta, name: p.name });
    setTrackZones(p.trackZones || []);
    setForwardText(p.forwardText);
    setReverseText(p.reverseText);
    setApplied(parseTexts(p.forwardText, p.reverseText));
  }, [saved]);

  const onDeleteSaved = useCallback((id) => {
    setSaved(deletePattern(id));
    setActiveId((cur) => (cur === id ? 'custom' : cur));
  }, []);

  const { forwardPasses, reversePasses, parseInfo } = applied;

  const model = useMemo(
    () =>
      buildOilModel(forwardPasses, reversePasses, {
        flip: view.flipPattern,
        // 포워드 버프아웃 거리(=패턴 거리): 버퍼 브러쉬 전폭 필름이 여기까지 깔린다.
        buffOutFeet: Number(meta.distance) || 0,
        // 시트 모드: 인쇄된 그래프처럼 보드 단위 계단이 살아 있도록 블러 최소.
        // 실제 레인 모드: 버퍼 브러쉬가 옆으로 퍼진 부드러운 그라데이션.
        smoothBoards: view.oilMode === 'sheet' ? 0.45 : 2.2,
        smoothFeet: view.oilMode === 'sheet' ? 0.45 : 0.7,
      }),
    [forwardPasses, reversePasses, view.flipPattern, view.oilMode, meta.distance]
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
        savedPatterns={saved}
        onLoadSaved={onLoadSaved}
        onDeleteSaved={onDeleteSaved}
        onImportPdf={onImportPdf}
        importing={importing}
        importError={importError}
        pageImage={pageImage}
        importInfo={importInfo}
        aiText={aiText}
        onAiTextChange={setAiText}
        onAiImport={onAiImport}
        aiError={aiError}
        meta={meta}
        onDistanceChange={onDistanceChange}
        forwardText={forwardText}
        reverseText={reverseText}
        onForwardTextChange={setForwardText}
        onReverseTextChange={setReverseText}
        onApply={onApply}
        parseInfo={parseInfo}
        forwardPasses={forwardPasses}
        reversePasses={reversePasses}
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
          components={selected.components}
          thickness={view.thickness}
          opacity={view.opacity}
          showOil={view.showOil}
          showLabels={view.showLabels}
          showPins={view.showPins}
          widthScale={view.widthScale}
          patternDistance={meta.distance}
          oilMode={view.oilMode}
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

        {/* 오일 표시 모드 토글: 패턴표 그래픽 vs PBA 실제 레인 */}
        <div className="absolute right-5 top-5 flex overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 text-[11px] backdrop-blur-md">
          {[
            { id: 'sheet', label: '패턴표' },
            { id: 'realistic', label: '실제 레인' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onViewChange('oilMode', m.id)}
              className={
                'px-3 py-1.5 font-medium transition ' +
                (view.oilMode === m.id
                  ? 'bg-sky-500/80 text-white'
                  : 'text-slate-300 hover:bg-white/5')
              }
            >
              {m.label}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
