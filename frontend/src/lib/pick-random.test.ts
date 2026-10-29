import { describe, expect, it } from 'vitest';
import { pickRandom } from './pick-random';

describe('pickRandom', () => {
  const source = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));

  it('指定件数だけ返し、すべて元の配列に含まれる一意な要素である', () => {
    const picked = pickRandom(source, 4);
    expect(picked).toHaveLength(4);
    expect(new Set(picked.map((e) => e.id)).size).toBe(4);
    for (const item of picked) {
      expect(source).toContainEqual(item);
    }
  });

  it('要素数が指定件数より少ないときは全件を返す', () => {
    const short = source.slice(0, 2);
    expect(pickRandom(short, 4)).toHaveLength(2);
  });

  it('空配列を渡すと空配列を返す', () => {
    expect(pickRandom([], 4)).toEqual([]);
  });

  it('元の配列を変更しない', () => {
    const copy = [...source];
    pickRandom(source, 4);
    expect(source).toEqual(copy);
  });
});
