import { bboxRadius, infRadius, pad, shapeFits } from './geometry';
import type { PlacedShape, PlacementInput } from './types';

export interface ReuseResult {
  visible: readonly PlacedShape[];
  dropped: readonly PlacedShape[];
}

/**
 * 検索結果・0件・空状態など、同じ URL の状態違い画面向けの流用モード。
 * 元の配置 (`base`) をそのまま使い、この画面の除外領域・障害物に反する図形だけを
 * 落とす。位置・サイズ・回転・質感は一切変えない。∞ の下限1個はこのモードでは
 * 検査しない (ちらつき防止のため、条件ごとに配置し直さないのが前提)。
 */
export function filterForObstacles(
  base: readonly PlacedShape[],
  input: PlacementInput,
): ReuseResult {
  const obstaclePad = pad([...input.text, ...input.noOverlap], 10);
  const opaque = input.opaque;

  const visible: PlacedShape[] = [];
  const dropped: PlacedShape[] = [];

  for (const shape of base) {
    const r =
      shape.tier === 'Inf' ? infRadius(shape.size) : bboxRadius(shape.size);
    const xOverflow = shape.tier === 'L' ? 0.4 * shape.size : 0;
    const ok = shapeFits(
      shape.cx,
      shape.cy,
      r,
      input.width,
      input.decorTop,
      input.decorBottom,
      xOverflow,
      obstaclePad,
      opaque,
    );
    (ok ? visible : dropped).push(shape);
  }

  return { visible, dropped };
}
