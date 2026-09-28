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

export function getExhibitionGradient(name: string): ExhibitionGradient {
  const rng = mulberry32(fnv1a(name));
  const from = TOKENS[Math.floor(rng() * TOKENS.length)];
  const rest = TOKENS.filter((token) => token !== from);
  const to = rest[Math.floor(rng() * rest.length)];
  const angle = Math.floor(rng() * 360);

  return {
    from,
    to,
    fromColor: GRADIENT_PALETTE[from],
    toColor: GRADIENT_PALETTE[to],
    angle,
  };
}
