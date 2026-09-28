import {
  pad,
  sampleInf,
  sampleShape,
  validInf,
  validL,
  validS,
} from './geometry';
import type { PlacedShape, PlacementInput } from './types';

export interface ReuseResult {
  visible: readonly PlacedShape[];
  dropped: readonly PlacedShape[];
}

/**
 * 検索結果・0件・空状態など、同じ URL の状態違い画面向けの流用モード。
 * 元の配置 (`base`) をそのまま使い、この画面の除外領域・文字・不透明な面・
 * 文字リンク等に反する図形だけを落とす。位置・サイズ・回転・質感は一切変えない。
 * ∞ の下限1個と4質感必須はこのモードでは検査しない (ちらつき防止のため、
 * 条件ごとに配置し直さないのが前提)。
 */
export function filterForObstacles(
  base: readonly PlacedShape[],
  input: PlacementInput,
): ReuseResult {
  const width = input.width;
  const decorTop = input.decorTop;
  const decorBottom = input.decorBottom;
  const textRaw = input.text;
  const opaque = input.opaque;
  const textPad = pad(textRaw, 10);
  const noOverlapPad = pad(input.noOverlap, 10);

  const visible: PlacedShape[] = [];
  const dropped: PlacedShape[] = [];

  for (const shape of base) {
    let ok: boolean;
    if (shape.tier === 'Inf') {
      const { px, py } = sampleInf(shape.size, shape.rot, shape.cx, shape.cy);
      ok = validInf(
        px,
        py,
        width,
        decorTop,
        decorBottom,
        noOverlapPad,
        textPad,
        opaque,
        shape.size,
        'hard',
      );
    } else if (shape.tier === 'L') {
      const { px, py } = sampleShape(
        shape.kind,
        shape.size,
        shape.rot,
        shape.cx,
        shape.cy,
      );
      ok = validL(
        px,
        py,
        width,
        decorTop,
        decorBottom,
        noOverlapPad,
        textRaw,
        opaque,
        shape.size,
      );
    } else {
      const { px, py } = sampleShape(
        shape.kind,
        shape.size,
        shape.rot,
        shape.cx,
        shape.cy,
      );
      ok = validS(
        px,
        py,
        width,
        decorTop,
        decorBottom,
        noOverlapPad,
        textPad,
        opaque,
        shape.size,
        0.0,
        'hard',
      );
    }
    (ok ? visible : dropped).push(shape);
  }

  return { visible, dropped };
}
