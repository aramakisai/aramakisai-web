import { LG_BREAKPOINT_PX } from './breakpoints';

export const SHAPE_KINDS = [
  'circle',
  'semicircle',
  'quarterCircle',
  'triangle',
  'square',
  'roundedSquare',
  'ring',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

// tailwind.config.ts の bansai-* と同じ名前 (要件 23.4)。値そのものはここでは持たず、
// 描画側が Tailwind クラスへ変換する。
export const SHAPE_COLOR_TOKENS = [
  'bansai-ochre',
  'bansai-olive',
  'bansai-sage',
  'bansai-salmon',
  'bansai-rose',
  'bansai-wisteria',
  'bansai-aqua',
] as const;
export type ShapeColorToken = (typeof SHAPE_COLOR_TOKENS)[number];

export const SHAPE_TEXTURES = ['none', 'noise', 'halftone', 'cloud'] as const;
export type ShapeTexture = (typeof SHAPE_TEXTURES)[number];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackgroundShapePlacementInput {
  pathname: string;
  pageHeight: number;
  viewportWidth: number;
  // 文字・操作要素・写真セクション・フッター地など、図形を重ねてはいけない矩形の一覧。
  // 外側 10px の除外マージンはこの関数が付与する
  excludeRects: readonly Rect[];
}

export interface PlacedShape {
  kind: ShapeKind;
  size: number;
  x: number;
  y: number;
  rotation: number;
  color: ShapeColorToken;
  texture: ShapeTexture;
  // kind === 'ring' の組の中での役割 (Figma 342:2151/342:2152)。それ以外の kind では undefined
  ringVariant?: 'primary' | 'secondary';
  // ring 用。2 つ目 (secondary) の線幅は自身の size ではなく組の 1 つ目 (primary) の
  // size を基準にした絶対値になる (Figma 342:2152 の stroke-width は 342:2151 と同じ px)
  ringStrokeWidth?: number;
  // ring の secondary のみ 0.65 (Figma 342:2152)。未指定は不透明 (1) として扱う
  opacity?: number;
}

const MIN_SIZE = 22;
const MAX_SIZE = 104;
const MIN_GAP_BASE = 70;
const EXCLUDE_MARGIN = 10;
const PX_PER_SHAPE_PC = 110;
const SP_DENSITY_FACTOR = 0.7;
const MIN_COUNT = 4;
const TRIAL_MULTIPLIER = 60;
const EDGE_OVERHANG_RATIO = 0.3;
// 二重リングの secondary (Figma 342:2152) を primary (342:2151, size=64 基準) に対する
// 比率で表す。design.md 記載の (7px, 6px) は Figma の実測値と食い違うため、Figma を正とする。
// RingB: 43.52/64 = 0.68、中心オフセット (+21.76, +21.76)/64 = 0.34、線幅は絶対値で
// primary と共通 (10.24 = 64×0.16、secondary 自身の size には比例しない)
const RING_STROKE_RATIO = 0.16;
const RING_B_SIZE_RATIO = 0.68;
const RING_B_OFFSET_RATIO = 0.34;
const RING_B_OPACITY = 0.65;

// FNV-1a 32bit と mulberry32 PRNG。exhibition-color.ts (企画カードのグラデーション) と
// 同じ方式を、種をページパスに変えて用いる (design.md 参照)。乱数生成器自体は
// モジュールごとに閉じているため独立して複製している。
function fnv1a(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

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

function inflate(rect: Rect, margin: number): Rect {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

// 回転後の軸並行外接矩形の一辺 (要件 23.28)
function rotatedAabbSize(size: number, rotationDeg: number): number {
  const rad = (rotationDeg * Math.PI) / 180;
  return size * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)));
}

function centeredRect(cx: number, cy: number, side: number): Rect {
  return { x: cx - side / 2, y: cy - side / 2, width: side, height: side };
}

// 5 枠中「質感なし」2・他 3 種各 1 (要件 23.14)
function pickTexture(rng: () => number): ShapeTexture {
  const slot = Math.floor(rng() * 5);
  if (slot < 2) return 'none';
  return SHAPE_TEXTURES[slot - 1];
}

interface Candidate {
  shapes: PlacedShape[];
  aabbRects: Rect[];
  // 図形どうしの間隔判定は回転前のサイズと中心座標のみを使う (要件 23.28)
  gapPoints: { x: number; y: number; size: number }[];
}

function buildCandidate(
  rng: () => number,
  viewportWidth: number,
  pageHeight: number,
): Candidate {
  const size = Math.floor(MIN_SIZE + rng() * (MAX_SIZE - MIN_SIZE));
  const kind = SHAPE_KINDS[Math.floor(rng() * SHAPE_KINDS.length)];
  const color =
    SHAPE_COLOR_TOKENS[Math.floor(rng() * SHAPE_COLOR_TOKENS.length)];
  const texture = pickTexture(rng);
  const rotation = Math.floor(rng() * 360);

  // 左右端は一辺の 30% までのはみ出しを許容する (要件 23.9)。上下端はページ高そのものが
  // コンテンツ全高であり、はみ出しの受け皿が無いため範囲内に収める
  const xRange = Math.max(0, viewportWidth - EDGE_OVERHANG_RATIO * 2 * size);
  const leftEdge = -EDGE_OVERHANG_RATIO * size + rng() * xRange;
  const cx = leftEdge + size / 2;

  const yRange = Math.max(0, pageHeight - size);
  const topEdge = rng() * yRange;
  const cy = topEdge + size / 2;

  const aabbSide = rotatedAabbSize(size, rotation);

  if (kind !== 'ring') {
    const shape: PlacedShape = {
      kind,
      size,
      x: cx,
      y: cy,
      rotation,
      color,
      texture,
    };
    return {
      shapes: [shape],
      aabbRects: [centeredRect(cx, cy, aabbSide)],
      gapPoints: [{ x: cx, y: cy, size }],
    };
  }

  // リングには質感を割り当てず、2 つ 1 組で少し重ねて配置する (要件 23.14, 23.17)
  const strokeWidth = size * RING_STROKE_RATIO;
  const secondSize = size * RING_B_SIZE_RATIO;
  const offset = size * RING_B_OFFSET_RATIO;
  const secondCx = cx + offset;
  const secondCy = cy + offset;
  const secondAabbSide = rotatedAabbSize(secondSize, rotation);

  const first: PlacedShape = {
    kind,
    size,
    x: cx,
    y: cy,
    rotation,
    color,
    texture: 'none',
    ringVariant: 'primary',
    ringStrokeWidth: strokeWidth,
  };
  const second: PlacedShape = {
    kind,
    size: secondSize,
    x: secondCx,
    y: secondCy,
    rotation,
    color,
    texture: 'none',
    ringVariant: 'secondary',
    ringStrokeWidth: strokeWidth,
    opacity: RING_B_OPACITY,
  };
  return {
    shapes: [first, second],
    aabbRects: [
      centeredRect(cx, cy, aabbSide),
      centeredRect(secondCx, secondCy, secondAabbSide),
    ],
    gapPoints: [
      { x: cx, y: cy, size },
      { x: secondCx, y: secondCy, size: secondSize },
    ],
  };
}

/**
 * ページのパス・高さ・画面幅・除外領域から、背景の図形装飾の配置を決定的に計算する。
 * 同じ入力に対して常に同じ結果を返す純粋関数 (要件 23.13)。
 */
export function computeBackgroundShapePlacement(
  input: BackgroundShapePlacementInput,
): PlacedShape[] {
  const { pathname, pageHeight, viewportWidth, excludeRects } = input;
  const rng = mulberry32(fnv1a(pathname));

  const isPc = viewportWidth >= LG_BREAKPOINT_PX;
  const density = isPc ? 1 : SP_DENSITY_FACTOR;
  const targetCount = Math.max(
    MIN_COUNT,
    Math.round((pageHeight / PX_PER_SHAPE_PC) * density),
  );
  const maxTrials = targetCount * TRIAL_MULTIPLIER;
  const paddedExcludes = excludeRects.map((rect) =>
    inflate(rect, EXCLUDE_MARGIN),
  );

  const placed: PlacedShape[] = [];
  const gapPoints: { x: number; y: number; size: number }[] = [];

  for (
    let trial = 0;
    trial < maxTrials && placed.length < targetCount;
    trial++
  ) {
    const candidate = buildCandidate(rng, viewportWidth, pageHeight);

    const overlapsExclude = candidate.aabbRects.some((rect) =>
      paddedExcludes.some((exclude) => rectsOverlap(rect, exclude)),
    );
    if (overlapsExclude) continue;

    const tooClose = candidate.gapPoints.some((point) =>
      gapPoints.some((existing) => {
        const minGap = MIN_GAP_BASE + (point.size + existing.size) / 4;
        return Math.hypot(point.x - existing.x, point.y - existing.y) < minGap;
      }),
    );
    if (tooClose) continue;

    placed.push(...candidate.shapes);
    gapPoints.push(...candidate.gapPoints);
  }

  return placed;
}
