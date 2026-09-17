import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import { GRADIENT_PALETTE, getExhibitionGradient } from './exhibition-color';

describe('GRADIENT_PALETTE', () => {
  it('tailwind.config.ts の同名トークンと色値が一致する', () => {
    const themeColors = tailwindConfig.theme?.extend?.colors as Record<string, string>;
    for (const [token, color] of Object.entries(GRADIENT_PALETTE)) {
      expect(color).toBe(themeColors[token]);
    }
  });
});

describe('getExhibitionGradient', () => {
  it('同じ企画名からは常に同じ配色を返す', () => {
    const a = getExhibitionGradient('アラマキ祭');
    const b = getExhibitionGradient('アラマキ祭');
    expect(a).toEqual(b);
  });

  it('from と to は必ず異なるトークンになる', () => {
    for (const name of ['', 'アラマキ祭', 'Test Project', '荒牧祭実行委員会', 'あ']) {
      const gradient = getExhibitionGradient(name);
      expect(gradient.from).not.toBe(gradient.to);
    }
  });

  it('角度は 0〜359 の整数になる', () => {
    for (const name of ['', 'アラマキ祭', 'Test Project', '荒牧祭実行委員会', 'あ']) {
      const { angle } = getExhibitionGradient(name);
      expect(Number.isInteger(angle)).toBe(true);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(359);
    }
  });

  it('色値はトークンに対応する GRADIENT_PALETTE の値と一致する', () => {
    const gradient = getExhibitionGradient('アラマキ祭');
    expect(gradient.fromColor).toBe(GRADIENT_PALETTE[gradient.from]);
    expect(gradient.toColor).toBe(GRADIENT_PALETTE[gradient.to]);
  });

  it('空文字でも決定的に配色を返す', () => {
    expect(getExhibitionGradient('')).toEqual(getExhibitionGradient(''));
  });

  // FNV-1a(32bit) → mulberry32 の算出手順自体を固定する (design.md のアルゴリズムどおりの参照実装で算出)
  it.each([
    ['', 'info', 'accent', 278],
    ['アラマキ祭', 'primary', 'warning', 130],
    ['Test Project', 'info', 'accent-alt', 1],
    ['荒牧祭実行委員会', 'primary', 'info', 270],
    ['あ', 'secondary', 'warning', 106],
  ] as const)('%s の既知の組み合わせを返す', (name, from, to, angle) => {
    expect(getExhibitionGradient(name)).toEqual({
      from,
      to,
      fromColor: GRADIENT_PALETTE[from],
      toColor: GRADIENT_PALETTE[to],
      angle,
    });
  });
});
