import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterForObstacles } from './reuse';
import { placeBackgroundShapes } from './placement';
import type { PlacementInput } from './types';

const FIXTURES_DIR = join(__dirname, '__fixtures__');

function loadFixture(name: string): PlacementInput {
  return JSON.parse(
    readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf-8'),
  ) as PlacementInput;
}

describe('filterForObstacles: 保持した配置を新しい障害物で間引く (流用モード)', () => {
  it('落とした図形は残した図形と合わせて元の配置全体になり、位置・寸法・質感を変えない', () => {
    const origInput = loadFixture('news-list-sp');
    const orig = placeBackgroundShapes(origInput);
    const newObstacles = loadFixture('news-list-empty-sp');

    const result = filterForObstacles(orig.shapes, newObstacles);

    expect(result.visible.length + result.dropped.length).toBe(
      orig.shapes.length,
    );
    for (const shape of result.visible) {
      expect(orig.shapes).toContainEqual(shape);
    }
  });
});
