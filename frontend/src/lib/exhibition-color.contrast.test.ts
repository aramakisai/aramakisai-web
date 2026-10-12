import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../tailwind.config';
import { GRADIENT_PALETTE, type GradientColorToken } from './exhibition-color';

const HUE_ORDER: readonly GradientColorToken[] = [
  'warning',
  'primary',
  'success',
  'secondary',
  'info',
  'accent-alt',
  'accent',
];

type Rgb = readonly [number, number, number];

const hexToRgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
};

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themeColors = tailwindConfig.theme?.extend?.colors as Record<
  string,
  string
>;
const TEXT_RGB = hexToRgb(themeColors.text);

// 溜まりの縁は from と to のアルファ合成なので、純色と隣接ペアの 50% 混色が最悪ケースの代表になる
const WHITE_VEIL = 0.35;
const veil = (rgb: Rgb) =>
  rgb.map((c) =>
    Math.round(c * (1 - WHITE_VEIL) + 255 * WHITE_VEIL),
  ) as unknown as Rgb;

const rawBackgrounds: [string, Rgb][] = [
  ...HUE_ORDER.map((t): [string, Rgb] => [t, hexToRgb(GRADIENT_PALETTE[t])]),
  ...HUE_ORDER.map((t, i): [string, Rgb] => {
    const next = HUE_ORDER[(i + 1) % HUE_ORDER.length];
    const a = hexToRgb(GRADIENT_PALETTE[t]);
    const b = hexToRgb(GRADIENT_PALETTE[next]);
    return [
      `${t}+${next}`,
      a.map((c, k) => Math.round((c + b[k]) / 2)) as unknown as Rgb,
    ];
  }),
];

const backgrounds = rawBackgrounds.map(([n, c]): [string, Rgb] => [n, veil(c)]);

describe('企画カード配色のコントラスト', () => {
  it.each(backgrounds)(
    '%s: 文字 4.5:1 以上 (アイコン 3:1 も同色のため満たす)',
    (_name, bg) => {
      expect(contrast(TEXT_RGB, bg)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
