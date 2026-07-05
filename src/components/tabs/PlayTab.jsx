import React, { useState } from 'react';
import { Section, Card, Button, Stat, Slider, Segmented, Toggle, Disclosure } from '../ui.jsx';
import { IconPlay, IconPause, IconX } from '../icons.jsx';
import ShotChart from '../ShotChart.jsx';
import { POCKET_BOWLER_BOARD } from '../../lib/ballMotion.js';

// ---------------------------------------------------------------------------
// 플레이 tab — bowler/ball spec inputs, my line simulation readout, and the
// recommended outside (윗장) / inside (아랫장) lines with their rationale.
// Boards are BOWLER boards: counted in from the gutter on the hand side, so the
// sliders run 40→1 for a righty (hand-side gutter on the right, like reading the
// lane) and 1→40 for a lefty.
// ---------------------------------------------------------------------------

const PRESETS = [
  { id: 'stroker', label: '스트로커', speedKmh: 28, revRpm: 280 },
  { id: 'tweener', label: '트위너', speedKmh: 30, revRpm: 350 },
  { id: 'cranker', label: '크랭커', speedKmh: 32, revRpm: 480 },
];

const VERDICTS = {
  pocket: { label: '포켓', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  high: { label: '두꺼움', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  light: { label: '얇음', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  gutter: { label: '거터', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
};

function VerdictBadge({ verdict }) {
  const v = VERDICTS[verdict] || VERDICTS.light;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${v.cls}`}>
      {v.label}
    </span>
  );
}

function SimReadout({ sim }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="엔트리" value={sim.entryBoard.toFixed(1)} sub="보드" />
      <Stat label="진입각" value={sim.entryAngleDeg.toFixed(1)} sub="°" />
      <Stat
        label="브레이크포인트"
        value={sim.breakpoint.board.toFixed(1)}
        sub={`보드 · ${sim.breakpoint.feet.toFixed(0)}ft`}
      />
    </div>
  );
}

function RecommendCard({ title, subtitle, rec, onApply }) {
  if (!rec) {
    return (
      <Card className="px-3 py-3">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{title}</div>
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          이 구역에서는 포켓에 도달하는 라인을 찾지 못했습니다. 스피드·회전수·볼 스펙을 조정해 보세요.
        </p>
      </Card>
    );
  }
  const { sim } = rec;
  return (
    <Card className="px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</span>
          <span className="ml-1.5 text-[10px] text-slate-400 dark:text-slate-500">{subtitle}</span>
        </div>
        <VerdictBadge verdict={sim.verdict} />
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-xl font-bold tabular-nums text-blue-600 dark:text-sky-300">
          {rec.laydownBoard}
          <span className="mx-1 text-sm font-semibold text-slate-400 dark:text-slate-500">→</span>
          {rec.targetBoard}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">스탠스 → 타겟(에로우) 보드</span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        {[
          ['엔트리', `${sim.entryBoard.toFixed(1)}`],
          ['진입각', `${sim.entryAngleDeg.toFixed(1)}°`],
          ['BP', `${sim.breakpoint.board.toFixed(1)} @ ${sim.breakpoint.feet.toFixed(0)}ft`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-white px-1 py-1.5 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:ring-white/10">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{k}</div>
            <div className="font-mono text-[11px] font-semibold tabular-nums text-slate-800 dark:text-slate-200">{v}</div>
          </div>
        ))}
      </div>

      <ul className="mt-2.5 space-y-1">
        {rec.reasons.map((r, i) => (
          <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-blue-400 dark:bg-sky-500" />
            {r}
          </li>
        ))}
      </ul>

      <Button variant="soft" className="mt-3 w-full" onClick={onApply}>
        이 라인 적용
      </Button>
    </Card>
  );
}

// --- Arsenal: saved bowler/ball spec + line setups -------------------------
function ArsenalSection({ play, setups, onSaveSetup, onLoadSetup, onDeleteSetup }) {
  const [name, setName] = useState('');
  const save = () => {
    const n = name.trim() || `셋업 ${new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}`;
    onSaveSetup(n);
    setName('');
  };
  return (
    <Section title="내 셋업 (아스날)" hint="현재 볼러·볼 스펙과 라인을 통째로 저장해 두고 어떤 패턴에서도 불러오세요.">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="셋업 이름 (예: 스톰 볼 · 윗장)"
          className="min-w-0 flex-1 rounded-md bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-400 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-white/10"
        />
        <Button onClick={save}>저장</Button>
      </div>
      {setups.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {setups.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <button type="button" onClick={() => onLoadSetup(s.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">{s.name}</div>
                <div className="truncate font-mono text-[9px] text-slate-400 dark:text-slate-500">
                  {s.spec.hand} · {s.spec.speedKmh}km/h · {s.spec.revRpm}rpm · {s.line.laydownBoard}→{s.line.targetBoard}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDeleteSetup(s.id)}
                title="삭제"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
              >
                <IconX size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export default function PlayTab({
  play,
  onPlayChange,
  sim,
  recs,
  onApplyLine,
  playing,
  onTogglePlay,
  playSpeed,
  onPlaySpeedChange,
  setups = [],
  onSaveSetup,
  onLoadSetup,
  onDeleteSetup,
  scrub,
  onScrubChange,
  onShotsChange,
  onResetTransition,
}) {
  const activePreset = PRESETS.find(
    (p) => p.speedKmh === play.speedKmh && p.revRpm === play.revRpm
  )?.id;
  const reverseBoards = play.hand === 'R'; // righty: gutter(1) on the right

  const [zone, setZone] = useState(null);
  const bestZone =
    (recs.outside?.score || 0) >= (recs.inside?.score || 0) ? 'outside' : 'inside';
  const activeZone = zone || bestZone;
  const activeRec = recs[activeZone];

  const scrubbing = scrub != null;

  return (
    <div className="pb-4">
      <Section title="볼러 · 볼 스펙" hint="보드 번호는 사용 손 쪽 거터에서 안쪽으로 셉니다 (거터 = 1번).">
        <div className="mb-2 flex items-center gap-2">
          <Segmented
            className="flex-1"
            options={[
              { id: 'R', label: '오른손 (1-3 포켓)' },
              { id: 'L', label: '왼손 (1-2 포켓)' },
            ]}
            value={play.hand}
            onChange={(v) => onPlayChange('hand', v)}
          />
        </div>
        <Segmented
          size="sm"
          options={PRESETS.map((p) => ({ id: p.id, label: p.label }))}
          value={activePreset || ''}
          onChange={(id) => {
            const p = PRESETS.find((x) => x.id === id);
            if (p) {
              onPlayChange('speedKmh', p.speedKmh);
              onPlayChange('revRpm', p.revRpm);
            }
          }}
        />
        <div className="mt-1">
          <Slider
            label="볼 스피드"
            value={play.speedKmh}
            min={20}
            max={40}
            step={0.5}
            fmt={(v) => v.toFixed(1)}
            suffix=" km/h"
            onChange={(v) => onPlayChange('speedKmh', v)}
          />
          <Slider
            label="회전수 (Rev Rate)"
            value={play.revRpm}
            min={150}
            max={600}
            step={10}
            suffix=" rpm"
            onChange={(v) => onPlayChange('revRpm', v)}
          />
        </div>
        <Disclosure summary={<>릴리스 축 · 볼 스펙</>}>
          <p className="mb-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            축 회전↑ 훅 길이 증가 · 축 틸트↑ 플레어 감소·조기 롤 · RG↑ 스키드 길어짐 · Diff↑ 훅 증가 · PSA↑ 각지게 꺾임
          </p>
          <Slider
            label="축 회전 (Axis Rotation)"
            value={play.axisRotDeg}
            min={0}
            max={90}
            step={1}
            suffix="°"
            onChange={(v) => onPlayChange('axisRotDeg', v)}
          />
          <Slider
            label="축 틸트 (Axis Tilt)"
            value={play.axisTiltDeg}
            min={0}
            max={45}
            step={1}
            suffix="°"
            onChange={(v) => onPlayChange('axisTiltDeg', v)}
          />
          <Slider
            label="RG"
            value={play.rg}
            min={2.43}
            max={2.72}
            step={0.005}
            fmt={(v) => v.toFixed(3)}
            onChange={(v) => onPlayChange('rg', v)}
          />
          <Slider
            label="Differential"
            value={play.diff}
            min={0}
            max={0.09}
            step={0.001}
            fmt={(v) => v.toFixed(3)}
            onChange={(v) => onPlayChange('diff', v)}
          />
          <Slider
            label="PSA (Intermediate Diff)"
            value={play.psa}
            min={0}
            max={0.04}
            step={0.001}
            fmt={(v) => v.toFixed(3)}
            onChange={(v) => onPlayChange('psa', v)}
          />
        </Disclosure>
      </Section>

      <ArsenalSection
        play={play}
        setups={setups}
        onSaveSetup={onSaveSetup}
        onLoadSetup={onLoadSetup}
        onDeleteSetup={onDeleteSetup}
      />

      <Section title="내 라인" action={<VerdictBadge verdict={sim.verdict} />}>
        <Slider
          label="스탠스 (레이다운) 보드"
          value={play.laydownBoard}
          min={1}
          max={39}
          step={0.5}
          reverse={reverseBoards}
          fmt={(v) => v.toFixed(1)}
          onChange={(v) => onPlayChange('laydownBoard', v)}
        />
        <Slider
          label="타겟 보드 (에로우 · 15ft)"
          value={play.targetBoard}
          min={1}
          max={30}
          step={0.5}
          reverse={reverseBoards}
          fmt={(v) => v.toFixed(1)}
          onChange={(v) => onPlayChange('targetBoard', v)}
        />
        <div className="mt-2">
          <SimReadout sim={sim} />
        </div>
        <p className="mt-2 px-1 text-[11px] text-slate-400 dark:text-slate-500">
          포켓 기준 {POCKET_BOWLER_BOARD}보드 · 진입 스피드 {sim.entrySpeedKmh.toFixed(1)} km/h · 이상적 진입각 4~6°
        </p>

        <Disclosure summary={<>궤적 분석 — 스피드 · 슬립</>}>
          <ShotChart sim={sim} />
        </Disclosure>

        <div className="mt-2 space-y-1.5">
          <Toggle
            label="3D 궤적 표시 (라인·마커만, 볼은 계속 재생)"
            checked={play.showPath}
            onChange={(v) => onPlayChange('showPath', v)}
          />
          <Button className="w-full" onClick={onTogglePlay}>
            {playing ? <IconPause size={13} /> : <IconPlay size={13} />}
            {playing ? '일시정지' : '재생'}
          </Button>
          <div className="flex items-center gap-2 px-1">
            <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">재생 속도</span>
            <Segmented
              size="sm"
              className="flex-1"
              options={[
                { id: '0.25', label: '0.25×' },
                { id: '0.5', label: '0.5×' },
                { id: '1', label: '1×' },
                { id: '2', label: '2×' },
              ]}
              value={String(playSpeed)}
              onChange={(v) => onPlaySpeedChange(parseFloat(v))}
            />
          </div>
          {/* Timeline scrubber: drag to inspect any point of the roll. */}
          <div className="rounded-lg bg-slate-50/80 px-1 pb-1 pt-0.5 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/10">
            <Slider
              label={scrubbing ? '타임라인 (스크럽 중)' : '타임라인'}
              value={scrubbing ? scrub : 0}
              min={0}
              max={1}
              step={0.005}
              fmt={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => onScrubChange(v)}
            />
            {scrubbing && (
              <button
                type="button"
                onClick={() => onScrubChange(null)}
                className="mx-1 mb-1 text-[11px] font-semibold text-blue-600 hover:underline dark:text-sky-300"
              >
                ▶ 라이브 재생으로 복귀
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="오일 트랜지션"
        action={
          play.shots > 0 ? (
            <button
              type="button"
              onClick={onResetTransition}
              className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 transition-colors hover:text-rose-500 hover:ring-rose-200 dark:text-slate-400 dark:ring-white/10 dark:hover:text-rose-300"
            >
              초기화
            </button>
          ) : null
        }
        hint="샷이 쌓일수록 헤드·미들 오일이 마르고(브레이크다운) 패턴 뒤로 오일이 밀려납니다(캐리다운). 실제 레인 모드에서 눈으로 보이고, 궤적·추천에 반영됩니다."
      >
        <Slider
          label="진행 샷 수"
          value={play.shots}
          min={0}
          max={60}
          step={1}
          suffix=" 구"
          onChange={(v) => onShotsChange(v)}
        />
        <p className="mt-1 px-1 text-[11px] text-slate-400 dark:text-slate-500">
          {play.shots === 0
            ? '프레시(갓 깐 오일) 상태입니다. 샷 수를 올리면 그때의 라인이 트랙으로 고정됩니다.'
            : `${play.shots}구 진행 — 트랜지션은 처음 적용한 라인 기준으로 고정됩니다. 스팟을 옮겨도 오일 표시는 그대로이고, 볼 반응만 바뀝니다. 다른 라인으로 다시 깔려면 초기화하세요.`}
        </p>
      </Section>

      <Section
        title="추천 라인"
        hint={
          recs.rule31 != null
            ? `Rule of 31: 패턴 길이 − 31 = 브레이크포인트 약 ${recs.rule31}보드 부근 권장`
            : undefined
        }
      >
        <Segmented
          className="mb-3"
          options={[
            { id: 'outside', label: `윗장 (바깥)${bestZone === 'outside' ? ' ·베스트' : ''}` },
            { id: 'inside', label: `아랫장 (안쪽)${bestZone === 'inside' ? ' ·베스트' : ''}` },
          ]}
          value={activeZone}
          onChange={setZone}
        />
        <RecommendCard
          title={activeZone === 'outside' ? '윗장' : '아랫장'}
          subtitle={activeZone === 'outside' ? '바깥쪽 · 1~2번 에로우' : '안쪽 · 3번 에로우 이상'}
          rec={activeRec}
          onApply={() => onApplyLine(activeRec)}
        />
        <p className="mt-3 px-1 text-[10px] leading-relaxed text-slate-400 dark:text-slate-600">
          오일 그리드 기반 휴리스틱 시뮬레이션입니다. 실제 레인 표면·볼 커버스톡 상태에 따라 달라질 수
          있으며, 추천은 포켓 적중률·진입각·미스 관용도를 종합해 선정합니다.
        </p>
      </Section>
    </div>
  );
}
