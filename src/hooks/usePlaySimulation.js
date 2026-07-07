import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { buildOilModel, ageOilGrid, trackFromPoints } from '../lib/oilModel.js';
import { simulateShot, recommendLines, DEFAULT_PLAYER } from '../lib/ballMotion.js';
import { isTypingTarget } from '../lib/utils.js';

// ---- 플레이: shot simulation + line recommendations ------------------------
// Owns the bowler/ball spec, playback state (play/pause/scrub/speed), the oil
// transition (breakdown + carrydown), and the recommended lines.
// `selected` is the DISPLAY grid selection from App (sheet/realistic toggle);
// `tab` gates the spacebar shortcut to the play tab.
export default function usePlaySimulation({ forwardPasses, reversePasses, view, meta, selected, tab }) {
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
  // Merge a spec/line patch into the current play state and restart playback —
  // shared by "이 라인 적용" and loading a saved setup from the arsenal.
  const applyPlayPatch = useCallback((patch) => {
    setPlay((p) => ({ ...p, ...patch }));
    setReplayKey((k) => k + 1);
    setScrub(null);
    setPlaying(true);
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
  const onApplyLine = useCallback(
    (line) => {
      if (!line) return;
      applyPlayPatch({ laydownBoard: line.laydownBoard, targetBoard: line.targetBoard });
    },
    [applyPlayPatch]
  );

  // Spacebar = play/pause on the play tab (not while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      if (tab !== 'play') return;
      if (isTypingTarget()) return;
      e.preventDefault();
      onTogglePlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, onTogglePlay]);

  return {
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
  };
}
