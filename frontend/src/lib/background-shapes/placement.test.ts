import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { placeBackgroundShapes } from './placement';
import { drawTexturePosition } from './rng';
import type { PlacementInput } from './types';

const FIXTURES_DIR = join(__dirname, '__fixtures__');

function loadFixture(name: string): PlacementInput {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'),
  ) as PlacementInput;
}

describe('placeBackgroundShapes: 決定性', () => {
  it('同じ入力には常に同じ結果を返す', () => {
    const input = loadFixture('top-pc');
    const a = placeBackgroundShapes(input);
    const b = placeBackgroundShapes(input);
    expect(a).toEqual(b);
  });
});

describe('placeBackgroundShapes: 質感', () => {
  const result = placeBackgroundShapes(loadFixture('top-pc'));
  const solids = result.shapes.filter((s) => s.tier !== 'Inf');

  it('位置は 0〜100% で、左上の白抜け (x<25% かつ y<17%) に入らない', () => {
    for (const s of solids) {
      const [x, y] = s.texturePos!;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      expect(x < 25 && y < 17).toBe(false);
    }
  });

  it('S は水彩を使わない', () => {
    for (const s of solids.filter((s) => s.tier === 'S')) {
      expect(s.texture).not.toBe('watercolor');
    }
  });

  it('L の先頭に水彩を含む', () => {
    expect(
      solids
        .filter((s) => s.tier === 'L')
        .some((s) => s.texture === 'watercolor'),
    ).toBe(true);
  });
});

describe('placeBackgroundShapes: 模様の回転角', () => {
  it('図形ごとに 0〜360 度で、同じ入力なら同じ角度', () => {
    const a = placeBackgroundShapes(loadFixture('top-pc'));
    const b = placeBackgroundShapes(loadFixture('top-pc'));
    const rots = a.shapes
      .filter((s) => s.tier !== 'Inf')
      .map((s) => s.textureRot!);
    expect(rots).toEqual(
      b.shapes.filter((s) => s.tier !== 'Inf').map((s) => s.textureRot!),
    );
    for (const r of rots) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(360);
    }
    expect(new Set(rots).size).toBeGreaterThan(1);
  });
});

describe('drawTexturePosition', () => {
  it('除外範囲に入った組は引き直す', () => {
    const seq = [0.1, 0.1, 0.2, 0.05, 0.3, 0.4];
    let i = 0;
    expect(drawTexturePosition(() => seq[i++])).toEqual([30, 40]);
  });
});
