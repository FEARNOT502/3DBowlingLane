import { useState, useCallback } from 'react';

// View toggles/sliders shared by the 3D scene, toolbar, and the 보기 tab,
// plus camera preset commands consumed by the Scene.
export default function useViewSettings() {
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

  // ---- Camera presets -----------------------------------------------------
  const [cameraCmd, setCameraCmd] = useState(null);
  const onCameraPreset = useCallback((id) => setCameraCmd({ id, n: Date.now() }), []);

  return { view, onViewChange, cameraCmd, onCameraPreset };
}
