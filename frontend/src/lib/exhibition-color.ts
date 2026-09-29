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

const TOKENS = Object.keys(GRADIENT_PALETTE) as GradientColorToken[];

export interface ExhibitionGradient {
  readonly from: GradientColorToken;
  readonly to: GradientColorToken;
  readonly fromColor: string;
  readonly toColor: string;
  readonly angle: number;
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
}

// from/to/angle の 3 回の乱数消費は getExhibitionGradient と同じ手順を踏む (乱数列の続きから
// 質感を引くため)。呼び出し側は必要なら getExhibitionGradient も別途呼んで色を取得する
function drawColorAndAngle(rng: () => number) {
  const from = TOKENS[Math.floor(rng() * TOKENS.length)];
  const rest = TOKENS.filter((token) => token !== from);
  const to = rest[Math.floor(rng() * rest.length)];
  const angle = Math.floor(rng() * 360);
  return { from, to, angle };
}

export function getExhibitionGradient(name: string): ExhibitionGradient {
  const rng = mulberry32(fnv1a(name));
  const { from, to, angle } = drawColorAndAngle(rng);

  return {
    from,
    to,
    fromColor: GRADIENT_PALETTE[from],
    toColor: GRADIENT_PALETTE[to],
    angle,
  };
}

export function getExhibitionAppearance(name: string): ExhibitionAppearance {
  const rng = mulberry32(fnv1a(name));
  const { from, to, angle } = drawColorAndAngle(rng);
  const texture = TEXTURES[Math.floor(rng() * TEXTURES.length)];

  return { from, to, angle, texture };
}
