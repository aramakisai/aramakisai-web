import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import {
  GRADIENT_PALETTE,
  getExhibitionGradient,
  getExhibitionAppearance,
} from './exhibition-color';

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

describe('getExhibitionGradient', () => {
  it('同じ企画名からは常に同じ配色を返す', () => {
    const a = getExhibitionGradient('アラマキ祭');
    const b = getExhibitionGradient('アラマキ祭');
    expect(a).toEqual(b);
  });

  it('from と to は色相順 (環状) で必ず隣り合う', () => {
    const order = [
      'warning',
      'primary',
      'success',
      'secondary',
      'info',
      'accent-alt',
      'accent',
    ];
    for (let i = 0; i < 500; i++) {
      const { from, to } = getExhibitionGradient(`企画${i}`);
      const d = Math.abs(order.indexOf(from) - order.indexOf(to));
      expect([1, order.length - 1]).toContain(d);
    }
  });

  it('溜まりの中心は angle から算出される', () => {
    const g = getExhibitionGradient('アラマキ祭');
    const rad = (g.angle * Math.PI) / 180;
    expect(g.poolX).toBeCloseTo(50 + 90 * Math.sin(rad), 1);
    expect(g.poolY).toBeCloseTo(50 - 40 * Math.cos(rad), 1);
  });

  it('角度は 0〜359 の整数になる', () => {
    for (const name of [
      '',
      'アラマキ祭',
      'Test Project',
      '荒牧祭実行委員会',
      'あ',
    ]) {
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
    ['', 'info', 'accent-alt', 278],
    ['アラマキ祭', 'warning', 'accent', 130],
    ['Test Project', 'info', 'secondary', 1],
    ['荒牧祭実行委員会', 'warning', 'accent', 270],
    ['あ', 'primary', 'warning', 106],
  ] as const)('%s の既知の組み合わせを返す', (name, from, to, angle) => {
    expect(getExhibitionGradient(name)).toEqual({
      from,
      to,
      fromColor: GRADIENT_PALETTE[from],
      toColor: GRADIENT_PALETTE[to],
      angle,
      poolX: expect.any(Number),
      poolY: expect.any(Number),
    });
  });
});

describe('getExhibitionAppearance', () => {
  it('同じ企画名からは常に同じ色・質感を返す', () => {
    const a = getExhibitionAppearance('アラマキ祭');
    const b = getExhibitionAppearance('アラマキ祭');
    expect(a).toEqual(b);
  });

  it('色・角度は getExhibitionGradient と同じ乱数列から得られる (質感はその続き)', () => {
    for (const name of ['', 'アラマキ祭', 'Test Project', 'あ']) {
      const gradient = getExhibitionGradient(name);
      const appearance = getExhibitionAppearance(name);
      expect(appearance.from).toBe(gradient.from);
      expect(appearance.to).toBe(gradient.to);
      expect(appearance.angle).toBe(gradient.angle);
    }
  });

  // rng.ts の乱数列の続きから引いた値を固定する (design.md のアルゴリズムどおりの参照実装で算出)
  it.each([
    ['', 'watercolor'],
    ['アラマキ祭', 'watercolor'],
    ['Test Project', 'halftone'],
    ['荒牧祭実行委員会', 'gradient'],
    ['あ', 'halftone'],
  ] as const)('%s の既知の質感を返す', (name, texture) => {
    expect(getExhibitionAppearance(name).texture).toBe(texture);
  });

  it('質感の切り出し位置・反転は決定的で範囲内', () => {
    for (let i = 0; i < 200; i++) {
      const a = getExhibitionAppearance(`企画${i}`);
      expect(a).toEqual(getExhibitionAppearance(`企画${i}`));
      expect(Number.isInteger(a.texturePositionY)).toBe(true);
      expect(a.texturePositionY).toBeGreaterThanOrEqual(0);
      expect(a.texturePositionY).toBeLessThanOrEqual(100);
      expect(typeof a.textureFlipX).toBe('boolean');
      expect(typeof a.textureFlipY).toBe('boolean');
    }
  });
});
