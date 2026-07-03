import { parsePassTable, parsePassLine } from './parsePattern.js';

// ===========================================================================
// "AI 가져오기" — API 없이 사용자가 직접 변환
// ===========================================================================
// OCR(자동 글자 인식)은 숫자가 빽빽한 패턴 시트에서 오인식이 잦아 제거했습니다.
// 대신, 사용자가 패턴 이미지(FLEX/Kegel 시트)를 ChatGPT·Claude 같은 멀티모달
// AI에 직접 올려 "정해진 텍스트 형식"으로 받아오게 합니다. 앱은 그 텍스트를
// 붙여넣으면 파싱해 패턴으로 불러옵니다. (외부 API 호출 없음 → 키 불필요)
// ===========================================================================

// 사용자가 복사해 AI에 붙여넣는 프롬프트. 출력 형식을 엄격히 지정해 파서가
// 안정적으로 읽을 수 있게 합니다.
export const AI_PROMPT = `너는 볼링 레인 오일 패턴 시트(FLEX/Kegel 형식)를 읽는 분석기야.
첨부한 패턴 이미지를 보고 아래 "출력 형식"에 **정확히** 맞춰서만 답해줘.
설명·인사말·코드블록(\`\`\`) 없이, 형식 그대로 텍스트만 출력해.
시트에 있는 모든 값을 빠짐없이 옮겨 적어. 해당 항목이 시트에 없으면 그 줄은 비워둬.

[표 읽는 법]
- 위쪽 큰 표 = Forward(전진) Pass, 아래쪽 큰 표 = Reverse(복귀) Pass.
- 각 행 열 순서: START STOP LOADS SPEED BUFFER [TANK] CROSSED START END FEET T.OIL
  · START/STOP : 보드 표기(예 4L, 4R, 20). 행 맨 앞 번호(1,2,3…)는 빼고 적어.
  · TANK 열(A/B)이 시트에 없으면 생략해.
  · 숫자는 시트에 적힌 그대로(소수점·음수 0 포함) — 한 칸도 빼지 마.
- Track Zone Ratio 표가 있으면 ZONE | 설명 | 비율 형태로 옮겨.
- 상단/중단의 메타 값(거리, 브러시, 토탈, 탱크, 클리너 비율 등)도 모두 옮겨.

[출력 형식]
=== PATTERN ===
NAME: <패턴 이름>
DISTANCE: <Oil Pattern Distance 숫자만, ft>
REVERSE_BRUSH_DROP: <Reverse Brush Drop>
OIL_PER_BOARD: <Oil Per Board, ul>
FORWARD_TOTAL: <Forward Oil Total, mL>
REVERSE_TOTAL: <Reverse Oil Total, mL>
VOLUME: <Volume Oil Total, mL>
TANK_CONFIG: <Tank Configuration>
TANK_A_CONDITIONER: <Tank A Conditioner>
TANK_B_CONDITIONER: <Tank B Conditioner>
CLEANER_MAIN_MIX: <Cleaner Ratio Main Mix>
CLEANER_BACKEND_MIX: <Cleaner Ratio Back End Mix>
CLEANER_BACKEND_DISTANCE: <Cleaner Ratio Back End Distance>
BUFFER_RPM: <Buffer RPM 설명 그대로>

=== FORWARD ===
<Forward 표의 각 행을 한 줄씩>

=== REVERSE ===
<Reverse 표의 각 행을 한 줄씩>

=== TRACK ===
<ZONE | 설명 | 비율  형태로 한 줄씩, 없으면 이 섹션 통째로 생략>

[예시]
=== PATTERN ===
NAME: 2026 JINSEUNG A TYPE
DISTANCE: 45
REVERSE_BRUSH_DROP: 38
OIL_PER_BOARD: 50
FORWARD_TOTAL: 19.05
REVERSE_TOTAL: 10.45
VOLUME: 29.5
TANK_CONFIG: N/A
TANK_A_CONDITIONER: KEGEL
TANK_B_CONDITIONER: KEGEL
CLEANER_MAIN_MIX: 5:1
CLEANER_BACKEND_MIX: 5:1
CLEANER_BACKEND_DISTANCE: 59
BUFFER_RPM: 4=700 | 3=500 | 2=200 | 1=100

=== FORWARD ===
4L 4R 3 14 3 A 99 0.0 3.9 3.9 4950
7L 6R 3 18 3 A 84 3.9 11.5 7.6 4200
9L 8R 4 18 3 A 96 11.5 21.7 10.2 4800
10L 10R 2 22 3 A 42 21.7 27.9 6.2 2100
12L 11R 2 26 3 A 36 27.9 35.2 7.3 1800
14L 15R 2 26 3 A 24 35.2 42.5 7.3 1200
2L 2R 0 26 3 A 0 42.5 45.0 2.5 0

=== REVERSE ===
2L 2R 0 22 3 A 0 45.0 38.0 -7.0 0
13L 13R 4 22 3 A 60 38.0 25.6 -12.4 3000
11L 11R 3 22 3 A 57 25.6 16.3 -9.3 2850
10L 9R 2 22 3 A 44 16.3 10.1 -6.2 2200
9L 8R 2 18 3 A 48 10.1 5.0 -5.1 2400
2L 2R 0 14 3 A 0 5.0 0.0 -5.0 0

=== TRACK ===
3L-7L:18L-18R | Outside:Middle | 9
8L-12L:18L-18R | Middle:Middle | 1.82`;

const SECTION_RE = /^===\s*(PATTERN|FORWARD|REVERSE|TRACK)\s*===\s*$/i;

// 텍스트를 섹션별로 쪼갠다. 섹션 헤더가 전혀 없으면 빈 객체 반환(폴백 처리).
function splitSections(text) {
  const out = {};
  let current = null;
  String(text)
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(SECTION_RE);
      if (m) {
        current = m[1].toUpperCase();
        out[current] = [];
        return;
      }
      if (current) out[current].push(line);
    });
  return out;
}

// Maps the PATTERN section keys to meta fields. `num` keys are parsed as floats;
// everything else is kept as the raw string (Tank config, conditioners, cleaner
// ratios like "5:1", the Buffer RPM legend, ...). Blank values are skipped so a
// left-empty line never overwrites a sample default with "".
const META_NUM = {
  DISTANCE: 'distance',
  REVERSE_BRUSH_DROP: 'reverseBrushDrop',
  OIL_PER_BOARD: 'oilPerBoard',
  FORWARD_TOTAL: 'forwardTotal',
  REVERSE_TOTAL: 'reverseTotal',
  VOLUME: 'volumeTotal',
  CLEANER_BACKEND_DISTANCE: 'cleanerBackEndDistance',
};
const META_STR = {
  NAME: 'name',
  TANK_CONFIG: 'tankConfig',
  TANK_A_CONDITIONER: 'tankAConditioner',
  TANK_B_CONDITIONER: 'tankBConditioner',
  CLEANER_MAIN_MIX: 'cleanerMainMix',
  CLEANER_BACKEND_MIX: 'cleanerBackEndMix',
  BUFFER_RPM: 'bufferRpm',
};

function parseMetaBlock(lines = []) {
  const meta = {};
  lines.forEach((line) => {
    const m = line.match(/^\s*([A-Z_]+)\s*[:=]\s*(.*)$/i);
    if (!m) return;
    const key = m[1].toUpperCase();
    const val = m[2].trim();
    if (val === '' || /^<.*>$/.test(val)) return; // skip blanks / unfilled placeholders
    if (META_NUM[key]) meta[META_NUM[key]] = parseFloat(val) || 0;
    else if (META_STR[key]) meta[META_STR[key]] = val;
  });
  return meta;
}

function parseTrackBlock(lines = []) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('|').map((s) => s.trim());
      if (!parts[0]) return null;
      return {
        item: parts[0],
        desc: parts[1] || '',
        ratio: parts[2] != null && parts[2] !== '' ? parts[2] : '-',
      };
    })
    .filter(Boolean);
}

// 섹션 헤더가 없을 때의 폴백: 줄마다 pass 파싱을 시도해 FEET 부호로 분배.
function fallbackSplitPasses(text) {
  const fwd = [];
  const rev = [];
  String(text)
    .split(/\r?\n/)
    .forEach((line) => {
      const pass = parsePassLine(line, 'forward');
      if (!pass) return;
      (pass.feet < 0 ? rev : fwd).push(line.trim());
    });
  return { forwardText: fwd.join('\n'), reverseText: rev.join('\n') };
}

// AI(또는 사용자가 직접 정리한) 텍스트를 파싱해 패턴 데이터로 변환.
// 반환: { meta, forwardText, reverseText, trackZones, forwardCount, reverseCount }
export function parseAiImport(text) {
  if (!text || !text.trim()) {
    throw new Error('붙여넣은 내용이 비어 있습니다.');
  }

  const sections = splitSections(text);
  const hasSections = Object.keys(sections).length > 0;

  const meta = hasSections ? parseMetaBlock(sections.PATTERN) : {};
  let forwardText;
  let reverseText;

  if (hasSections && (sections.FORWARD || sections.REVERSE)) {
    forwardText = (sections.FORWARD || [])
      .map((l) => l.trim())
      .filter((l) => l && parsePassLine(l, 'forward'))
      .join('\n');
    reverseText = (sections.REVERSE || [])
      .map((l) => l.trim())
      .filter((l) => l && parsePassLine(l, 'reverse'))
      .join('\n');
  } else {
    // 헤더 없이 표만 붙여넣은 경우도 받아준다.
    const fb = fallbackSplitPasses(text);
    forwardText = fb.forwardText;
    reverseText = fb.reverseText;
  }

  const forwardCount = parsePassTable(forwardText, 'forward').length;
  const reverseCount = parsePassTable(reverseText, 'reverse').length;

  if (forwardCount + reverseCount === 0) {
    throw new Error(
      '패턴 행을 하나도 인식하지 못했습니다. 형식(=== FORWARD === 아래 표 행)을 확인하세요.'
    );
  }

  const trackZones = hasSections ? parseTrackBlock(sections.TRACK) : [];

  return {
    meta: {
      name: meta.name || 'AI 가져온 패턴',
      distance: meta.distance || 40,
      oilPerBoard: meta.oilPerBoard || 50,
      conditioner: 'Kegel',
      ...meta,
    },
    forwardText,
    reverseText,
    trackZones,
    forwardCount,
    reverseCount,
  };
}
