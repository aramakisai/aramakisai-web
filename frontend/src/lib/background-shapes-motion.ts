import type { PlacedShape, Tier } from './background-shapes/types';

// 入場 (design.md「動き」、要件 10.1〜10.2)
export const ENTRY_EASING = 'cubic-bezier(0.16, 0.84, 0.44, 1)';
export const INTERSECTION_THRESHOLD = 0.15;
export const RING_SECOND_ENTRY_DELAY_MS = 150;

// 階層ごとの入場距離・所要時間・揺れの変位上限 (要件 10.1, 10.3)。∞ は L の値を使う
interface TierMotionRange {
  entryMin: number;
  entryMax: number;
  entryDurationMs: number;
  dispMin: number;
  dispMax: number;
}
const TIER_RANGES: Record<Tier, TierMotionRange> = {
  S: {
    entryMin: 120,
    entryMax: 280,
    entryDurationMs: 1000,
    dispMin: 24,
    dispMax: 40,
  },
  L: {
    entryMin: 80,
    entryMax: 160,
    entryDurationMs: 1400,
    dispMin: 8,
    dispMax: 16,
  },
  Inf: {
    entryMin: 80,
    entryMax: 160,
    entryDurationMs: 1400,
    dispMin: 8,
    dispMax: 16,
  },
};

export function entryDurationMs(tier: Tier): number {
  return TIER_RANGES[tier].entryDurationMs;
}

// 揺れ (ポインター反発・スクロール慣性・ばね)。反発半径は階層に依らず共通 (要件 10.3)
export const POINTER_ACTIVE_WINDOW_MS = 120;
export const REPULSE_RADIUS_MIN = 160;
export const REPULSE_RADIUS_MAX = 240;
export const REPULSE_MAX_ACCEL = 1600;
export const SCROLL_GLOBAL_COEFF = 2.4;
export const SCROLL_SHAPE_COEFF_MIN = 0.5;
export const SCROLL_SHAPE_COEFF_MAX = 1.3;
export const SPRING_STIFFNESS_MIN = 70;
export const SPRING_STIFFNESS_MAX = 130;
export const SPRING_DAMPING_MIN = 10;
export const SPRING_DAMPING_MAX = 16;
export const SETTLE_THRESHOLD = 0.05;
export const MAX_FRAME_DT_MS = 50;
export const OFFSCREEN_MARGIN_PX = 60;

// FNV-1a 32bit。exhibition-color.ts / rng.ts と同じ方式だが、ここでは図形ごとに
// 乱数列を続けて引く必要が無く単発の値で足りるため、mulberry32 のような PRNG
// ストリームは持たず一撃のハッシュのみを複製する
function hashUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export interface SectionRect {
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

/**
 * `<main>` 直下のセクション要素の矩形を、背景の図形装飾の座標系 (ページ左上原点、
 * scrollY を加えた「ドキュメント座標」) に揃えて集める。
 */
export function collectSectionRects(mainEl: Element): SectionRect[] {
  const scrollY = window.scrollY;
  return Array.from(mainEl.children)
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({
      top: rect.top + scrollY,
      bottom: rect.bottom + scrollY,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + scrollY + rect.height / 2,
    }));
}

/**
 * y 座標を含むセクションの中心を返す。計測誤差やセクション間の余白で
 * 直下のセクションが見つからない場合は最も近いセクションで代用する。
 */
export function findSectionCenter(
  y: number,
  sections: readonly SectionRect[],
): { x: number; y: number } | undefined {
  const containing = sections.find((s) => y >= s.top && y < s.bottom);
  if (containing) return { x: containing.centerX, y: containing.centerY };
  if (sections.length === 0) return undefined;

  let nearest = sections[0];
  let nearestDist = Math.min(
    Math.abs(y - nearest.top),
    Math.abs(y - nearest.bottom),
  );
  for (const s of sections.slice(1)) {
    const dist = Math.min(Math.abs(y - s.top), Math.abs(y - s.bottom));
    if (dist < nearestDist) {
      nearest = s;
      nearestDist = dist;
    }
  }
  return { x: nearest.centerX, y: nearest.centerY };
}

export interface EntryOffset {
  dx: number;
  dy: number;
  delayMs: number;
}

function entryDistance(tier: Tier, seed: string): number {
  const { entryMin, entryMax } = TIER_RANGES[tier];
  return entryMin + hashUnit(seed) * (entryMax - entryMin);
}

/**
 * L・S の図形ごとに、定位置からセクション中心と反対方向へ階層別の距離だけ
 * ずれた入場の起点を決定的に求める (要件 10.1)。∞ の外側要素は入場の移動を
 * 持たない (2 つの輪だけが動く。`infRingEntryOffsets` 参照) ため常に原点を返す。
 * 同じ shapes 配列に対して常に同じ結果を返す純粋関数。
 */
export function computeEntryOffsets(
  shapes: readonly PlacedShape[],
  sections: readonly SectionRect[],
): EntryOffset[] {
  return shapes.map((shape, i) => {
    if (shape.tier === 'Inf') return { dx: 0, dy: 0, delayMs: 0 };

    const center = findSectionCenter(shape.cy, sections);
    const baseAngle = center
      ? Math.atan2(shape.cy - center.y, shape.cx - center.x)
      : 0;
    const distance = entryDistance(shape.tier, `${i}:${shape.cx}:${shape.cy}`);
    return {
      dx: Math.cos(baseAngle) * distance,
      dy: Math.sin(baseAngle) * distance,
      delayMs: 0,
    };
  });
}

/**
 * ∞ の 2 つの輪それぞれの入場オフセットを、外側要素の局所座標 (回転前) で返す
 * (要件 10.2)。輪は外側要素の中に絶対配置されており、外側要素の CSS
 * 回転がそのまま子要素に伝わるため、ここでは水平方向 (ローカル x 軸) の
 * 移動量だけを返せば「局所 x 軸方向から寄せる」が満たされる。
 */
export function infRingEntryOffsets(
  index: number,
): readonly [EntryOffset, EntryOffset] {
  const dist1 = entryDistance('Inf', `${index}:inf1`);
  const dist2 = entryDistance('Inf', `${index}:inf2`);
  return [
    { dx: -dist1, dy: 0, delayMs: 0 },
    { dx: dist2, dy: 0, delayMs: RING_SECOND_ENTRY_DELAY_MS },
  ];
}

export interface ShapeMotionParams {
  stiffness: number;
  damping: number;
  scrollCoeff: number;
  repulseRadius: number;
  displacementClamp: number;
}

/** ばねの挙動を図形ごとにばらつかせるパラメータ (design.md「入場後の静止と揺れ」)。 */
export function deriveShapeMotionParams(
  shape: PlacedShape,
  index: number,
): ShapeMotionParams {
  const { dispMin, dispMax } = TIER_RANGES[shape.tier];
  const seed = `${index}:${shape.tier}:${shape.cx}:${shape.cy}:${shape.size}`;
  return {
    stiffness:
      SPRING_STIFFNESS_MIN +
      hashUnit(`${seed}:k`) * (SPRING_STIFFNESS_MAX - SPRING_STIFFNESS_MIN),
    damping:
      SPRING_DAMPING_MIN +
      hashUnit(`${seed}:c`) * (SPRING_DAMPING_MAX - SPRING_DAMPING_MIN),
    scrollCoeff:
      SCROLL_SHAPE_COEFF_MIN +
      hashUnit(`${seed}:s`) * (SCROLL_SHAPE_COEFF_MAX - SCROLL_SHAPE_COEFF_MIN),
    repulseRadius:
      REPULSE_RADIUS_MIN +
      hashUnit(`${seed}:r`) * (REPULSE_RADIUS_MAX - REPULSE_RADIUS_MIN),
    displacementClamp: dispMin + hashUnit(`${seed}:d`) * (dispMax - dispMin),
  };
}

export interface SpringState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * 定位置を原点とした 2D ばね 1 ステップぶんの積分 (半陰的オイラー法)。
 * accel は反発などの外力、stiffness/damping がばね自体の復元力・減衰を担う。
 */
export function stepSpring(
  state: SpringState,
  accel: { ax: number; ay: number },
  stiffness: number,
  damping: number,
  dtSeconds: number,
): SpringState {
  const ax = accel.ax - stiffness * state.x - damping * state.vx;
  const ay = accel.ay - stiffness * state.y - damping * state.vy;
  const vx = state.vx + ax * dtSeconds;
  const vy = state.vy + ay * dtSeconds;
  return { x: state.x + vx * dtSeconds, y: state.y + vy * dtSeconds, vx, vy };
}

/**
 * ポインターに近い図形ほど強く押しのける加速度。最接近点で maxAccel、
 * 半径の境界で 0 へ線形に減衰する。
 */
export function computeRepulsionAccel(
  shapePos: { x: number; y: number },
  pointerPos: { x: number; y: number },
  radius: number,
  maxAccel: number,
): { ax: number; ay: number } {
  const dx = shapePos.x - pointerPos.x;
  const dy = shapePos.y - pointerPos.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { ax: maxAccel, ay: 0 };
  if (dist >= radius) return { ax: 0, ay: 0 };
  const strength = maxAccel * (1 - dist / radius);
  return { ax: (dx / dist) * strength, ay: (dy / dist) * strength };
}

/**
 * スクロール量 (px, 下方向が正) に対する速度への加算量。
 * 下方向のスクロールでは図形を相対的に上へ取り残すため負の値を返す。
 */
export function scrollVelocityImpulse(
  scrollDeltaPx: number,
  shapeCoeff: number,
): number {
  return -scrollDeltaPx * shapeCoeff * SCROLL_GLOBAL_COEFF;
}

/** 変位を図形ごとの上限でクランプする。 */
export function clampDisplacement(
  x: number,
  y: number,
  max: number,
): { x: number; y: number } {
  const dist = Math.hypot(x, y);
  if (dist <= max || dist === 0) return { x, y };
  const scale = max / dist;
  return { x: x * scale, y: y * scale };
}

/** 変位・速度がいずれも閾値を下回ったら静止とみなす (design.md「入場後の静止と揺れ」)。 */
export function isSettled(
  state: SpringState,
  threshold = SETTLE_THRESHOLD,
): boolean {
  return (
    Math.hypot(state.x, state.y) < threshold &&
    Math.hypot(state.vx, state.vy) < threshold
  );
}

/** 1 フレームあたりの経過時間を上限でクランプする (design.md「共通」)。 */
export function clampFrameDt(dtMs: number, max = MAX_FRAME_DT_MS): number {
  return Math.min(dtMs, max);
}

/**
 * ビューポート上下の余白を超えて画面外にある図形か。判定はビューポート座標の
 * 縦方向のみで、横方向のはみ出しは無視する (design.md「共通」)。
 */
export function isOffscreenVertically(
  topPx: number,
  bottomPx: number,
  viewportHeight: number,
  margin = OFFSCREEN_MARGIN_PX,
): boolean {
  return bottomPx < -margin || topPx > viewportHeight + margin;
}
