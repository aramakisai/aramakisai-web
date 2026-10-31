'use client';

import { useCallback } from 'react';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { computeMapFitOptions } from '@/components/map/map-fit-options';
import { MapViewportController } from '@/components/map/map-viewport-controller';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';

const CAMPUS_MAX_BOUNDS =
  CAMPUS_MAP_CONFIG.bounds as unknown as LatLngBoundsExpression;

/** 会場マップの公開APIと既存設定を保つ薄いラッパー。 */
export function MapViewportSync({
  fitBounds,
  bottomInset = 0,
  focusCenter,
  focusKey,
  refocusKey,
}: {
  readonly fitBounds: LatLngBoundsExpression;
  /** 地図の下に重なって浮く操作部品の高さ。その分を避けて合わせる */
  readonly bottomInset?: number;
  readonly focusCenter: LatLngExpression | null;
  readonly focusKey: number | null;
  readonly refocusKey: string;
}) {
  const resolveFitOptions = useCallback(
    (container: HTMLElement) => computeMapFitOptions(container, bottomInset),
    [bottomInset],
  );

  return (
    <MapViewportController
      fitBounds={fitBounds}
      maxBounds={CAMPUS_MAX_BOUNDS}
      minZoom={CAMPUS_MAP_CONFIG.minZoom}
      fitOptions={resolveFitOptions}
      focusCenter={focusCenter}
      focusKey={focusKey}
      focusZoom={CAMPUS_MAP_CONFIG.maxNativeZoom}
      focusFitOptions={resolveFitOptions}
      refocusKey={refocusKey}
    />
  );
}
