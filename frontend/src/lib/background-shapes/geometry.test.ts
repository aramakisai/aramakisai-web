import { describe, expect, it } from 'vitest';
import {
  bboxRadius,
  circleIntersectsRect,
  collisionOk,
  infBbox,
  infRadius,
  shapeFits,
} from './geometry';

describe('bboxRadius: 回転外接円半径', () => {
  it('s=100 → s*sqrt(2)/2', () => {
    expect(bboxRadius(100)).toBeCloseTo(70.71067811865476, 10);
  });
});

describe('infBbox / infRadius: ∞ の外接矩形と外接円半径', () => {
  it('D=140 の外接矩形・外接円半径', () => {
    const [w, h] = infBbox(140);
    expect(w).toBeCloseTo(0.74 * 140 + 140, 10);
    expect(h).toBe(140);
    expect(infRadius(140)).toBeCloseTo(0.5 * Math.hypot(w, h), 10);
  });
});

describe('circleIntersectsRect: 円と矩形の最短距離による交差判定', () => {
  const rect = { x: 100, y: 100, w: 50, h: 50 };

  it('矩形の内部に中心があれば true', () => {
    expect(circleIntersectsRect(120, 120, 5, rect)).toBe(true);
  });

  it('矩形の角からの最短距離が半径以内なら true', () => {
    // 角 (100,100) からの距離 = sqrt(2)*10 ≈ 14.14
    expect(circleIntersectsRect(90, 90, 15, rect)).toBe(true);
  });

  it('矩形の角からの最短距離が半径を超えると false', () => {
    expect(circleIntersectsRect(90, 90, 10, rect)).toBe(false);
  });

  it('辺からの最短距離が半径ちょうどなら true (境界含む)', () => {
    expect(circleIntersectsRect(125, 80, 20, rect)).toBe(true);
  });
});

describe('collisionOk: 外接円どうしのガター (既定 24px) 判定', () => {
  it('十分離れていれば true', () => {
    expect(collisionOk(0, 0, 50, [{ cx: 200, cy: 0, r: 50 }], 24)).toBe(true);
  });
  it('間隔が gap 未満なら false', () => {
    expect(collisionOk(0, 0, 50, [{ cx: 110, cy: 0, r: 50 }], 24)).toBe(false);
  });
});

describe('shapeFits: 装飾範囲・横のはみ出し・障害物の合成判定', () => {
  const opaque = [{ x: 600, y: 600, w: 200, h: 200 }];

  it('装飾範囲内・障害物と重ならなければ true', () => {
    expect(shapeFits(200, 500, 50, 1000, 300, 900, 0, opaque)).toBe(true);
  });

  it('装飾範囲の上端をはみ出すと false', () => {
    expect(shapeFits(200, 310, 50, 1000, 300, 900, 0, opaque)).toBe(false);
  });

  it('横のはみ出しが許容量 (xOverflow) を超えると false', () => {
    expect(shapeFits(-25, 500, 20, 1000, 300, 900, 40, opaque)).toBe(false);
  });

  it('横のはみ出しが許容量以内なら true', () => {
    expect(shapeFits(-15, 500, 20, 1000, 300, 900, 40, opaque)).toBe(true);
  });

  it('不透明な面と重なると false', () => {
    expect(shapeFits(650, 650, 30, 1000, 300, 900, 0, opaque)).toBe(false);
  });
});
