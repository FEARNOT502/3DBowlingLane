import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parsePassLine } from './parsePattern.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// IMPORTANT: Kegel/FLEX sheets render their pass tables (and the bar chart) as
// a rasterised IMAGE — only the header is real text. So we:
//   1. extract whatever text exists  -> metadata + tables (vector PDFs only)
//   2. render the page to an image   -> shown as an in-app reference
// When the tables are an image (the common case), the user converts them with
// the "AI 가져오기" flow (see lib/aiImport.js) — far more reliable than OCR.

function reconstructLines(items) {
  const rows = [];
  items.forEach((it) => {
    if (!it.str || !it.str.trim()) return;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 3.5);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x, s: it.str });
  });
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) =>
    r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim()
  );
}

function extractMeta(text, fileName) {
  const num = (re) => {
    const m = text.match(re);
    return m ? parseFloat(m[1]) : null;
  };
  const str = (re) => {
    const m = text.match(re);
    return m ? m[1].trim() : null;
  };
  const name = fileName.replace(/\.pdf$/i, '').trim() || '가져온 패턴';
  return {
    name,
    distance: num(/Oil Pattern Distance\s+([\d.]+)/i) ?? 40,
    reverseBrushDrop: num(/Reverse Brush Drop\s+([\d.]+)/i) ?? 0,
    oilPerBoard: num(/Oil Per Board\s+([\d.]+)/i) ?? 50,
    forwardTotal: num(/Forward Oil Total\s+([\d.]+)/i) ?? 0,
    reverseTotal: num(/Reverse Oil Total\s+([\d.]+)/i) ?? 0,
    volumeTotal: num(/Volume Oil Total\s+([\d.]+)/i) ?? 0,
    tankConfig: str(/Tank Configuration\s+([A-Za-z0-9/ ]+?)(?:\s{2,}|$)/i),
    tankAConditioner: str(/Tank A Conditioner\s+([A-Za-z0-9 ]+?)(?:\s{2,}|$)/i),
    tankBConditioner: str(/Tank B Conditioner\s+([A-Za-z0-9 ]+?)(?:\s{2,}|$)/i),
    cleanerMainMix: str(/Cleaner Ratio Main Mix\s+([\d:]+)/i),
    cleanerBackEndMix: str(/Cleaner Ratio Back End Mix\s+([\d:]+)/i),
    cleanerBackEndDistance: num(/Cleaner Ratio Back End Distance\s+([\d.]+)/i),
    bufferRpm: str(/Buffer RPM:\s*(.+?)(?:\s{2,}|$)/i),
    conditioner: 'Kegel',
    hasText: /Oil Pattern Distance/i.test(text),
  };
}

// Routes parseable pass rows into forward/reverse buckets by the sign of FEET.
export function extractTables(lines) {
  const fwd = [];
  const rev = [];
  lines.forEach((line) => {
    const pass = parsePassLine(line, 'forward');
    if (!pass) return;
    if (pass.startFt === 0 && pass.endFt === 0 && pass.feet === 0) {
      fwd.push(line.trim());
      return;
    }
    (pass.feet < 0 ? rev : fwd).push(line.trim());
  });
  return { forwardText: fwd.join('\n'), reverseText: rev.join('\n') };
}

const ZONE_RE = /\d+[LR]-\d+[LR]:\d+[LR]-\d+[LR]/g;
export function extractTrackZones(lines) {
  try {
    const itemLine = lines.find((l) => (l.match(ZONE_RE) || []).length >= 3);
    const ratioLine = lines.find((l) => /Track Zone Ratio/i.test(l));
    const descLine = lines.find((l) => /^Description/i.test(l));
    if (!itemLine || !ratioLine) return [];
    const items = itemLine.match(ZONE_RE) || [];
    const ratios = (ratioLine.replace(/Track Zone Ratio/i, '').match(/[\d.]+/g) || []).map(Number);
    const descs = descLine
      ? descLine.replace(/^Description/i, '').match(/[A-Za-z]+:[A-Za-z]+/g) || []
      : [];
    return items.map((item, i) => ({
      item,
      desc: descs[i] || '',
      ratio: ratios[i] != null ? ratios[i] : '-',
    }));
  } catch {
    return [];
  }
}

async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise;
  return canvas;
}

export async function importPatternFromPdf(file) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let lines = [];
  for (let p = 1; p <= pdf.numPages; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(p);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    lines = lines.concat(reconstructLines(content.items));
  }
  const fullText = lines.join('\n');
  const meta = extractMeta(fullText, file.name);
  const fromText = extractTables(lines);
  const trackZones = extractTrackZones(lines);

  // Render page 1 as a reference image (also handy to drop into an AI chat).
  const page1 = await pdf.getPage(1);
  const previewCanvas = await renderPageToCanvas(page1, 2.2);
  const pageImage = previewCanvas.toDataURL('image/png');

  return {
    meta,
    forwardText: fromText.forwardText,
    reverseText: fromText.reverseText,
    trackZones,
    pageImage,
    // true when the pass tables were already available as real text
    tablesFromText: Boolean(fromText.forwardText || fromText.reverseText),
  };
}
