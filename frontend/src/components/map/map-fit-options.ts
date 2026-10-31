import type { FitBoundsOptions } from 'leaflet';

// ラベルやマーカーが画面端に接しないよう取る余白
const FIT_MARGIN = 32;

// PC ではサイドパネルが地図の左に重なって浮くため、パネル右端より右を可視領域として合わせる
export function computeMapFitOptions(
  container: HTMLElement,
  bottomInset: number,
): FitBoundsOptions {
  const panel = document
    .querySelector('[data-map-side-panel]')
    ?.getBoundingClientRect();
  const left = panel?.width
    ? Math.max(0, panel.right - container.getBoundingClientRect().left)
    : 0;
  return {
    paddingTopLeft: [left + FIT_MARGIN, FIT_MARGIN],
    // 下側はシートの角丸の裏に潜る 16px 分を足す
    paddingBottomRight: [FIT_MARGIN, FIT_MARGIN + 16 + bottomInset],
    animate: false,
  };
}
