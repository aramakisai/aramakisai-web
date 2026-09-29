import { describe, expect, it } from 'vitest';
import {
  bboxRadius,
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

describe('collisionOk: 外接円どうしのガター (既定 24px) 判定', () => {
  it('十分離れていれば true', () => {
    expect(collisionOk(0, 0, 50, [{ cx: 200, cy: 0, r: 50 }], 24)).toBe(true);
  });
  it('間隔が gap 未満なら false', () => {
    expect(collisionOk(0, 0, 50, [{ cx: 110, cy: 0, r: 50 }], 24)).toBe(false);
  });
});

describe('shapeFits: 装飾範囲・横のはみ出しの合成判定', () => {
  it('装飾範囲内なら true', () => {
    expect(shapeFits(200, 500, 50, 1000, 300, 900, 0)).toBe(true);
  });

  it('装飾範囲の上端をはみ出すと false', () => {
    expect(shapeFits(200, 310, 50, 1000, 300, 900, 0)).toBe(false);
  });

  it('横のはみ出しが許容量 (xOverflow) を超えると false', () => {
    expect(shapeFits(-25, 500, 20, 1000, 300, 900, 40)).toBe(false);
  });

  it('横のはみ出しが許容量以内なら true', () => {
    expect(shapeFits(-15, 500, 20, 1000, 300, 900, 40)).toBe(true);
  });
});
