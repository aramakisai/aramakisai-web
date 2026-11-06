import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderCards, readOrCreateSeed } from './exhibition-order';

const KEY = 'aramakisai_exhibition_order_seed';
const cards = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  category: i % 2 ? 'booth' : 'stage',
}));

describe('orderCards', () => {
  it('同じシードで同じ順になり、入力は変更されない', () => {
    const copy = [...cards];
    expect(orderCards(cards, 1)).toEqual(orderCards(cards, 1));
    expect(cards).toEqual(copy);
  });

  it('シードが違えば順が変わる', () => {
    expect(orderCards(cards, 1)).not.toEqual(orderCards(cards, 2));
  });

  it('1枚除いても残りの相対順が保たれる', () => {
    const full = orderCards(cards, 7);
    const removed = full[10];
    const rest = orderCards(
      cards.filter((c) => c !== removed),
      7,
    );
    expect(rest).toEqual(full.filter((c) => c !== removed));
  });
});

describe('readOrCreateSeed', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('作ったシードを保存し、次回は再利用する', () => {
    const seed = readOrCreateSeed();
    expect(window.sessionStorage.getItem(KEY)).toBe(String(seed));
    expect(readOrCreateSeed()).toBe(seed);
  });

  it('保存済みの値をそのまま返す', () => {
    window.sessionStorage.setItem(KEY, '12345');
    expect(readOrCreateSeed()).toBe(12345);
  });

  it.each(['abc', '-1', '1.5', '4294967296', ''])(
    '不正値 %j を上書きする',
    (bad) => {
      window.sessionStorage.setItem(KEY, bad);
      const seed = readOrCreateSeed();
      expect(window.sessionStorage.getItem(KEY)).toBe(String(seed));
    },
  );

  it('sessionStorage が例外を投げても数値を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(Number.isInteger(readOrCreateSeed())).toBe(true);
  });
});
