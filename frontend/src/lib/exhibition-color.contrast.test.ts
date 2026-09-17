import { describe, it, expect } from 'vitest';
import { GRADIENT_PALETTE, type GradientColorToken } from './exhibition-color';

// text-text (#231815) は企画カードの文字・アイコン両方に使う色。アイコンの基準 (3:1) は
// 文字の基準 (4.5:1) より緩いため、4.5:1 を満たせば両方を満たす。
const TEXT_COLOR = '#231815';
const WHITE_OVERLAY_ALPHA = 0.3;
const SAMPLE_STEPS = 20; // グラデーション全域 (t=0..1) を等間隔でサンプルし最悪値を取る

type Rgb = readonly [number, number, number];

function hexToRgb01(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  const clamped = Math.min(1, Math.max(0, c));
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

// 変換式は Björn Ottosson の OKLab 参照実装 (https://bottosson.github.io/posts/oklab/) に準拠。
// linear sRGB <-> OKLab
function linearRgbToOklab([r, g, b]: Rgb): Rgb {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function oklabToLinearRgb([L, a, b]: Rgb): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

interface Oklch {
  l: number;
  c: number;
  h: number; // 度数法、0-360 (chroma が 0 に近いときは無意味だが lerp 対象として保持)
}

function hexToOklch(hex: string): Oklch {
  const linear = hexToRgb01(hex).map(srgbToLinear) as unknown as Rgb;
  const [l, a, b] = linearRgbToOklab(linear);
  const c = Math.hypot(a, b);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c, h: h < 0 ? h + 360 : h };
}

// 色相は最短経路で補間する (CSS Color 4 の `hue: shorter` に相当。design.md の gradient 仕様と同じ経路)。
function lerpHue(h1: number, h2: number, t: number): number {
  const delta = ((((h2 - h1) % 360) + 540) % 360) - 180;
  return (h1 + delta * t + 360) % 360;
}

// linear-gradient(in oklch, from, to) の t 地点の色を sRGB 0-255 で返す。
function mixOklch(fromHex: string, toHex: string, t: number): Rgb {
  const from = hexToOklch(fromHex);
  const to = hexToOklch(toHex);
  const l = from.l + (to.l - from.l) * t;
  const c = from.c + (to.c - from.c) * t;
  const h = lerpHue(from.h, to.h, t);
  const rad = (h * Math.PI) / 180;
  const [r, g, b] = oklabToLinearRgb([l, c * Math.cos(rad), c * Math.sin(rad)]);
  // ブラウザの gamut mapping (chroma を保ちつつ彩度を落とす反復アルゴリズム) の簡易近似としてクランプする。
  // クランプは境界色を実際より僅かに彩度低下させる方向にしか働かず、コントラスト計算を悲観的に倒さない。
  return [
    Math.round(linearToSrgb(r) * 255),
    Math.round(linearToSrgb(g) * 255),
    Math.round(linearToSrgb(b) * 255),
  ];
}

// background-color の合成は CSS の既定 (sRGB のエンコード済み値上でのアルファブレンド) に従う。
// WCAG のコントラスト計算例 (G18) と同じ前提。
function blendWithWhite([r, g, b]: Rgb, alpha: number): Rgb {
  const mix = (channel: number) => Math.round(channel * (1 - alpha) + 255 * alpha);
  return [mix(r), mix(g), mix(b)];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const [rl, gl, bl] = [r / 255, g / 255, b / 255].map(srgbToLinear);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(rgbA: Rgb, rgbB: Rgb): number {
  const lA = relativeLuminance(rgbA);
  const lB = relativeLuminance(rgbB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

const TOKENS = Object.keys(GRADIENT_PALETTE) as GradientColorToken[];

function allUnorderedPairs<T>(items: readonly T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

const TEXT_RGB = hexToRgb01(TEXT_COLOR).map((c) => c * 255) as unknown as Rgb;

// グラデーション上のどの位置に文字が乗っても基準を満たす必要があるため、t を細かくサンプルし最悪値を取る。
function worstContrastAlongGradient(fromHex: string, toHex: string): number {
  let worst = Infinity;
  for (let i = 0; i <= SAMPLE_STEPS; i++) {
    const t = i / SAMPLE_STEPS;
    const background = blendWithWhite(mixOklch(fromHex, toHex, t), WHITE_OVERLAY_ALPHA);
    worst = Math.min(worst, contrastRatio(TEXT_RGB, background));
  }
  return worst;
}

describe('企画カード配色の全組み合わせコントラスト (要件 3.7)', () => {
  it.each(allUnorderedPairs(TOKENS))(
    '%s × %s: グラデーション全域で文字 4.5:1 以上 (アイコンの 3:1 も同色のため同時に満たす)',
    (a, b) => {
      const worst = worstContrastAlongGradient(GRADIENT_PALETTE[a], GRADIENT_PALETTE[b]);
      expect(worst).toBeGreaterThanOrEqual(4.5);
    },
  );
});
