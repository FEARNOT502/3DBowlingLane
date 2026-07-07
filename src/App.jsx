import React, { useMemo, useState, useCallback } from 'react';
import Scene from './components/Scene.jsx';
import BallInspector from './components/BallInspector.jsx';
import ControlPanel, { PanelTabBar } from './components/ControlPanel.jsx';
import BottomSheet, { SHEET_PEEK } from './components/BottomSheet.jsx';
import Toolbar from './components/Toolbar.jsx';
import AppHeader, { ThemeToggle } from './components/AppHeader.jsx';
import { SAMPLE_PATTERNS } from './data/samplePatterns.js';
import { totalOilMl } from './lib/parsePattern.js';
import { buildOilModel, selectGrid } from './lib/oilModel.js';
import { computeStats, boardChartData, sliceChartData } from './lib/analysis.js';
import { IconPlay, IconPause } from './components/icons.jsx';
import useTheme from './hooks/useTheme.js';
import useMediaQuery from './hooks/useMediaQuery.js';
import usePatternSource from './hooks/usePatternSource.js';
import useViewSettings from './hooks/useViewSettings.js';
import usePlaySimulation from './hooks/usePlaySimulation.js';
import useArsenal from './hooks/useArsenal.js';

// Pattern summary card — compact infographic strip over the canvas.
function PatternSummaryCard({ meta, totals }) {
  return (
    <div className="pointer-events-none absolute left-4 top-4 max-w-[70vw] rounded-[11px] border border-[#eae5db] bg-white/95 px-4 py-2.5 shadow-[0_3px_12px_rgba(40,40,60,.06)] backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80 lg:left-5 lg:top-5">
      <div className="truncate text-xs font-semibold tracking-tight text-[#1c1b1a] dark:text-white">
        {meta.name || '패턴'}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-semibold tabular-nums text-[#1c1b1a] dark:text-sky-300">
            {meta.distance}
          </span>
          <span className="text-[10px] text-[#c2bbab] dark:text-slate-500">ft</span>
        </span>
        <span className="h-3 w-px bg-[#eae5db] dark:bg-white/10" />
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-sm font-semibold tabular-nums text-[#1c1b1a] dark:text-sky-300">
            {totals.combinedMl.toFixed(1)}
          </span>
          <span className="text-[10px] text-[#c2bbab] dark:text-slate-500">mL</span>
        </span>
      </div>
      <div className="mt-1 hidden text-[10px] text-[#bdb7ac] dark:text-slate-500 sm:block">
        드래그 회전 · 휠 줌 · 우클릭 이동
      </div>
    </div>
  );
}

export default function App() {
  const {
    activeId,
    meta,
    trackZones,
    forwardText,
    reverseText,
    applied,
    importing,
    importError,
    pageImage,
    importInfo,
    aiText,
    aiError,
    saved,
    setForwardText,
    setReverseText,
    setAiText,
    loadSample,
    onApply,
    onDistanceChange,
    onImportPdf,
    onAiImport,
    onLoadSaved,
    onDeleteSaved,
  } = usePatternSource();

  const [theme, setTheme] = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState('pattern');
  const [sheetSnap, setSheetSnap] = useState('peek');

  const { view, onViewChange, cameraCmd, onCameraPreset } = useViewSettings();

  // Tab tap on the collapsed mobile sheet should also open it.
  const onTabChange = useCallback(
    (id) => {
      setTab(id);
      if (!isDesktop) setSheetSnap((s) => (s === 'peek' ? 'half' : s));
    },
    [isDesktop]
  );

  const { forwardPasses, reversePasses, parseInfo } = applied;

  const model = useMemo(
    () =>
      buildOilModel(forwardPasses, reversePasses, {
        flip: view.flipPattern,
        // 포워드 버프아웃 거리(=패턴 거리): 버퍼 브러쉬 전폭 필름이 여기까지 깔린다.
        buffOutFeet: Number(meta.distance) || 0,
        // 리버스 브러쉬는 드롭 지점부터 파울라인까지 버프 — 필름 시작점.
        reverseBrushDropFeet: Number(meta.reverseBrushDrop) || 0,
        // 시트 모드: 인쇄된 그래프처럼 보드 단위 계단이 살아 있도록 블러 최소.
        // 실제 레인 모드: 버퍼 브러쉬가 옆으로 퍼진 부드러운 그라데이션.
        smoothBoards: view.oilMode === 'sheet' ? 0.45 : 2.2,
        smoothFeet: view.oilMode === 'sheet' ? 0.45 : 0.7,
      }),
    [forwardPasses, reversePasses, view.flipPattern, view.oilMode, meta.distance, meta.reverseBrushDrop]
  );

  const selected = useMemo(
    () => selectGrid(model, view.showForward, view.showReverse),
    [model, view.showForward, view.showReverse]
  );

  const stats = useMemo(() => computeStats(model), [model]);
  const chartData = useMemo(() => boardChartData(model), [model]);

  const {
    play,
    onPlayChange,
    playing,
    onTogglePlay,
    playSpeed,
    setPlaySpeed,
    scrub,
    onScrubChange,
    replayKey,
    shotClock,
    sim,
    recs,
    displayGrid,
    onShotsChange,
    onResetTransition,
    onApplyLine,
    applyPlayPatch,
  } = usePlaySimulation({ forwardPasses, reversePasses, view, meta, selected, tab });

  const { setups, onSaveSetup, onLoadSetup, onDeleteSetup } = useArsenal(play, applyPlayPatch);

  // ---- 분석: cross-section slice ----------------------------------------
  const [sliceFeet, setSliceFeet] = useState(20);
  const sliceData = useMemo(() => sliceChartData(model, sliceFeet), [model, sliceFeet]);

  const totals = useMemo(
    () => ({
      forwardMl: totalOilMl(forwardPasses),
      reverseMl: totalOilMl(reversePasses),
      combinedMl: totalOilMl(forwardPasses) + totalOilMl(reversePasses),
    }),
    [forwardPasses, reversePasses]
  );

  const panelProps = {
    patterns: SAMPLE_PATTERNS,
    activeId,
    onLoadSample: loadSample,
    savedPatterns: saved,
    onLoadSaved,
    onDeleteSaved,
    onImportPdf,
    importing,
    importError,
    pageImage,
    importInfo,
    aiText,
    onAiTextChange: setAiText,
    onAiImport,
    aiError,
    meta,
    onDistanceChange,
    forwardText,
    reverseText,
    onForwardTextChange: setForwardText,
    onReverseTextChange: setReverseText,
    onApply,
    parseInfo,
    forwardPasses,
    reversePasses,
    view,
    onViewChange,
    layer: selected.layer,
    stats,
    chartData,
    totals,
    trackZones,
    play,
    onPlayChange,
    sim,
    recs,
    onApplyLine,
    playing,
    onTogglePlay,
    playSpeed,
    onPlaySpeedChange: setPlaySpeed,
    scrub,
    onScrubChange,
    onShotsChange,
    onResetTransition,
    setups,
    onSaveSetup,
    onLoadSetup,
    onDeleteSetup,
    onCameraPreset,
    sliceFeet,
    onSliceFeetChange: setSliceFeet,
    sliceData,
    sliceMax: model.norm.combined,
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#f6f4f0] dark:bg-slate-950">
      {/* Desktop header — full-width bar above the sidebar/canvas split */}
      {isDesktop && <AppHeader theme={theme} setTheme={setTheme} />}

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Desktop sidebar */}
        {isDesktop && (
          <aside className="flex h-full w-[340px] shrink-0 flex-col border-r border-[#eeeae2] bg-white dark:border-white/10 dark:bg-slate-950">
            <div className="shrink-0 px-5 pt-5">
              <PanelTabBar tab={tab} onTabChange={onTabChange} />
            </div>
            <div className="relative min-h-0 flex-1">
              <div className="scroll-thin h-full overflow-y-auto">
                <ControlPanel tab={tab} {...panelProps} />
              </div>
              {/* bottom scroll fade */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-9 bg-gradient-to-b from-white/0 to-white dark:from-slate-950/0 dark:to-slate-950" />
            </div>
          </aside>
        )}

        <main className="relative min-w-0 flex-1">
        <Scene
          theme={theme}
          cameraCmd={cameraCmd}
          grid={displayGrid}
          max={selected.max}
          layer={selected.layer}
          components={selected.components}
          // 플레이 탭은 궤적·볼이 주인공 — 오일 릴리프(두께)는 평평하게 눌러서
          // 라인이 오일 슬래브에 가려지지 않게 한다.
          thickness={tab === 'play' ? 0 : view.thickness}
          opacity={view.opacity}
          showOil={view.showOil}
          showLabels={view.showLabels}
          showPins={view.showPins}
          widthScale={view.widthScale}
          patternDistance={meta.distance}
          oilMode={view.oilMode}
          ballSim={tab === 'play' ? sim : null}
          showPath={play.showPath}
          replayKey={replayKey}
          ballPlaying={playing}
          ballPlaySpeed={playSpeed}
          ballClockRef={shotClock}
          ballScrub={scrub}
          sliceFeet={sliceFeet}
          showSlice={tab === 'analysis'}
        />

        {/* Ball inspector — isolated spinning ball + track flare, top-right.
            On mobile it drops below the floating theme toggle so they don't overlap. */}
        {tab === 'play' && view.showInspector && (
          <BallInspector
            sim={sim}
            clockRef={shotClock}
            theme={theme}
            className={isDesktop ? 'right-4 top-4' : 'right-3 top-[52px]'}
            onClose={() => onViewChange('showInspector', false)}
          />
        )}

        <PatternSummaryCard meta={meta} totals={totals} />

        {/* Mobile: theme toggle floats over the canvas (desktop has it in the header) */}
        {!isDesktop && (
          <ThemeToggle theme={theme} setTheme={setTheme} className="absolute right-4 top-4" />
        )}

        {/* Quick-access toolbar. On mobile it sits above the collapsed sheet and
            hides while the sheet is open so it never overlaps panel content. */}
        {(isDesktop || sheetSnap === 'peek') && (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 flex items-center justify-center gap-2 px-3"
            style={{ bottom: isDesktop ? 20 : SHEET_PEEK + 12 }}
          >
            <Toolbar view={view} onViewChange={onViewChange} />
            {/* 플레이 탭: play/pause right on the canvas, no panel round-trip */}
            {tab === 'play' && (
              <button
                type="button"
                onClick={onTogglePlay}
                title={playing ? '일시정지' : '재생'}
                className="pointer-events-auto grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[14px] bg-[oklch(0.55_0.13_262)] text-white shadow-[0_6px_22px_rgba(40,40,60,.18)] transition-all hover:bg-[oklch(0.6_0.13_262)] active:scale-95 dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                {playing ? <IconPause size={15} /> : <IconPlay size={15} />}
              </button>
            )}
          </div>
        )}

        {/* Mobile bottom sheet */}
        {!isDesktop && (
          <BottomSheet
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            header={<PanelTabBar tab={tab} onTabChange={onTabChange} />}
          >
            <ControlPanel tab={tab} {...panelProps} />
          </BottomSheet>
        )}
        </main>
      </div>
    </div>
  );
}
