import { describe, expect, it, vi } from 'vitest';
vi.mock('./cms', () => ({ cms: {} }));

import { fitCanvas } from './signage-viewport';

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
