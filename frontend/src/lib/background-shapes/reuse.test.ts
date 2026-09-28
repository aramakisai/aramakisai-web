import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterForObstacles } from './reuse';
import { placeBackgroundShapes } from './placement';
import type { PlacedShape, PlacementInput, Tier } from './types';

const FIXTURES_DIR = join(__dirname, '__fixtures__');

function loadFixture(name: string): PlacementInput {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8')) as PlacementInput;
}

interface GoldenShape {
  tier: Tier;
  kind: string;
  cx: number;
  cy: number;
  size: number;
  rotation: number;
  colors: readonly [string, string] | null;
  texture: string | null;
}

function loadGolden(name: string): { shapes: readonly GoldenShape[] } {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.golden.json`), 'utf-8')) as { shapes: readonly GoldenShape[] };
}

function expectShapesMatchGolden(shapes: readonly PlacedShape[], golden: readonly GoldenShape[]) {
  expect(shapes.length).toBe(golden.length);
  shapes.forEach((shape, i) => {
    const g = golden[i];
    expect(shape.tier).toBe(g.tier);
    expect(shape.kind).toBe(g.kind);
    expect(shape.texture).toBe(g.texture);
    expect(shape.colors).toEqual(g.colors);
    expect(shape.cx).toBeCloseTo(g.cx, 2);
    expect(shape.cy).toBeCloseTo(g.cy, 2);
    expect(shape.size).toBeCloseTo(g.size, 2);
    expect(shape.rot).toBeCloseTo(g.rotation, 2);
  });
}

describe('filterForObstacles: 保持した配置を新しい障害物で間引く (流用モード)', () => {
  it('news-list-sp の配置を news-list-empty-sp の障害物で間引くと news-list-reuse の golden と一致する', () => {
    const origInput = loadFixture('news-list-sp');
    const orig = placeBackgroundShapes(origInput);
    const newObstacles = loadFixture('news-list-empty-sp');
    const golden = loadGolden('news-list-reuse');

    const result = filterForObstacles(orig.shapes, newObstacles);

    expectShapesMatchGolden(result.visible, golden.shapes);
  });

  it('落とした図形は残した図形と合わせて元の配置全体になる (位置・寸法・質感を変えない)', () => {
    const origInput = loadFixture('news-list-sp');
    const orig = placeBackgroundShapes(origInput);
    const newObstacles = loadFixture('news-list-empty-sp');

    const result = filterForObstacles(orig.shapes, newObstacles);

    expect(result.visible.length + result.dropped.length).toBe(orig.shapes.length);
    for (const shape of result.visible) {
      expect(orig.shapes).toContainEqual(shape);
    }
  });
});
