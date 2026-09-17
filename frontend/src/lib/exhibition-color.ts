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

// FNV-1a 32bit。Figma のモックと同じ手順を Node/Workers/ブラウザ間で決定的に再現する。
function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// mulberry32 PRNG。乱数種が企画名のみに依存するため、呼び出しごとに同じ数列を返す。
function mulberry32(seed: number): () => number {
  let t = seed;
  return () => {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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
