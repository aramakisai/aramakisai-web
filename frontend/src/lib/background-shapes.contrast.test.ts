import { describe, it, expect } from 'vitest';
import { SHAPE_COLOR_TOKENS, type ShapeColorToken } from './background-shapes';

// tailwind.config.ts の値と一致させる。bansai-* は装飾専用トークンでここでしか使わない
const BANSAI_HEX: Record<ShapeColorToken, string> = {
  'bansai-ochre': '#e4ab53',
  'bansai-olive': '#c9bf86',
  'bansai-sage': '#aeb49c',
  'bansai-salmon': '#dd9b8c',
  'bansai-rose': '#e0666d',
  'bansai-wisteria': '#d2c6da',
  'bansai-aqua': '#a2c2c6',
};

// 本文の文字色 (tailwind.config.ts の `text`)
const TEXT_COLOR = '#231815';

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [rl, gl, bl] = [r, g, b].map(srgbToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const lA = relativeLuminance(a);
  const lB = relativeLuminance(b);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

const TEXT_RGB = hexToRgb(TEXT_COLOR);

describe('背景の図形装飾の色トークンと本文文字色のコントラスト (要件 23.5)', () => {
  // 除外領域 (外側 10px マージン) により図形は文字と重ならない配置になるが、
  // その担保に加えて色自体も基準を満たすことを確認する (二重の担保)
  it.each(SHAPE_COLOR_TOKENS)('%s: 文字色に対して 4.5:1 以上', (token) => {
    const ratio = contrastRatio(TEXT_RGB, hexToRgb(BANSAI_HEX[token]));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
