import { describe, expect, it } from 'vitest';
import { extendBackgroundShapes, placeBackgroundShapes } from './placement';
import { bboxRadius, infRadius } from './geometry';
import type { PlacementInput } from './types';

const base: PlacementInput = {
  pathname: '/exhibitions',
  platform: 'pc',
  width: 1280,
  height: 1000,
  decorTop: 80,
  decorBottom: 700,
};
const grown: PlacementInput = { ...base, height: 3600, decorBottom: 3300 };

const radius = (s: { tier: string; size: number }) =>
  s.tier === 'Inf' ? infRadius(s.size) : bboxRadius(s.size);

describe('extendBackgroundShapes', () => {
  const initial = placeBackgroundShapes(base).shapes;
  const added = extendBackgroundShapes(grown, initial, base.decorBottom);

  it('伸びた範囲に図形を追加する', () => {
    expect(added.length).toBeGreaterThan(0);
    for (const s of added)
      expect(s.cy).toBeGreaterThanOrEqual(base.decorBottom);
  });

  it('追加分は既存を含む全図形と 24px 以上離れ、装飾範囲に収まる', () => {
    const all = [...initial, ...added];
    for (const s of added) {
      const r = radius(s);
      expect(s.cy - r).toBeGreaterThanOrEqual(grown.decorTop - 1e-6);
      expect(s.cy + r).toBeLessThanOrEqual(grown.decorBottom + 1e-6);
      for (const o of all) {
        if (o === s) continue;
        expect(Math.hypot(s.cx - o.cx, s.cy - o.cy)).toBeGreaterThanOrEqual(
          r + radius(o) + 24 - 0.05,
        );
      }
    }
  });

  it('同じ入力には同じ結果、伸びていなければ追加しない', () => {
    expect(extendBackgroundShapes(grown, initial, base.decorBottom)).toEqual(
      added,
    );
    expect(extendBackgroundShapes(base, initial, base.decorBottom)).toEqual([]);
  });
});
