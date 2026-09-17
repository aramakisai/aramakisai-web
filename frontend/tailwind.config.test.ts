import { describe, expect, it } from 'vitest';
import config from './tailwind.config';

const colors = config.theme?.extend?.colors as Record<
  string,
  string | Record<string, string>
>;
const gray = colors.gray as Record<string, string>;
const background = colors.background as string;

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`hex ではない色指定: ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channelLuminance((n >> 16) & 0xff) +
    0.7152 * channelLuminance((n >> 8) & 0xff) +
    0.0722 * channelLuminance(n & 0xff)
  );
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

describe('配色トークン', () => {
  it('ページ背景色が暖色寄りの白である', () => {
    expect(background).toBe('#fbf8f3');
  });

  it('既存コードが使うグレー 9 階調をすべて再定義している', () => {
    expect(Object.keys(gray).sort()).toEqual(
      ['100', '200', '300', '400', '50', '500', '600', '700', '800'].sort(),
    );
  });

  it('見出し色を現行のまま維持している', () => {
    expect(colors.primary).toBe('#ebb03c');
    expect(colors.text).toBe('#231815');
  });

  // 本文テキストに使われる階調のみを対象にする。gray-400 は影の色専用でテキストには使わない
  const bodyTextColors: [string, string][] = [
    ['text', colors.text as string],
    ...(['500', '600', '700', '800'] as const).map(
      (shade): [string, string] => [`gray-${shade}`, gray[shade]],
    ),
  ];

  it.each(bodyTextColors)(
    '本文テキスト色 %s が背景に対して 4.5:1 以上',
    (_name, color) => {
      expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('contrastRatio', () => {
  it('黒と白で 21:1 を返す', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });
});
