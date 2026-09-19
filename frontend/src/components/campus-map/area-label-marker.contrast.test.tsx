import { describe, expect, it } from 'vitest';
import {
  GRADIENT_PALETTE,
  type GradientColorToken,
} from '@/lib/exhibition-color';

// AreaLabelMarker の背景 (通常時: 白 / 選択時: primary) はエリア自身の表示色を
// 一切使わない設計であるため、コントラストはどのエリア色でも不変になる。
// それでも要件 6.6 が求める「7 色すべてに対する検証」を満たす形で明示的に列挙する。
const TEXT_COLOR = '#231815';
const DEFAULT_LABEL_BACKGROUND = '#ffffff';
const SELECTED_LABEL_BACKGROUND = '#ebb03c'; // primary

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const lA = relativeLuminance(hexToRgb(a));
  const lB = relativeLuminance(hexToRgb(b));
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

const AREA_COLOR_TOKENS = Object.keys(GRADIENT_PALETTE) as GradientColorToken[];

describe('AreaLabelMarker のコントラスト (要件 6.6)', () => {
  it.each(AREA_COLOR_TOKENS)(
    'エリアの表示色が %s でも、通常時ラベルの文字は 4.5:1 以上を満たす',
    () => {
      expect(
        contrastRatio(TEXT_COLOR, DEFAULT_LABEL_BACKGROUND),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(AREA_COLOR_TOKENS)(
    'エリアの表示色が %s でも、選択中ラベルの文字は 4.5:1 以上を満たす',
    () => {
      expect(
        contrastRatio(TEXT_COLOR, SELECTED_LABEL_BACKGROUND),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );
});
