import React, { useRef, useState } from 'react';
import { Section, Card, Button, Stat, MetaList, CopyButton, Disclosure, ErrorNote } from '../ui.jsx';
import { IconSparkle, IconFile, IconLoader, IconX } from '../icons.jsx';
import { AI_PROMPT } from '../../lib/aiImport.js';

function StepBadge({ n }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 font-mono text-[10px] font-bold text-blue-600 dark:bg-sky-500/15 dark:text-sky-300">
      {n}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AI import — user converts the sheet image with ChatGPT/Claude (no API)
// ---------------------------------------------------------------------------

function AiImport({ aiText, onAiTextChange, onAiImport, aiError }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-sky-50 to-indigo-50 px-3 py-2.5 dark:border-white/10 dark:from-sky-500/10 dark:to-indigo-500/10">
        <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-sky-300">
          <IconSparkle size={13} /> AI로 패턴 가져오기
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          OCR보다 정확합니다. 아래 프롬프트를 복사해 ChatGPT·Claude에 <b>패턴 이미지와 함께</b>{' '}
          붙여넣고, 받은 결과를 다시 여기에 붙여넣으세요. (API 키 불필요)
        </p>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        <div className="flex items-center gap-2">
          <StepBadge n={1} />
          <CopyButton text={AI_PROMPT} className="flex-1">
            변환 프롬프트 복사
          </CopyButton>
        </div>

        <div className="flex items-start gap-2">
          <span className="mt-1.5">
            <StepBadge n={2} />
          </span>
          <div className="flex-1">
            <p className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              AI가 준 텍스트를 붙여넣으세요
            </p>
            <textarea
              value={aiText}
              onChange={(e) => onAiTextChange(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder={'=== PATTERN ===\nNAME: ...\n\n=== FORWARD ===\n4L 4R 3 14 3 A 99 0.0 3.9 3.9 4950'}
              className="w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-[10px] leading-snug text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200 dark:placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StepBadge n={3} />
          <Button onClick={onAiImport} disabled={!aiText.trim()} className="flex-1">
            패턴으로 불러오기
          </Button>
        </div>

        <ErrorNote>{aiError}</ErrorNote>
      </div>
    </Card>
  );
}

function PdfDrop({ onImportPdf, importing, importError }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleFiles = (files) => {
    const f = files && files[0];
    if (!f) return;
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) onImportPdf(f);
  };

  return (
    <div>
      {/* input kept OUTSIDE the trigger so we never nest interactive content */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center outline-none transition-colors ${
          drag
            ? 'border-sky-500 bg-sky-50 dark:bg-sky-400/10'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 focus:border-sky-500 dark:border-slate-600 dark:bg-white/[0.02] dark:hover:border-slate-500'
        }`}
      >
        <span className="text-slate-400 dark:text-slate-500">
          {importing ? <IconLoader size={22} /> : <IconFile size={22} />}
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {importing ? 'PDF 분석 중…' : 'PDF 패턴 시트 업로드'}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          끌어다 놓거나 클릭하여 선택
        </span>
      </div>
      {importError && (
        <div className="mt-2">
          <ErrorNote>{importError}</ErrorNote>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 패턴 tab — import sources, sample/saved pattern lists, sheet metadata.
// ---------------------------------------------------------------------------

export default function PatternTab({
  patterns,
  activeId,
  onLoadSample,
  savedPatterns,
  onLoadSaved,
  onDeleteSaved,
  onImportPdf,
  importing,
  importError,
  pageImage,
  importInfo,
  aiText,
  onAiTextChange,
  onAiImport,
  aiError,
  meta,
  onDistanceChange,
  totals,
}) {
  return (
    <div className="pb-4">
      <Section title="패턴 불러오기">
        <div className="space-y-3">
          <AiImport
            aiText={aiText}
            onAiTextChange={onAiTextChange}
            onAiImport={onAiImport}
            aiError={aiError}
          />

          <Disclosure summary={<>PDF에서 가져오기</>}>
            <PdfDrop onImportPdf={onImportPdf} importing={importing} importError={importError} />
            {pageImage && (
              <div className="mt-3 space-y-2">
                {importInfo && !importInfo.tablesFromText && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200/90">
                    표가 <b>이미지</b>로 저장된 시트입니다. 위의 <b>AI로 가져오기</b>에 이 이미지를
                    올려 변환하세요.
                  </p>
                )}
                <details className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/30">
                  <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    원본 시트 미리보기
                  </summary>
                  <img src={pageImage} alt="업로드한 패턴 시트" className="w-full" />
                </details>
              </div>
            )}
          </Disclosure>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            샘플 패턴
          </p>
          <div className="flex flex-wrap gap-1.5">
            {patterns.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onLoadSample(p.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.98] ${
                  activeId === p.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25 dark:bg-sky-500'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:border-sky-400/50'
                }`}
              >
                {p.name}
              </button>
            ))}
            {(activeId === 'pdf' || activeId === 'custom') && (
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                {activeId === 'pdf' ? 'PDF 가져옴' : '직접 편집'}
              </span>
            )}
          </div>
        </div>

        {savedPatterns && savedPatterns.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
              내 패턴
            </p>
            <div className="flex flex-col gap-1.5">
              {savedPatterns.map((p) => (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                    activeId === p.id
                      ? 'border-blue-400 bg-blue-50/70 dark:border-sky-400/50 dark:bg-sky-500/10'
                      : 'border-slate-200 bg-white hover:border-blue-300 dark:border-white/10 dark:bg-transparent dark:hover:border-sky-400/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onLoadSaved(p.id)}
                    className="flex-1 truncate text-left font-medium text-slate-700 dark:text-slate-200"
                    title={p.name}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSaved(p.id)}
                    aria-label="삭제"
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:text-slate-500 dark:hover:bg-rose-500/20 dark:hover:text-rose-300"
                  >
                    <IconX size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="패턴 정보">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-xs text-slate-600 dark:text-slate-300" htmlFor="distance">
            Oil Pattern Distance
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id="distance"
              type="number"
              min={0}
              value={meta.distance}
              onChange={(e) => {
                const v = e.target.value;
                onDistanceChange(v === '' ? 0 : parseFloat(v) || 0);
              }}
              className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-sm tabular-nums text-slate-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-slate-800 dark:text-sky-200"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">ft</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Volume" value={totals.combinedMl.toFixed(1)} sub="mL" />
          <Stat label="Forward" value={totals.forwardMl.toFixed(1)} sub="mL" accent="#0891b2" />
          <Stat label="Reverse" value={totals.reverseMl.toFixed(1)} sub="mL" accent="#2563eb" />
        </div>

        <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          시트 전체 값
        </p>
        <MetaList
          rows={[
            { label: 'Oil Pattern Distance', value: meta.distance, suffix: 'ft' },
            { label: 'Reverse Brush Drop', value: meta.reverseBrushDrop },
            { label: 'Oil Per Board', value: meta.oilPerBoard, suffix: 'µl' },
            { label: 'Forward Oil Total', value: meta.forwardTotal, suffix: 'mL' },
            { label: 'Reverse Oil Total', value: meta.reverseTotal, suffix: 'mL' },
            { label: 'Volume Oil Total', value: meta.volumeTotal, suffix: 'mL' },
            { label: 'Tank Configuration', value: meta.tankConfig },
            { label: 'Tank A Conditioner', value: meta.tankAConditioner },
            { label: 'Tank B Conditioner', value: meta.tankBConditioner },
            { label: 'Cleaner Main Mix', value: meta.cleanerMainMix },
            { label: 'Cleaner Back End Mix', value: meta.cleanerBackEndMix },
            { label: 'Back End Distance', value: meta.cleanerBackEndDistance },
            { label: 'Buffer RPM', value: meta.bufferRpm },
          ]}
        />
      </Section>
    </div>
  );
}
