import { useState, useCallback } from 'react';
import { SAMPLE_PATTERNS, JINSEUNG_A } from '../data/samplePatterns.js';
import { parsePassTable } from '../lib/parsePattern.js';
import { importPatternFromPdf } from '../lib/pdfImport.js';
import { parseAiImport } from '../lib/aiImport.js';
import { loadSavedPatterns, savePattern, deletePattern } from '../lib/storage.js';

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

// Pattern loading & import: sample/saved selection, raw text editing, PDF and
// AI-text import, plus localStorage persistence for "내 패턴".
export default function usePatternSource() {
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

  // Shared "make this the active pattern" step used by every load path.
  const applyPattern = useCallback((next) => {
    setActiveId(next.id);
    setMeta(next.meta);
    setTrackZones(next.trackZones);
    setForwardText(next.forwardText);
    setReverseText(next.reverseText);
    setApplied(parseTexts(next.forwardText, next.reverseText));
    setPageImage(next.pageImage ?? null);
    setImportInfo(next.importInfo ?? null);
  }, []);

  const loadSample = useCallback(
    (id) => {
      const p = SAMPLE_PATTERNS.find((s) => s.id === id);
      if (!p) return;
      setImportError(null);
      applyPattern({
        id,
        meta: { ...p.meta, name: p.name },
        trackZones: p.trackZones,
        forwardText: p.forwardText,
        reverseText: p.reverseText,
      });
    },
    [applyPattern]
  );

  const onApply = useCallback(() => {
    setActiveId('custom');
    setApplied(parseTexts(forwardText, reverseText));
  }, [forwardText, reverseText]);

  const onDistanceChange = useCallback((distance) => {
    setMeta((m) => ({ ...m, distance }));
  }, []);

  const onImportPdf = useCallback(
    async (file) => {
      if (!file) return;
      setImporting(true);
      setImportError(null);
      try {
        const res = await importPatternFromPdf(file);
        applyPattern({
          id: 'pdf',
          meta: { ...res.meta },
          trackZones: res.trackZones || [],
          forwardText: res.forwardText,
          reverseText: res.reverseText,
          pageImage: res.pageImage,
          importInfo: { tablesFromText: res.tablesFromText, hasText: res.meta.hasText },
        });
      } catch (e) {
        setImportError(e?.message || 'PDF 분석에 실패했습니다.');
      } finally {
        setImporting(false);
      }
    },
    [applyPattern]
  );

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
      applyPattern({
        id: entry.id,
        meta: { ...res.meta },
        trackZones: res.trackZones || [],
        forwardText: res.forwardText,
        reverseText: res.reverseText,
      });
      setAiText('');
    } catch (e) {
      setAiError(e?.message || 'AI 텍스트를 인식하지 못했습니다.');
    }
  }, [aiText, applyPattern]);

  const onLoadSaved = useCallback(
    (id) => {
      const p = saved.find((s) => s.id === id);
      if (!p) return;
      setImportError(null);
      applyPattern({
        id,
        meta: { ...p.meta, name: p.name },
        trackZones: p.trackZones || [],
        forwardText: p.forwardText,
        reverseText: p.reverseText,
      });
    },
    [saved, applyPattern]
  );

  const onDeleteSaved = useCallback((id) => {
    setSaved(deletePattern(id));
    setActiveId((cur) => (cur === id ? 'custom' : cur));
  }, []);

  return {
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
  };
}
