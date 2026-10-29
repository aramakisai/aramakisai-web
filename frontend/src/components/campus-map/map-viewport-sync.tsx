'use client';

import { useCallback } from 'react';
import type { FitBoundsOptions, LatLngBoundsExpression } from 'leaflet';
import { MapViewportController } from '@/components/map/map-viewport-controller';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';

const CAMPUS_MAX_BOUNDS =
  CAMPUS_MAP_CONFIG.bounds as unknown as LatLngBoundsExpression;

// エリアのラベルやマーカーが画面端に接しないよう取る余白
const FIT_MARGIN = 32;

// PC ではサイドパネルが地図の左に重なって浮くため、パネル右端より右を可視領域として合わせる
function fitOptions(
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
/** 会場マップの公開APIと既存設定を保つ薄いラッパー。 */
export function MapViewportSync({
  fitBounds,
  bottomInset = 0,
}: {
  readonly fitBounds: LatLngBoundsExpression;
  /** 地図の下に重なって浮く操作部品の高さ。その分を避けて合わせる */
  readonly bottomInset?: number;
}) {
  const resolveFitOptions = useCallback(
    (container: HTMLElement) => fitOptions(container, bottomInset),
    [bottomInset],
  );

  return (
    <MapViewportController
      fitBounds={fitBounds}
      maxBounds={CAMPUS_MAX_BOUNDS}
      minZoom={CAMPUS_MAP_CONFIG.minZoom}
      fitOptions={resolveFitOptions}
    />
  );
}
