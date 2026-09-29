/**
 * 図形は回転後の外接円 (中心と半径) 1 つで表す。回転しても外接円自体は中心まわりの
 * 回転で不変なので、判定はすべて円と円の閉形式の最短距離・単純な範囲比較だけで済む
 * (格子標本化・面積比・可視率判定は行わない)。
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
 * 装飾範囲の外に出ていないか・横のはみ出しが許容量以内かを判定する。
 * 図形同士の間隔 (collisionOk) は配置順に依存するためここには含めない。
 */
export function shapeFits(
  cx: number,
  cy: number,
  r: number,
  width: number,
  decorTop: number,
  decorBottom: number,
  xOverflow: number,
): boolean {
  if (cy - r < decorTop - 1e-6 || cy + r > decorBottom + 1e-6) return false;
  if (cx - r < -xOverflow - 1e-6 || cx + r > width + xOverflow + 1e-6)
    return false;
  return true;
}
