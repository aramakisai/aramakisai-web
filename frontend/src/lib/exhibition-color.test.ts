import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import { GRADIENT_PALETTE, getExhibitionTexture } from './exhibition-color';

describe('GRADIENT_PALETTE', () => {
  it('tailwind.config.ts の同名トークンと色値が一致する', () => {
    const themeColors = tailwindConfig.theme?.extend?.colors as Record<
      string,
      string
    >;
    for (const [token, color] of Object.entries(GRADIENT_PALETTE)) {
      expect(color).toBe(themeColors[token]);
    }
  });
});

describe('getExhibitionTexture', () => {
  it('同じ企画名からは常に同じ質感・位置を返す', () => {
    expect(getExhibitionTexture('アラマキ祭')).toEqual(
      getExhibitionTexture('アラマキ祭'),
    );
  });

  it('質感は 4 種のいずれかで、位置は 0〜100% かつ左上の白抜けを避ける', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const { texture, position } = getExhibitionTexture(`企画${i}`);
      seen.add(texture);
      const [x, y] = position;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
      expect(x < 25 && y < 17).toBe(false);
      const { rotation } = getExhibitionTexture(`企画${i}`);
      expect(rotation).toBeGreaterThanOrEqual(0);
      expect(rotation).toBeLessThanOrEqual(360);
    }
    expect([...seen].sort()).toEqual([
      'gradient',
      'grain',
      'streak',
      'watercolor',
    ]);
  });
});
