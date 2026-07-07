import { useState, useCallback } from 'react';
import { loadSetups, saveSetup, deleteSetup } from '../lib/storage.js';

// ---- Arsenal (saved spec + line setups) -------------------------------------
// `play` supplies the current spec/line to snapshot; `applyPlayPatch` (from
// usePlaySimulation) merges a loaded setup back in and restarts playback.
export default function useArsenal(play, applyPlayPatch) {
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
  const onLoadSetup = useCallback(
    (id) => {
      setSetups((cur) => {
        const s = cur.find((x) => x.id === id);
        if (s) applyPlayPatch({ ...s.spec, ...s.line });
        return cur;
      });
    },
    [applyPlayPatch]
  );
  const onDeleteSetup = useCallback((id) => setSetups(deleteSetup(id)), []);

  return { setups, onSaveSetup, onLoadSetup, onDeleteSetup };
}
