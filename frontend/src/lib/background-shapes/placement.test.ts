import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { placeBackgroundShapes } from './placement';
import type { PlacedShape, PlacementInput, Tier } from './types';

const FIXTURES_DIR = join(__dirname, '__fixtures__');

function loadFixture(name: string): PlacementInput {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'),
  ) as PlacementInput;
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

interface Golden {
  shapes: readonly GoldenShape[];
  meta: {
    target: Record<Tier, number>;
    deficit: Record<Tier, number>;
  };
}

function loadGolden(name: string): Golden {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, `${name}.golden.json`), 'utf-8'),
  ) as Golden;
}

// golden は place.py が cx/cy/size/rotation を小数第 2 位に丸めて出力したもの。
// 座標・寸法・回転は 0.01 の誤差まで許容し、個数・種類・質感・色は完全一致を求める (design.md のテスト方針)。
function expectShapesMatchGolden(
  shapes: readonly PlacedShape[],
  golden: readonly GoldenShape[],
) {
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

describe('placeBackgroundShapes: 参照実装 place.py と同じ入力で同じ配置を返す', () => {
  const cases = [
    'top-pc',
    'top-sp',
    'news-list-sp',
    'news-list-empty-sp',
    'topics-list-sp',
    'news-detail-sp',
    'news-detail-pc',
  ];

  // 文字が装飾可能帯のほぼ全域を占める画面 (news-list-sp) は ∞ の第3緩和段で最大 6000 回の
  // 候補再試行が走り、格子標本化 (40x40) の判定コストと相まって既定の 5s を超えることがある。
  it.each(cases)(
    '%s の golden と一致する',
    (name) => {
      const input = loadFixture(name);
      const golden = loadGolden(name);
      const result = placeBackgroundShapes(input);

      expect(result.target).toEqual(golden.meta.target);
      expect(result.deficit).toEqual(golden.meta.deficit);
      expectShapesMatchGolden(result.shapes, golden.shapes);
    },
    20000,
  );

  it('同じ入力には常に同じ結果を返す (決定的)', () => {
    const input = loadFixture('top-pc');
    const a = placeBackgroundShapes(input);
    const b = placeBackgroundShapes(input);
    expect(a).toEqual(b);
  });
});
