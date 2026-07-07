import React from 'react';
import PatternTab from './tabs/PatternTab.jsx';
import ViewTab from './tabs/ViewTab.jsx';
import AnalysisTab from './tabs/AnalysisTab.jsx';
import PlayTab from './tabs/PlayTab.jsx';
import { IconImport, IconSliders, IconChart, IconBall } from './icons.jsx';

export const PANEL_TABS = [
  { id: 'pattern', label: '패턴', Icon: IconImport },
  { id: 'view', label: '보기', Icon: IconSliders },
  { id: 'play', label: '플레이', Icon: IconBall },
  { id: 'analysis', label: '분석', Icon: IconChart },
];

// Pill tab bar on a soft grey track. Kept separate from the content so the
// mobile bottom sheet can pin it in the always-visible header area.
export function PanelTabBar({ tab, onTabChange, className = '' }) {
  return (
    <div
      className={`flex gap-1 rounded-xl bg-[#f4f1eb] p-[5px] dark:bg-white/[0.06] ${className}`}
    >
      {PANEL_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onTabChange(t.id)}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 py-2 text-xs transition-all ${
            tab === t.id
              ? 'bg-white font-semibold text-[oklch(0.55_0.13_262)] shadow-[0_1px_3px_rgba(0,0,0,.06)] dark:bg-slate-700 dark:text-sky-300'
              : 'font-medium text-[#a8a297] hover:text-[#6b665c] dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <t.Icon size={13} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Content of the active tab. All state lives in App; this component only routes
// props into the right tab so desktop sidebar and mobile sheet share one source.
export default function ControlPanel({ tab, ...props }) {
  if (tab === 'view') {
    return (
      <ViewTab
        view={props.view}
        onViewChange={props.onViewChange}
        layer={props.layer}
        onCameraPreset={props.onCameraPreset}
      />
    );
  }
  if (tab === 'play') {
    return (
      <PlayTab
        play={props.play}
        onPlayChange={props.onPlayChange}
        sim={props.sim}
        recs={props.recs}
        onApplyLine={props.onApplyLine}
        playing={props.playing}
        onTogglePlay={props.onTogglePlay}
        playSpeed={props.playSpeed}
        onPlaySpeedChange={props.onPlaySpeedChange}
        setups={props.setups}
        onSaveSetup={props.onSaveSetup}
        onLoadSetup={props.onLoadSetup}
        onDeleteSetup={props.onDeleteSetup}
        scrub={props.scrub}
        onScrubChange={props.onScrubChange}
        onShotsChange={props.onShotsChange}
        onResetTransition={props.onResetTransition}
      />
    );
  }
  if (tab === 'analysis') {
    return (
      <AnalysisTab
        forwardText={props.forwardText}
        reverseText={props.reverseText}
        onForwardTextChange={props.onForwardTextChange}
        onReverseTextChange={props.onReverseTextChange}
        onApply={props.onApply}
        parseInfo={props.parseInfo}
        forwardPasses={props.forwardPasses}
        reversePasses={props.reversePasses}
        view={props.view}
        stats={props.stats}
        chartData={props.chartData}
        trackZones={props.trackZones}
        sliceFeet={props.sliceFeet}
        onSliceFeetChange={props.onSliceFeetChange}
        sliceData={props.sliceData}
        sliceMax={props.sliceMax}
      />
    );
  }
  return (
    <PatternTab
      patterns={props.patterns}
      activeId={props.activeId}
      onLoadSample={props.onLoadSample}
      savedPatterns={props.savedPatterns}
      onLoadSaved={props.onLoadSaved}
      onDeleteSaved={props.onDeleteSaved}
      onImportPdf={props.onImportPdf}
      importing={props.importing}
      importError={props.importError}
      pageImage={props.pageImage}
      importInfo={props.importInfo}
      aiText={props.aiText}
      onAiTextChange={props.onAiTextChange}
      onAiImport={props.onAiImport}
      aiError={props.aiError}
      meta={props.meta}
      onDistanceChange={props.onDistanceChange}
      totals={props.totals}
    />
  );
}
