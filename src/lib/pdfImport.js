import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parsePassLine } from './parsePattern.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// IMPORTANT: Kegel/FLEX sheets render their pass tables (and the bar chart) as
// a rasterised IMAGE — only the header is real text. So we:
//   1. extract whatever text exists  -> metadata (distance, totals, ...)
//   2. render the page to an image   -> shown as an in-app reference
//   3. optionally OCR that image     -> best-effort table auto-fill (review!)

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
  const name = fileName.replace(/\.pdf$/i, '').trim() || '가져온 패턴';
  return {
    name,
    distance: num(/Oil Pattern Distance\s+([\d.]+)/i) ?? 40,
    reverseBrushDrop: num(/Reverse Brush Drop\s+([\d.]+)/i) ?? 0,
    oilPerBoard: num(/Oil Per Board\s+([\d.]+)/i) ?? 50,
    forwardTotal: num(/Forward Oil Total\s+([\d.]+)/i) ?? 0,
    reverseTotal: num(/Reverse Oil Total\s+([\d.]+)/i) ?? 0,
    volumeTotal: num(/Volume Oil Total\s+([\d.]+)/i) ?? 0,
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

  // Render page 1 as a reference image (and OCR source). A higher scale gives
  // OCR real glyph detail to work with instead of an upscaled blur.
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

// Upscales and binarises the sheet image before OCR. The pass tables are small,
// dense, mostly-numeric rows; Tesseract reads them far more reliably from a
// high-contrast black-on-white bitmap than from the raw colour render (which
// also carries the blue heatmap and the bar chart).
function preprocessForOcr(pageImage) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Upscale small sheets so glyphs are tall enough for OCR (~2x, capped).
      const scale = Math.min(2.5, Math.max(1, 2200 / img.width));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = imgData.data;
      for (let i = 0; i < px.length; i += 4) {
        // Luminance, then a hard threshold to pure black / white. Coloured
        // overlays (blue oil, cyan/blue bars) fall on the dark side and become
        // black blobs that the line filter discards — the numbers stay crisp.
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const v = lum > 165 ? 255 : 0;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
        px[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = pageImage;
  });
}

// Best-effort OCR of the sheet image to recover the pass tables. Lazy-loads
// tesseract.js so it only downloads when the user opts in.
export async function ocrPatternTables(pageImage, onProgress) {
  const { createWorker, PSM } = await import('tesseract.js');
  const source = await preprocessForOcr(pageImage);
  const worker = await createWorker('eng', undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
    },
  });
  try {
    // The pass rows only contain digits, the board-side letters L/R/C, the tank
    // letter A/B, dots and minus signs. Whitelisting them keeps Tesseract from
    // "creatively" turning numbers into prose, and treating the sheet as a
    // uniform block (PSM 6) preserves the row structure.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM ? PSM.SINGLE_BLOCK : '6',
      tessedit_char_whitelist: '0123456789LRCAB.- ',
      preserve_interword_spaces: '1',
    });
    const { data } = await worker.recognize(source);
    const lines = data.text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const { forwardText, reverseText } = extractTables(lines);
    const trackZones = extractTrackZones(lines);
    return { forwardText, reverseText, trackZones };
  } finally {
    await worker.terminate();
  }
}
