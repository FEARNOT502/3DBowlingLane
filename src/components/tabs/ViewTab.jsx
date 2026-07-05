import React from 'react';
import Legend from '../Legend.jsx';
import { Section, Toggle, Slider, Segmented } from '../ui.jsx';

// ---------------------------------------------------------------------------
// 보기 tab — layer visibility, oil display mode and visualization sliders.
// The floating toolbar mirrors the most-used controls; this tab is the full set.
// ---------------------------------------------------------------------------

export default function ViewTab({ view, onViewChange, layer, onCameraPreset }) {
  return (
    <div className="pb-4">
      <Section title="카메라 시점" hint="원터치로 시점을 이동합니다. 이후 드래그로 자유롭게 회전할 수 있어요.">
        <Segmented
          options={[
            { id: 'default', label: '기본' },
            { id: 'pov', label: '볼러 시점' },
            { id: 'side', label: '측면' },
            { id: 'top', label: '탑다운' },
          ]}
          value=""
          onChange={(id) => onCameraPreset?.(id)}
        />
      </Section>

      <Section
        title="오일 표시 모드"
        hint="패턴표 = 인쇄된 그래프 스타일 · 실제 레인 = PBA 중계 화면 느낌"
      >
        <Segmented
          options={[
            { id: 'sheet', label: '패턴표' },
            { id: 'realistic', label: '실제 레인' },
          ]}
          value={view.oilMode}
          onChange={(v) => onViewChange('oilMode', v)}
        />
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
        <div className="mt-3 px-2">
          <Legend layer={layer} />
        </div>
      </Section>

      <Section title="플레이 오버레이" hint="플레이 탭에서 표시됩니다.">
        <Toggle
          label="볼 인스펙터 창 (우상단)"
          color="#38bdf8"
          checked={view.showInspector}
          onChange={(v) => onViewChange('showInspector', v)}
        />
      </Section>

      <Section title="시각화 옵션">
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
    </div>
  );
}
