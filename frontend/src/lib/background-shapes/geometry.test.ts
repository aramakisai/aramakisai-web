import { describe, expect, it } from 'vitest';
import {
  bboxOf,
  bboxRadius,
  boundsOk,
  collisionOk,
  gutterCount,
  infBbox,
  infRadius,
  pad,
  sampleInf,
  sampleShape,
  validInf,
  validL,
  validS,
} from './geometry';

// 期待値は参照実装 place.py の同名関数を直接呼んで得た実測値 (40x40 格子標本化の近似誤差込み)。
describe('sampleShape + bboxOf: 図形の局所形状と回転を place.py と同じ格子標本化で再現する', () => {
  it.each([
    [
      'circle',
      {
        x: 0.2363885844308058,
        y: 0.2363885844308058,
        w: 99.52722283113837,
        h: 99.52722283113837,
      },
    ],
    [
      'triangle',
      {
        x: -16.593738434491385,
        y: 9.321325074969707,
        w: 90.80127018922192,
        h: 107.27241335952168,
      },
    ],
    [
      'square',
      {
        x: -16.593738434491385,
        y: -16.593738434491385,
        w: 133.18747686898277,
        h: 133.18747686898277,
      },
    ],
    [
      'roundedSquare',
      {
        x: -10.678674925030293,
        y: -10.678674925030293,
        w: 121.35734985006059,
        h: 121.35734985006059,
      },
    ],
    [
      'quarterCircle',
      {
        x: -16.593738434491385,
        y: -16.593738434491385,
        w: 133.18747686898277,
        h: 97.69709581221619,
      },
    ],
    [
      'semicircle',
      {
        x: 0.2363885844308058,
        y: 26.707531754730546,
        w: 91.35734985006059,
        h: 73.05607966083863,
      },
    ],
  ] as const)('%s (s=100, rot=30, cx=50, cy=50)', (kind, expected) => {
    const { px, py } = sampleShape(kind, 100, 30, 50, 50);
    const bbox = bboxOf(px, py);
    expect(bbox.x).toBeCloseTo(expected.x, 6);
    expect(bbox.y).toBeCloseTo(expected.y, 6);
    expect(bbox.w).toBeCloseTo(expected.w, 6);
    expect(bbox.h).toBeCloseTo(expected.h, 6);
  });
});

describe('sampleInf: ∞ (二重輪) の局所形状', () => {
  it('D=140, rot=15, cx=200, cy=300 の外接矩形が place.py と一致する', () => {
    const { px, py } = sampleInf(140, 15, 200, 300);
    const bbox = bboxOf(px, py);
    expect(bbox.x).toBeCloseTo(80.30921188081818, 6);
    expect(bbox.y).toBeCloseTo(217.5253785166904, 6);
    expect(bbox.w).toBeCloseTo(239.38157623836366, 6);
    expect(bbox.h).toBeCloseTo(164.94924296661918, 6);
  });

  it('inf_bbox/inf_radius が place.py と一致する', () => {
    const [w, h] = infBbox(140);
    expect(w).toBeCloseTo(0.74 * 140 + 140, 10);
    expect(h).toBe(140);
    expect(infRadius(140)).toBeCloseTo(140.48216968711722, 10);
  });
});

describe('bboxRadius: 回転外接円半径', () => {
  it('s=100 → s*sqrt(2)/2', () => {
    expect(bboxRadius(100)).toBeCloseTo(70.71067811865476, 10);
  });
});

describe('boundsOk: 除外領域・はみ出し判定', () => {
  it('縦方向・横方向とも収まる配置は true', () => {
    const { px, py } = sampleShape('circle', 100, 0, 500, 500);
    expect(boundsOk(px, py, 1000, 400, 900, 0.4, 100)).toBe(true);
  });

  it('左へのはみ出しが許容量 (0.4*s=40) を超えると false (cx=-40)', () => {
    const { px, py } = sampleShape('circle', 100, 0, -40, 500);
    expect(boundsOk(px, py, 1000, 400, 900, 0.4, 100)).toBe(false);
  });

  it('さらに大きくはみ出すと false (cx=-60)', () => {
    const { px, py } = sampleShape('circle', 100, 0, -60, 500);
    expect(boundsOk(px, py, 1000, 400, 900, 0.4, 100)).toBe(false);
  });
});

describe('collisionOk: 回転外接円どうしのガター (24px 以上) 判定', () => {
  it('十分離れていれば true', () => {
    expect(collisionOk(0, 0, 50, [{ cx: 200, cy: 0, r: 50 }], 24)).toBe(true);
  });
  it('間隔が gap 未満なら false', () => {
    expect(collisionOk(0, 0, 50, [{ cx: 110, cy: 0, r: 50 }], 24)).toBe(false);
  });
});

describe('gutterCount: 図形の外接矩形と交差する不透明な面の数', () => {
  it('交差する矩形だけを数える', () => {
    const bb = { x: 0, y: 0, w: 100, h: 100 };
    const opaque = [
      { x: 50, y: 50, w: 10, h: 10 },
      { x: 1000, y: 1000, w: 10, h: 10 },
      { x: -5, y: -5, w: 10, h: 10 },
    ];
    expect(gutterCount(bb, opaque)).toBe(2);
  });
});

describe('validL / validS / validInf: 面判定の合成', () => {
  const textRaw = [{ x: 400, y: 400, w: 200, h: 200 }];
  const textPad = pad(textRaw, 10);
  const noOverlapRaw = [{ x: 800, y: 400, w: 50, h: 50 }];
  const noOverlapPad = pad(noOverlapRaw, 10);
  const opaque = [{ x: 600, y: 600, w: 200, h: 200 }];

  it('validL: 障害物と重ならなければ true', () => {
    const { px, py } = sampleShape('square', 150, 0, 200, 500);
    expect(
      validL(px, py, 1000, 300, 900, noOverlapPad, textRaw, opaque, 150),
    ).toBe(true);
  });

  it('validL: 黒文字との重なりが面積比 25% を超えると false', () => {
    const { px, py } = sampleShape('square', 150, 0, 500, 500);
    expect(
      validL(px, py, 1000, 300, 900, noOverlapPad, textRaw, opaque, 150),
    ).toBe(false);
  });

  it('validS: 障害物と重ならなければ true', () => {
    const { px, py } = sampleShape('circle', 80, 0, 200, 500);
    expect(
      validS(
        px,
        py,
        1000,
        300,
        900,
        noOverlapPad,
        textPad,
        opaque,
        80,
        0.0,
        'hard',
      ),
    ).toBe(true);
  });

  it("validS: opaqueMode='hard' で不透明な面に重なると false", () => {
    const { px, py } = sampleShape('circle', 80, 0, 700, 700);
    expect(
      validS(
        px,
        py,
        1000,
        300,
        900,
        noOverlapPad,
        textPad,
        opaque,
        80,
        0.0,
        'hard',
      ),
    ).toBe(false);
  });

  it('validInf: 障害物と重ならなければ true', () => {
    const { px, py } = sampleInf(120, 0, 200, 500);
    expect(
      validInf(
        px,
        py,
        1000,
        300,
        900,
        noOverlapPad,
        textPad,
        opaque,
        120,
        'hard',
      ),
    ).toBe(true);
  });

  it('validInf: noOverlap (+10px) と重なると false', () => {
    const { px, py } = sampleInf(120, 0, 820, 420);
    expect(
      validInf(
        px,
        py,
        1000,
        300,
        900,
        noOverlapPad,
        textPad,
        opaque,
        120,
        'hard',
      ),
    ).toBe(false);
  });
});
