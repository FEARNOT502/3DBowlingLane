import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Scene from './components/Scene.jsx';
import BallInspector from './components/BallInspector.jsx';
import ControlPanel, { PanelTabBar } from './components/ControlPanel.jsx';
import BottomSheet, { SHEET_PEEK } from './components/BottomSheet.jsx';
import Toolbar from './components/Toolbar.jsx';
import { SAMPLE_PATTERNS, JINSEUNG_A } from './data/samplePatterns.js';
import { parsePassTable, totalOilMl } from './lib/parsePattern.js';
import { buildOilModel, selectGrid, ageOilGrid, trackFromPoints } from './lib/oilModel.js';
import { computeStats, boardChartData, sliceChartData } from './lib/analysis.js';
import { simulateShot, recommendLines, DEFAULT_PLAYER } from './lib/ballMotion.js';
import { importPatternFromPdf } from './lib/pdfImport.js';
import { parseAiImport } from './lib/aiImport.js';
import { loadSavedPatterns, savePattern, deletePattern, loadSetups, saveSetup, deleteSetup } from './lib/storage.js';
import { IconSun, IconMoon, IconPlay, IconPause, LogoMark } from './components/icons.jsx';

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

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ui-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('ui-theme', theme);
  }, [theme]);
  return [theme, setTheme];
}

function ThemeToggle({ theme, setTheme, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
      className={`grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-slate-400 active:scale-95 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-white/30 ${className}`}
    >
      {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
    </button>
  );
}

function AppHeader({ theme, setTheme }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <LogoMark size={34} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
          Lane Oil Pattern 3D
        </h1>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">오일 패턴 시각화 · 분석</p>
      </div>
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </div>
  );
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

  const [theme, setTheme] = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState('pattern');
  const [sheetSnap, setSheetSnap] = useState('peek');

  const [view, setView] = useState({
    showForward: true,
    showReverse: true,
    showOil: true,
    showLabels: true,
    showPins: true,
    // 플레이 오버레이
    showInspector: true,
    // Kegel 시트의 forward 테이블은 파울라인(0ft)에서 시작하므로 그대로가
    // 올바른 방향 — 반전은 옵션으로만 남긴다.
    flipPattern: false,
    opacity: 0.95,
    thickness: 0,
    // 1 = 실제 비율(레인은 60ft × 41.5"로 매우 가늘다). 기본값은 인쇄된
    // 패턴표 그래프와 같은 비율(실제 폭의 약 5배)로 설정.
    widthScale: 5,
    oilMode: 'sheet', // 'sheet' (패턴표) | 'realistic' (PBA 실제 레인)
  });

  const onViewChange = useCallback((field, value) => {
    setView((v) => ({ ...v, [field]: value }));
  }, []);

  // Tab tap on the collapsed mobile sheet should also open it.
  const onTabChange = useCallback(
    (id) => {
      setTab(id);
      if (!isDesktop) setSheetSnap((s) => (s === 'peek' ? 'half' : s));
    },
    [isDesktop]
  );

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

  const onLoadSaved = useCallback(
    (id) => {
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
    },
    [saved]
  );

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

  // ---- 플레이: shot simulation + line recommendations --------------------
  // Physics always runs on the REAL-lane grid (buffer-spread smoothing),
  // independent of the sheet/realistic display toggle — switching how the oil
  // is DRAWN must not change how the ball behaves.
  const physicsModel = useMemo(
    () =>
      buildOilModel(forwardPasses, reversePasses, {
        flip: view.flipPattern,
        buffOutFeet: Number(meta.distance) || 0,
        reverseBrushDropFeet: Number(meta.reverseBrushDrop) || 0,
        smoothBoards: 2.2,
        smoothFeet: 0.7,
      }),
    [forwardPasses, reversePasses, view.flipPattern, meta.distance, meta.reverseBrushDrop]
  );
  const [play, setPlay] = useState({ ...DEFAULT_PLAYER, showPath: true, shots: 0 });
  const [replayKey, setReplayKey] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [scrub, setScrub] = useState(null); // null = live; 0..1 = paused at fraction
  // Shared playback clock so the top-right ball inspector stays in lock-step with
  // the ball rolling down the lane (both read this same mutable ref).
  const shotClock = useRef({ t: 0, T: 1 });
  const onPlayChange = useCallback((field, value) => {
    setPlay((p) => ({ ...p, [field]: value }));
  }, []);
  const onTogglePlay = useCallback(() => {
    setScrub(null);
    setPlaying((p) => !p);
  }, []);
  const onScrubChange = useCallback((v) => {
    if (v == null) {
      setScrub(null);
      setPlaying(true);
    } else {
      setScrub(v);
      setPlaying(false);
    }
  }, []);

  const freshSim = useMemo(
    () => simulateShot(physicsModel.combined, physicsModel.norm.combined, play),
    [physicsModel, play]
  );

  // Oil transition: breakdown + carrydown follow a line, but the track is a
  // FROZEN SNAPSHOT (transitionTrack) captured when the transition is first
  // applied — NOT the live aim. So moving the spot or applying a recommended
  // line doesn't reshuffle the oil that's already been pushed; the ball just
  // reacts to the standing lane condition. The 초기화 button clears it.
  const [transitionTrack, setTransitionTrack] = useState(null);
  const onShotsChange = useCallback(
    (v) => {
      setPlay((p) => ({ ...p, shots: v }));
      if (v <= 0) setTransitionTrack(null); // re-arm at fresh
      else setTransitionTrack((cur) => cur || trackFromPoints(freshSim.points));
    },
    [freshSim]
  );
  const onResetTransition = useCallback(() => {
    setTransitionTrack(null);
    setPlay((p) => ({ ...p, shots: 0 }));
  }, []);

  const agedGrid = useMemo(
    () => ageOilGrid(physicsModel.combined, physicsModel.norm.combined, play.shots, Number(meta.distance) || null, transitionTrack),
    [physicsModel, play.shots, meta.distance, transitionTrack]
  );

  const sim = useMemo(
    () => (play.shots > 0 ? simulateShot(agedGrid, physicsModel.norm.combined, play) : freshSim),
    [play.shots, agedGrid, physicsModel.norm.combined, play, freshSim]
  );

  // Realistic mode SHOWS the oil moving: age the displayed grid along the frozen
  // track too, so breakdown (drier heads on the line) and carrydown (film pushed
  // past the pattern) are visible on the lane. Sheet mode stays as-printed.
  const displayGrid = useMemo(() => {
    if (view.oilMode === 'realistic' && play.shots > 0) {
      return ageOilGrid(selected.grid, selected.max, play.shots, Number(meta.distance) || null, transitionTrack);
    }
    return selected.grid;
  }, [selected.grid, selected.max, view.oilMode, play.shots, meta.distance, transitionTrack]);
  // Recommendations depend on the bowler/ball spec (incl. release axis) and the
  // aged pattern — not the current line.
  const recs = useMemo(
    () =>
      recommendLines(
        agedGrid,
        physicsModel.norm.combined,
        {
          hand: play.hand,
          speedKmh: play.speedKmh,
          revRpm: play.revRpm,
          rg: play.rg,
          diff: play.diff,
          psa: play.psa,
          axisRotDeg: play.axisRotDeg,
          axisTiltDeg: play.axisTiltDeg,
        },
        Number(meta.distance) || null
      ),
    [agedGrid, physicsModel.norm.combined, play.hand, play.speedKmh, play.revRpm, play.rg, play.diff, play.psa, play.axisRotDeg, play.axisTiltDeg, meta.distance]
  );
  const onApplyLine = useCallback((line) => {
    if (!line) return;
    setPlay((p) => ({ ...p, laydownBoard: line.laydownBoard, targetBoard: line.targetBoard }));
    setReplayKey((k) => k + 1);
    setScrub(null);
    setPlaying(true);
  }, []);

  // ---- Camera presets -----------------------------------------------------
  const [cameraCmd, setCameraCmd] = useState(null);
  const onCameraPreset = useCallback((id) => setCameraCmd({ id, n: Date.now() }), []);

  // ---- Arsenal (saved spec + line setups) ---------------------------------
  const [setups, setSetups] = useState(() => loadSetups());
  const onSaveSetup = useCallback(
    (name) => {
      setSetups(
        saveSetup({
          name,
          spec: {
            hand: play.hand,
            speedKmh: play.speedKmh,
            revRpm: play.revRpm,
            rg: play.rg,
            diff: play.diff,
            psa: play.psa,
            axisRotDeg: play.axisRotDeg,
            axisTiltDeg: play.axisTiltDeg,
          },
          line: { laydownBoard: play.laydownBoard, targetBoard: play.targetBoard },
        })
      );
    },
    [play]
  );
  const onLoadSetup = useCallback((id) => {
    setSetups((cur) => {
      const s = cur.find((x) => x.id === id);
      if (s) {
        setPlay((p) => ({ ...p, ...s.spec, ...s.line }));
        setReplayKey((k) => k + 1);
        setScrub(null);
        setPlaying(true);
      }
      return cur;
    });
  }, []);
  const onDeleteSetup = useCallback((id) => setSetups(deleteSetup(id)), []);

  // Spacebar = play/pause on the play tab (not while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      if (tab !== 'play') return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      onTogglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, onTogglePlay]);

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
    <div className="flex h-full w-full bg-[#f4f6fb] dark:bg-slate-950">
      {/* Desktop sidebar */}
      {isDesktop && (
        <aside className="flex h-full w-[372px] shrink-0 flex-col border-r border-slate-200/80 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
          <div className="shrink-0">
            <AppHeader theme={theme} setTheme={setTheme} />
            <div className="px-4 pb-1">
              <PanelTabBar tab={tab} onTabChange={onTabChange} />
            </div>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <ControlPanel tab={tab} {...panelProps} />
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

        {/* Pattern summary card — compact infographic strip */}
        <div className="pointer-events-none absolute left-4 top-4 max-w-[70vw] rounded-lg border border-slate-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-900/80 lg:left-5 lg:top-5">
          <div className="truncate text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">
            {meta.name || '패턴'}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="flex items-baseline gap-1">
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-sky-300">
                {meta.distance}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">ft</span>
            </span>
            <span className="h-3 w-px bg-slate-200 dark:bg-white/10" />
            <span className="flex items-baseline gap-1">
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-sky-300">
                {totals.combinedMl.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">mL</span>
            </span>
          </div>
          <div className="mt-1 hidden text-[10px] text-slate-400 dark:text-slate-500 sm:block">
            드래그 회전 · 휠 줌 · 우클릭 이동
          </div>
        </div>

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
                className="pointer-events-auto grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 active:scale-95 dark:bg-sky-500 dark:hover:bg-sky-400"
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
  );
}
