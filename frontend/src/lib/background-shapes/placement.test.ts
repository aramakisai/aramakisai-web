import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { placeBackgroundShapes } from './placement';
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
