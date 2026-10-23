import {
  drawTexturePosition,
  drawTextureRotation,
  fnv1a,
  mulberry32,
} from './background-shapes/rng';
import type { TextureId } from './background-shapes/types';

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

const TEXTURES: readonly TextureId[] = [
  'watercolor',
  'streak',
  'gradient',
  'grain',
];

/** 企画カード下部の地。質感と原画上の位置 (background-position の x, y: %) を企画名から決める */
export function getExhibitionTexture(name: string): {
  readonly texture: TextureId;
  readonly position: readonly [number, number];
  readonly rotation: number;
} {
  const rng = mulberry32(fnv1a(name));
  const texture = TEXTURES[Math.floor(rng() * TEXTURES.length)];
  const position = drawTexturePosition(rng);
  return { texture, position, rotation: drawTextureRotation(rng) };
}
