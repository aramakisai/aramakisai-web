import { fnv1a, mulberry32 } from './background-shapes/rng';

export type GradientColorToken =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'accent-alt'
  | 'info'
  | 'success'
  | 'warning';

/**
 * Tailwind v4 を JS config 経由で使う本リポジトリでは `--color-*` の CSS カスタムプロパティが
 * 生成されないため、色値そのものをここで持つ。tailwind.config.ts の同名トークンと単体テストで一致を固定する。
 */
export const GRADIENT_PALETTE: Readonly<Record<GradientColorToken, string>> = {
  primary: '#ebb03c',
  secondary: '#7fc8ad',
  accent: '#ee7e84',
  'accent-alt': '#a18abf',
  info: '#80c1c6',
  success: '#8cb76b',
  warning: '#e86f30',
};

// パンフレット表紙の色相順 (環状)。隣り合う 2 色だけを組にして、補間でパレット外の色相を出さない
const HUE_ORDER: readonly GradientColorToken[] = [
  'warning',
  'primary',
  'success',
  'secondary',
  'info',
  'accent-alt',
  'accent',
];

export interface ExhibitionGradient {
  readonly from: GradientColorToken;
  readonly to: GradientColorToken;
  readonly fromColor: string;
  readonly toColor: string;
  readonly angle: number;
  // 水彩の溜まり (to 色の楕円) の中心 (%)
  readonly poolX: number;
  readonly poolY: number;
}

// 企画カードに重ねる無彩色の質感 (design.md ExhibitionCard 節)。'gradient' は質感画像を重ねない。
export type TextureFamily = 'gradient' | 'watercolor' | 'grainy' | 'halftone';
const TEXTURES: readonly TextureFamily[] = [
  'gradient',
  'watercolor',
  'grainy',
  'halftone',
];

export interface ExhibitionAppearance {
  readonly from: GradientColorToken;
  readonly to: GradientColorToken;
  readonly angle: number;
  readonly texture: TextureFamily;
  readonly texturePositionY: number;
  readonly textureFlipX: boolean;
  readonly textureFlipY: boolean;
}

// from/to/angle の 3 回の乱数消費は getExhibitionGradient と同じ手順を踏む (乱数列の続きから
// 質感を引くため)。呼び出し側は必要なら getExhibitionGradient も別途呼んで色を取得する
function drawColorAndAngle(rng: () => number) {
  const i = Math.floor(rng() * HUE_ORDER.length);
  const step = rng() < 0.5 ? 1 : -1;
  const from = HUE_ORDER[i];
  const to = HUE_ORDER[(i + step + HUE_ORDER.length) % HUE_ORDER.length];
  const angle = Math.floor(rng() * 360);
  return { from, to, angle };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function getExhibitionGradient(name: string): ExhibitionGradient {
  const rng = mulberry32(fnv1a(name));
  const { from, to, angle } = drawColorAndAngle(rng);

  const rad = (angle * Math.PI) / 180;

  return {
    from,
    to,
    fromColor: GRADIENT_PALETTE[from],
    toColor: GRADIENT_PALETTE[to],
    angle,
    poolX: round1(50 + 90 * Math.sin(rad)),
    poolY: round1(50 - 40 * Math.cos(rad)),
  };
}

export function getExhibitionAppearance(name: string): ExhibitionAppearance {
  const rng = mulberry32(fnv1a(name));
  const { from, to, angle } = drawColorAndAngle(rng);
  const texture = TEXTURES[Math.floor(rng() * TEXTURES.length)];

  // 1 枚の質感画像を全カードで共有するため、切り出し位置と反転を企画ごとに変えて同じ模様の繰り返しに見せない
  const texturePositionY = Math.floor(rng() * 101);
  const textureFlipX = rng() < 0.5;
  const textureFlipY = rng() < 0.5;

  return {
    from,
    to,
    angle,
    texture,
    texturePositionY,
    textureFlipX,
    textureFlipY,
  };
}
