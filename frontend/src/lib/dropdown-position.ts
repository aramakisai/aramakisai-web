export interface HorizontalRect {
  readonly left: number;
  readonly width: number;
}

/**
 * ドロップダウンの水平中央を item の中央に合わせつつ、bounds (コンテンツ枠) を
 * 越える側は bounds の端に揃えて止める。戻り値は item の左端からの相対オフセット (px) で、
 * item を親とする絶対配置要素の `left` にそのまま使える。
 */
export function computeDropdownOffset(
  item: HorizontalRect,
  bounds: HorizontalRect,
  dropdownWidth: number,
): number {
  const boundsRight = bounds.left + bounds.width;
  const itemCenter = item.left + item.width / 2;
  const desiredLeft = itemCenter - dropdownWidth / 2;
  const clampedLeft = Math.min(
    Math.max(desiredLeft, bounds.left),
    boundsRight - dropdownWidth,
  );
  return clampedLeft - item.left;
}
