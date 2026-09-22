import type { PlacedShape } from './background-shapes';

// 入場 (design.md「動き」)
export const ENTRY_MIN_OFFSET = 40;
export const ENTRY_MAX_OFFSET = 120;
export const ENTRY_DURATION_MS = 1000;
export const ENTRY_EASING = 'cubic-bezier(0.16, 0.84, 0.44, 1)';
export const INTERSECTION_THRESHOLD = 0.15;
export const RING_SECOND_ENTRY_DELAY_MS = 100;
// リング 2 つの起点方向を「基準の角度からおよそ±0.7rad ばらけた、ほぼ反対の方向」にする
// (design.md)。primary はセクション中心から自身への角度そのもの、secondary はその
// 180 度反対側を基準に、双方を独立にこの範囲でばらけさせる
const RING_JITTER_RAD = 0.7;

// 揺れ (ポインター反発・スクロール慣性・ばね)
export const POINTER_ACTIVE_WINDOW_MS = 120;
export const REPULSE_RADIUS_MIN = 120;
export const REPULSE_RADIUS_MAX = 180;
export const REPULSE_MAX_ACCEL = 1600;
export const SCROLL_GLOBAL_COEFF = 2.4;
export const SCROLL_SHAPE_COEFF_MIN = 0.5;
export const SCROLL_SHAPE_COEFF_MAX = 1.3;
export const SPRING_STIFFNESS_MIN = 70;
export const SPRING_STIFFNESS_MAX = 130;
export const SPRING_DAMPING_MIN = 10;
export const SPRING_DAMPING_MAX = 16;
export const DISPLACEMENT_CLAMP_MIN = 8;
export const DISPLACEMENT_CLAMP_MAX = 16;
export const SETTLE_THRESHOLD = 0.05;
export const MAX_FRAME_DT_MS = 50;
export const OFFSCREEN_MARGIN_PX = 60;

// FNV-1a 32bit。exhibition-color.ts / background-shapes.ts と同じ方式だが、ここでは
// 図形ごとに乱数列を続けて引く必要が無く単発の値で足りるため、mulberry32 のような
// PRNG ストリームは持たず一撃のハッシュのみを複製する
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
 * exclude-rects.ts と同じく scrollY を加えた「ドキュメント座標」) に揃えて集める。
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

function entryDistance(seed: string): number {
  return (
    ENTRY_MIN_OFFSET + hashUnit(seed) * (ENTRY_MAX_OFFSET - ENTRY_MIN_OFFSET)
  );
}

/**
 * 図形ごとに、定位置からセクション中心と反対方向へ 40〜120px ずれた入場の起点を
 * 決定的に求める (要件 23.15)。リングの組は互いに異なる、ほぼ反対の方向から
 * 寄せる (要件 23.17)。同じ shapes 配列に対して常に同じ結果を返す純粋関数。
 */
export function computeEntryOffsets(
  shapes: readonly PlacedShape[],
  sections: readonly SectionRect[],
): EntryOffset[] {
  const offsets: EntryOffset[] = new Array(shapes.length);

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const next = shapes[i + 1];
    const center = findSectionCenter(shape.y, sections);
    const baseAngle = center
      ? Math.atan2(shape.y - center.y, shape.x - center.x)
      : 0;

    if (
      shape.kind === 'ring' &&
      shape.ringVariant === 'primary' &&
      next?.kind === 'ring' &&
      next.ringVariant === 'secondary'
    ) {
      const jitterA = hashUnit(`${i}:ringA:${shape.x}:${shape.y}`) * 2 - 1;
      const jitterB = hashUnit(`${i}:ringB:${shape.x}:${shape.y}`) * 2 - 1;
      const distA = entryDistance(`${i}:ringA-d:${shape.x}:${shape.y}`);
      const distB = entryDistance(`${i}:ringB-d:${shape.x}:${shape.y}`);
      const angleA = baseAngle + jitterA * RING_JITTER_RAD;
      const angleB = baseAngle + Math.PI + jitterB * RING_JITTER_RAD;
      offsets[i] = {
        dx: Math.cos(angleA) * distA,
        dy: Math.sin(angleA) * distA,
        delayMs: 0,
      };
      offsets[i + 1] = {
        dx: Math.cos(angleB) * distB,
        dy: Math.sin(angleB) * distB,
        delayMs: RING_SECOND_ENTRY_DELAY_MS,
      };
      i++;
      continue;
    }

    const distance = entryDistance(`${i}:${shape.x}:${shape.y}`);
    offsets[i] = {
      dx: Math.cos(baseAngle) * distance,
      dy: Math.sin(baseAngle) * distance,
      delayMs: 0,
    };
  }

  return offsets;
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
  const seed = `${index}:${shape.kind}:${shape.x}:${shape.y}:${shape.size}`;
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
    displacementClamp:
      DISPLACEMENT_CLAMP_MIN +
      hashUnit(`${seed}:d`) * (DISPLACEMENT_CLAMP_MAX - DISPLACEMENT_CLAMP_MIN),
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
 * ポインターに近い図形ほど強く押しのける加速度 (要件 23.21)。最接近点で
 * maxAccel、半径の境界で 0 へ線形に減衰する。
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
 * スクロール量 (px, 下方向が正) に対する速度への加算量 (要件 23.23)。
 * 下方向のスクロールでは図形を相対的に上へ取り残すため負の値を返す。
 */
export function scrollVelocityImpulse(
  scrollDeltaPx: number,
  shapeCoeff: number,
): number {
  return -scrollDeltaPx * shapeCoeff * SCROLL_GLOBAL_COEFF;
}

/** 変位を図形ごとの上限でクランプする (要件 23.24)。 */
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
 * ビューポート上下の余白を超えて画面外にある図形か (要件 23.25)。判定は
 * ビューポート座標の縦方向のみで、横方向のはみ出しは無視する (design.md
 * 「ビューポート上下 60px の余白を超えた範囲」)。
 */
export function isOffscreenVertically(
  topPx: number,
  bottomPx: number,
  viewportHeight: number,
  margin = OFFSCREEN_MARGIN_PX,
): boolean {
  return bottomPx < -margin || topPx > viewportHeight + margin;
}
