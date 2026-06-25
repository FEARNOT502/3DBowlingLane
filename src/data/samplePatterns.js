// The two reference sheets shipped with the app, encoded as the raw table text
// the parser expects plus the header metadata read off each sheet.

export const KBA_40 = {
  id: 'kba-40',
  name: '2026 KBA 40',
  meta: {
    distance: 40,
    reverseBrushDrop: 36,
    oilPerBoard: 50,
    forwardTotal: 18.3,
    reverseTotal: 9.8,
    volumeTotal: 28.1,
    tankConfig: 'A Only',
    conditioner: 'Kegel',
  },
  forwardText: `1  2L   2R   2  14  3   74   0.0   1.9   1.9  3700
2  4L   3R   2  18  3   68   1.9   7.0   5.1  3400
3  7L   6R   2  18  3   56   7.0  12.1   5.1  2800
4  7L   7R   3  18  3   81  12.1  19.7   7.6  4050
5  11L  11R  3  18  3   57  19.7  27.3   7.6  2850
6  13L  13R  2  22  3   30  27.3  33.5   6.2  1500
7  2L   2R   0  22  3    0  33.5  36.0   2.5     0
8  2L   2R   0  26  3    0  36.0  40.0   4.0     0`,
  reverseText: `1  2L   2R   0  30  3    0  40.0  28.0  -12.0    0
2  14L  12R  3  18  3   45  28.0  20.4   -7.6  2250
3  12L  11R  3  18  3   54  20.4  12.8   -7.6  2700
4  10L  8R   3  18  3   69  12.8   5.2   -7.6  3450
5  6L   7R   1  14  3   28   5.2   3.3   -1.9  1400
6  2L   2R   0  14  3    0   3.3   0.0   -3.3     0`,
  trackZones: [
    { item: '3L-7L:18L-18R', desc: 'Outside:Middle', ratio: 4.8 },
    { item: '8L-12L:18L-18R', desc: 'Middle:Middle', ratio: 1.76 },
    { item: '13L-17L:18L-18R', desc: 'Inside:Middle', ratio: 1.03 },
    { item: '18L-18R:17R-13R', desc: 'Middle:Inside', ratio: 1 },
    { item: '18L-18R:12R-8R', desc: 'Middle:Middle', ratio: 1.5 },
    { item: '18L-18R:7R-3R', desc: 'Middle:Outside', ratio: 4.29 },
  ],
};

export const JINSEUNG_A = {
  id: 'jinseung-a',
  name: '2026 JINSEUNG A TYPE',
  meta: {
    distance: 45,
    reverseBrushDrop: 38,
    oilPerBoard: 50,
    forwardTotal: 19.05,
    reverseTotal: 10.45,
    volumeTotal: 29.5,
    tankConfig: 'N/A',
    conditioner: 'Kegel',
  },
  forwardText: `1  4L   4R   3  14  3  A   99   0.0   3.9   3.9  4950
2  7L   6R   3  18  3  A   84   3.9  11.5   7.6  4200
3  9L   8R   4  18  3  A   96  11.5  21.7  10.2  4800
4  10L  10R  2  22  3  A   42  21.7  27.9   6.2  2100
5  12L  11R  2  26  3  A   36  27.9  35.2   7.3  1800
6  14L  15R  2  26  3  A   24  35.2  42.5   7.3  1200
7  2L   2R   0  26  3  A    0  42.5  45.0   2.5     0`,
  reverseText: `1  2L   2R   0  22  3  A    0  45.0  38.0   -7.0     0
2  13L  13R  4  22  3  A   60  38.0  25.6  -12.4  3000
3  11L  11R  3  22  3  A   57  25.6  16.3   -9.3  2850
4  10L  9R   2  22  3  A   44  16.3  10.1   -6.2  2200
5  9L   8R   2  18  3  A   48  10.1   5.0   -5.1  2400
6  2L   2R   0  14  3  A    0   5.0   0.0   -5.0     0`,
  trackZones: [
    { item: '3L-7L:18L-18R', desc: 'Outside:Middle', ratio: 9 },
    { item: '8L-12L:18L-18R', desc: 'Middle:Middle', ratio: 1.82 },
    { item: '13L-17L:18L-18R', desc: 'Inside:Middle', ratio: 1.02 },
    { item: '18L-18R:17R-13R', desc: 'Middle:Inside', ratio: 1.03 },
    { item: '18L-18R:12R-8R', desc: 'Middle:Middle', ratio: 1.61 },
    { item: '18L-18R:7R-3R', desc: 'Middle:Outside', ratio: 7.5 },
  ],
};

export const SAMPLE_PATTERNS = [KBA_40, JINSEUNG_A];
