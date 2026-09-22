import { describe, it, expect } from 'vitest';
import {
  computeBackgroundShapePlacement,
  SHAPE_KINDS,
  SHAPE_COLOR_TOKENS,
  type Rect,
} from './background-shapes';

const noExcludes: Rect[] = [];

describe('computeBackgroundShapePlacement', () => {
  it('同じ入力に対して常に同じ配置を返す (決定性)', () => {
    const input = {
      pathname: '/topics/1',
      pageHeight: 3000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    };
    const a = computeBackgroundShapePlacement(input);
    const b = computeBackgroundShapePlacement(input);
    expect(a).toEqual(b);
  });

  it('パスが異なれば配置も変わる', () => {
    const a = computeBackgroundShapePlacement({
      pathname: '/',
      pageHeight: 3000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    const b = computeBackgroundShapePlacement({
      pathname: '/access',
      pageHeight: 3000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    expect(a).not.toEqual(b);
  });

  it('ページ高が小さくても最低 4 個は配置する', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/short',
      pageHeight: 200,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it('PC は SP のおよそ 1/0.7 の個数を目標にする (除外領域が無い十分広いページ)', () => {
    const pc = computeBackgroundShapePlacement({
      pathname: '/dense',
      pageHeight: 11000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    const sp = computeBackgroundShapePlacement({
      pathname: '/dense',
      pageHeight: 11000,
      viewportWidth: 375,
      excludeRects: noExcludes,
    });
    // PC: 11000/110 = 100 個目標、SP: その 0.7 倍 = 70 個目標 (間隔制約で下回ることはあるが SP が PC を上回ることはない)
    expect(sp.length).toBeLessThan(pc.length);
  });

  it('図形の一辺は 22px から 104px の範囲に収まる', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/size-check',
      pageHeight: 6000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    for (const shape of result) {
      expect(shape.size).toBeGreaterThanOrEqual(22);
      expect(shape.size).toBeLessThanOrEqual(104);
    }
  });

  it('回転は 0 から 359 の整数', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/rotation-check',
      pageHeight: 6000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    for (const shape of result) {
      expect(Number.isInteger(shape.rotation)).toBe(true);
      expect(shape.rotation).toBeGreaterThanOrEqual(0);
      expect(shape.rotation).toBeLessThanOrEqual(359);
    }
  });

  it('図形どうしの中心間隔は 70px + 両辺合計/4 以上を保つ', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/gap-check',
      pageHeight: 8000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        // リングの二重配置 (7px, 6px オフセット) は組の内部なので中心間隔の対象外
        const isRingPair =
          a.kind === 'ring' &&
          b.kind === 'ring' &&
          Math.abs(a.x - b.x) === 7 &&
          Math.abs(a.y - b.y) === 6;
        if (isRingPair) continue;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const minGap = 70 + (a.size + b.size) / 4;
        expect(dist).toBeGreaterThanOrEqual(minGap - 0.001);
      }
    }
  });

  it('除外領域の外側 10px には図形の回転後の外接矩形が重ならない', () => {
    const excludeRects: Rect[] = [{ x: 600, y: 1000, width: 200, height: 100 }];
    const result = computeBackgroundShapePlacement({
      pathname: '/exclude-check',
      pageHeight: 6000,
      viewportWidth: 1440,
      excludeRects,
    });
    const padded = { x: 590, y: 990, width: 220, height: 120 };
    for (const shape of result) {
      const rad = (shape.rotation * Math.PI) / 180;
      const aabb =
        shape.size * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)));
      const rect = {
        x: shape.x - aabb / 2,
        y: shape.y - aabb / 2,
        width: aabb,
        height: aabb,
      };
      const overlaps =
        rect.x < padded.x + padded.width &&
        rect.x + rect.width > padded.x &&
        rect.y < padded.y + padded.height &&
        rect.y + rect.height > padded.y;
      expect(overlaps).toBe(false);
    }
  });

  it('質感なしの出現比率は他の質感それぞれの約 2 倍になる (5 枠中 2)', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/texture-ratio',
      pageHeight: 40000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    const nonRing = result.filter((s) => s.kind !== 'ring');
    const counts = { none: 0, noise: 0, halftone: 0, cloud: 0 };
    for (const shape of nonRing) counts[shape.texture]++;
    const total = nonRing.length;
    expect(total).toBeGreaterThan(20);
    const noneRatio = counts.none / total;
    const noiseRatio = counts.noise / total;
    // 5 枠中 2 (0.4) と 1 (0.2) の比率に対してサンプルゆらぎを許容する
    expect(noneRatio).toBeGreaterThan(0.3);
    expect(noneRatio).toBeLessThan(0.5);
    expect(noiseRatio).toBeGreaterThan(0.1);
    expect(noiseRatio).toBeLessThan(0.3);
  });

  it('リングには質感を割り当てない', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/ring-texture',
      pageHeight: 20000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    const rings = result.filter((s) => s.kind === 'ring');
    expect(rings.length).toBeGreaterThan(0);
    for (const ring of rings) {
      expect(ring.texture).toBe('none');
    }
  });

  it('リングは 2 つ 1 組で (7px, 6px) ずれた位置に配置される', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/ring-pair',
      pageHeight: 20000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    const rings = result.filter((s) => s.kind === 'ring');
    expect(rings.length % 2).toBe(0);
    for (let i = 0; i < rings.length; i += 2) {
      const first = rings[i];
      const second = rings[i + 1];
      expect(second.x - first.x).toBe(7);
      expect(second.y - first.y).toBe(6);
      expect(second.size).toBe(first.size);
    }
  });

  it('種類・色トークンは定義済みの値のみを返す', () => {
    const result = computeBackgroundShapePlacement({
      pathname: '/enum-check',
      pageHeight: 6000,
      viewportWidth: 1440,
      excludeRects: noExcludes,
    });
    for (const shape of result) {
      expect(SHAPE_KINDS).toContain(shape.kind);
      expect(SHAPE_COLOR_TOKENS).toContain(shape.color);
    }
  });

  it('試行回数の上限に達したら、それまでに置けた個数で確定する (下限 4 個は保証しない極端な入力)', () => {
    // ページ全体を覆う除外領域を与えると、どんな座標も除外に抵触し 1 個も置けない
    const excludeRects: Rect[] = [
      { x: -1000, y: -1000, width: 10000, height: 10000 },
    ];
    const result = computeBackgroundShapePlacement({
      pathname: '/all-excluded',
      pageHeight: 3000,
      viewportWidth: 1440,
      excludeRects,
    });
    expect(result.length).toBe(0);
  });
});
