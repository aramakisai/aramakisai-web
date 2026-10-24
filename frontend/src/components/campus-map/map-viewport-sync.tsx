'use client';

import type { FitBoundsOptions, LatLngBoundsExpression } from 'leaflet';
import { MapViewportController } from '@/components/map/map-viewport-controller';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';

const CAMPUS_MAX_BOUNDS =
  CAMPUS_MAP_CONFIG.bounds as unknown as LatLngBoundsExpression;

// 既存会場マップのfit余白。下側はシートの角丸の裏に潜る16px分を含む。
const CAMPUS_FIT_OPTIONS: FitBoundsOptions = {
  paddingTopLeft: [8, 8],
  paddingBottomRight: [8, 24],
  animate: false,
};

/** 会場マップの公開APIと既存設定を保つ薄いラッパー。 */
export function MapViewportSync({
  fitBounds,
}: {
  readonly fitBounds: LatLngBoundsExpression;
}) {
  return (
    <MapViewportController
      fitBounds={fitBounds}
      maxBounds={CAMPUS_MAX_BOUNDS}
      minZoom={CAMPUS_MAP_CONFIG.minZoom}
      fitOptions={CAMPUS_FIT_OPTIONS}
    />
  );
}
