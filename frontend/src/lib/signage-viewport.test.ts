import { describe, expect, it, vi } from 'vitest';
vi.mock('./cms', () => ({ cms: {} }));

import { fitCanvas, layoutFor, orientationOf } from './signage-viewport';

describe('fitCanvas', () => {
  it('同寸の画面では等倍で原点に置く', () => {
    expect(
      fitCanvas({ width: 1920, height: 1080 }, { width: 1920, height: 1080 }),
    ).toEqual({ scale: 1, left: 0, top: 0 });
  });

  it('縦横の小さい方の倍率に合わせ、余白側で中央に寄せる', () => {
    expect(
      fitCanvas({ width: 960, height: 800 }, { width: 1920, height: 1080 }),
    ).toEqual({ scale: 0.5, left: 0, top: 130 });
  });

  it('縦型キャンバスも同様に収める', () => {
    expect(
      fitCanvas({ width: 1080, height: 960 }, { width: 1080, height: 1920 }),
    ).toEqual({ scale: 0.5, left: 270, top: 0 });
  });
});

describe('orientationOf', () => {
  it('高さが幅を超えれば縦型、同じか幅が大きければ横型', () => {
    expect(orientationOf({ width: 500, height: 1330 })).toBe('portrait');
    expect(orientationOf({ width: 1000, height: 1001 })).toBe('portrait');
    expect(orientationOf({ width: 1000, height: 1000 })).toBe('landscape');
    expect(orientationOf({ width: 1920, height: 1080 })).toBe('landscape');
  });
});

describe('layoutFor', () => {
  const canvasOf = (v: { width: number; height: number }) => {
    const { orientation, fit } = layoutFor(v);
    const c =
      orientation === 'portrait'
        ? { width: 1080, height: 1920 }
        : { width: 1920, height: 1080 };
    return { orientation, fit, c };
  };

  it.each([
    [100, 2000],
    [2000, 100],
    [1, 1000],
    [1000, 1],
    [500, 1330],
    [1920, 1080],
    [1080, 1920],
    [333, 333],
  ])(
    '極端な縦横比 %ix%i でもキャンバス全体が収まり中央に置かれる',
    (width, height) => {
      const { fit, c } = canvasOf({ width, height });
      const eps = 1e-6;
      expect(fit.left).toBeGreaterThanOrEqual(-eps);
      expect(fit.top).toBeGreaterThanOrEqual(-eps);
      expect(fit.left + c.width * fit.scale).toBeLessThanOrEqual(width + eps);
      expect(fit.top + c.height * fit.scale).toBeLessThanOrEqual(height + eps);
      // 少なくとも一方向はぴったり接する(最大倍率)
      const fills =
        Math.abs(c.width * fit.scale - width) < eps ||
        Math.abs(c.height * fit.scale - height) < eps;
      expect(fills).toBe(true);
    },
  );
});
