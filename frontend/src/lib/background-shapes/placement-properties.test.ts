import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { bboxRadius, circleIntersectsRect, infRadius } from './geometry';
import { placeBackgroundShapes } from './placement';
import type { PlacedShape, PlacementInput, PlacementResult } from './types';

const FIXTURES_DIR = join(__dirname, '__fixtures__');
const FIXTURE_NAMES = [
  'top-pc',
  'top-sp',
  'news-list-sp',
  'news-list-empty-sp',
  'topics-list-sp',
  'news-detail-sp',
  'news-detail-pc',
];

function loadFixture(name: string): PlacementInput {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'),
  ) as PlacementInput;
}

// 性質は同じ fixture 入力に対して置換不変なので、fixture ごとに1回だけ配置計算して使い回す。
const placed = new Map<
  string,
  { input: PlacementInput; result: PlacementResult }
>();

beforeAll(() => {
  for (const name of FIXTURE_NAMES) {
    const input = loadFixture(name);
    placed.set(name, { input, result: placeBackgroundShapes(input) });
  }
});

function radiusOf(shape: PlacedShape): number {
  return shape.tier === 'Inf' ? infRadius(shape.size) : bboxRadius(shape.size);
}

describe('placeBackgroundShapes: 簡易ルール (rules.md) の性質', () => {
  it.each(FIXTURE_NAMES)(
    '%s: 図形は不透明な面の矩形と外接円で重ならない',
    (name) => {
      const { input, result } = placed.get(name)!;
      for (const shape of result.shapes) {
        const r = radiusOf(shape);
        for (const rect of input.opaque) {
          expect(circleIntersectsRect(shape.cx, shape.cy, r, rect)).toBe(false);
        }
      }
    },
  );

  it.each(FIXTURE_NAMES)('%s: 図形同士の外接円は 24px 以上離れる', (name) => {
    const { result } = placed.get(name)!;
    const shapes = result.shapes;
    for (let i = 0; i < shapes.length; i++) {
      for (let j = i + 1; j < shapes.length; j++) {
        const a = shapes[i];
        const b = shapes[j];
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        expect(d).toBeGreaterThanOrEqual(radiusOf(a) + radiusOf(b) + 24 - 1e-6);
      }
    }
  });

  it.each(FIXTURE_NAMES)('%s: 図形は装飾範囲の外に出ない', (name) => {
    const { input, result } = placed.get(name)!;
    for (const shape of result.shapes) {
      const r = radiusOf(shape);
      expect(shape.cy - r).toBeGreaterThanOrEqual(input.decorTop - 1e-6);
      expect(shape.cy + r).toBeLessThanOrEqual(input.decorBottom + 1e-6);
    }
  });

  it.each(FIXTURE_NAMES)(
    '%s: 全階層とも外接円のはみ出しは一辺 (∞ は直径) の 0.4 倍以内',
    (name) => {
      const { input, result } = placed.get(name)!;
      for (const shape of result.shapes) {
        const r = radiusOf(shape);
        const overflow = 0.4 * shape.size;
        expect(shape.cx - r).toBeGreaterThanOrEqual(-overflow - 1e-6);
        expect(shape.cx + r).toBeLessThanOrEqual(input.width + overflow + 1e-6);
      }
    },
  );

  it.each(FIXTURE_NAMES)(
    '%s: 配置計算は高速に完了する (目安 10ms 未満。計測を報告するだけで assert はしない)',
    (name) => {
      const { input } = placed.get(name)!;
      const start = performance.now();
      placeBackgroundShapes(input);
      const elapsed = performance.now() - start;
      console.info(`[background-shapes] ${name}: ${elapsed.toFixed(3)}ms`);
    },
  );
});
