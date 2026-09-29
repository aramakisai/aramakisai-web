import type { Rect } from './types';

/**
 * 図形は回転後の外接円 (中心と半径) 1 つで表す。回転しても外接円自体は中心まわりの
 * 回転で不変なので、判定はすべて円と矩形・円と円の閉形式の最短距離だけで済む
 * (格子標本化・面積比・可視率・ガター判定は行わない)。
 */

export function bboxRadius(s: number): number {
  return (s * Math.sqrt(2)) / 2;
}

export function infBbox(D: number): [w: number, h: number] {
  return [0.74 * D + D, D];
}

export function infRadius(D: number): number {
  const [w, h] = infBbox(D);
  return 0.5 * Math.hypot(w, h);
}

export function circleIntersectsRect(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): boolean {
  const nearestX = Math.min(Math.max(cx, rect.x), rect.x + rect.w);
  const nearestY = Math.min(Math.max(cy, rect.y), rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

function circleIntersectsAny(
  cx: number,
  cy: number,
  r: number,
  rects: readonly Rect[],
): boolean {
  for (const rect of rects) {
    if (circleIntersectsRect(cx, cy, r, rect)) return true;
  }
  return false;
}

interface PlacedCircle {
  cx: number;
  cy: number;
  r: number;
}

export function collisionOk(
  cx: number,
  cy: number,
  r: number,
  placed: readonly PlacedCircle[],
  gap: number,
): boolean {
  for (const p of placed) {
    if (Math.hypot(cx - p.cx, cy - p.cy) < r + p.r + gap) return false;
  }
  return true;
}

/**
 * 装飾範囲の外に出ていないか・横のはみ出しが許容量以内か・不透明な面と
 * 重ならないかをまとめて判定する。図形同士の間隔 (collisionOk) は配置順に
 * 依存するためここには含めない。
 */
export function shapeFits(
  cx: number,
  cy: number,
  r: number,
  width: number,
  decorTop: number,
  decorBottom: number,
  xOverflow: number,
  opaque: readonly Rect[],
): boolean {
  if (cy - r < decorTop - 1e-6 || cy + r > decorBottom + 1e-6) return false;
  if (cx - r < -xOverflow - 1e-6 || cx + r > width + xOverflow + 1e-6)
    return false;
  if (circleIntersectsAny(cx, cy, r, opaque)) return false;
  return true;
}
