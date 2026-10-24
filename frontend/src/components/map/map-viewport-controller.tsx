'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { latLng, point } from 'leaflet';
import type {
  FitBoundsOptions,
  LatLngBoundsExpression,
  LatLngExpression,
  Point,
} from 'leaflet';

type MapFitOptions =
  FitBoundsOptions | ((container: HTMLElement) => FitBoundsOptions);

export interface MapViewportControllerProps {
  readonly fitBounds?: LatLngBoundsExpression;
  readonly initialCenter?: LatLngExpression;
  readonly initialZoom?: number;
  readonly focusCenter?: LatLngExpression | null;
  readonly focusKey?: string | number | null;
  readonly focusZoom?: number;
  readonly maxBounds: LatLngBoundsExpression;
  readonly minZoom: number;
  readonly minZoomPadding?: Point;
  readonly fitOptions: MapFitOptions;
  readonly fitOnMount?: boolean;
}

/**
 * コンテナの寸法変化へLeafletを追従させ、利用者が操作するまでは指定範囲を
 * panel・sheet用の余白込みでfitする。最大範囲を覆えるzoomを動的な下限にする。
 */
export function MapViewportController({
  fitBounds,
  initialCenter,
  initialZoom,
  focusCenter,
  focusKey,
  focusZoom,
  maxBounds,
  minZoom,
  minZoomPadding,
  fitOptions,
  fitOnMount = false,
}: MapViewportControllerProps) {
  const map = useMap();
  const interactedRef = useRef(false);
  const initialViewAppliedRef = useRef(false);
  const lastFocusKeyRef = useRef<string | number | null>(null);
  const normalizedFocusCenter =
    focusCenter == null ? null : latLng(focusCenter);
  const focusLatitude = normalizedFocusCenter?.lat ?? null;
  const focusLongitude = normalizedFocusCenter?.lng ?? null;

  useEffect(() => {
    const container = map.getContainer();
    const resolveFitOptions = () =>
      typeof fitOptions === 'function' ? fitOptions(container) : fitOptions;
    map.setMaxBounds(maxBounds);
    const applyMinZoom = () => {
      map.invalidateSize({ animate: false });
      const boundsZoom = minZoomPadding
        ? map.getBoundsZoom(maxBounds, true, minZoomPadding)
        : map.getBoundsZoom(maxBounds, true);
      map.setMinZoom(Math.max(minZoom, boundsZoom));
    };
    applyMinZoom();
    if (
      !initialViewAppliedRef.current &&
      initialCenter !== undefined &&
      initialZoom !== undefined
    ) {
      map.setView(initialCenter, initialZoom, { animate: false });
      initialViewAppliedRef.current = true;
    } else if (fitOnMount && fitBounds && !interactedRef.current) {
      map.fitBounds(fitBounds, resolveFitOptions());
    }

    const markInteracted = () => {
      interactedRef.current = true;
    };
    container.addEventListener('pointerdown', markInteracted);
    container.addEventListener('wheel', markInteracted, { passive: true });
    container.addEventListener('keydown', markInteracted);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        container.removeEventListener('pointerdown', markInteracted);
        container.removeEventListener('wheel', markInteracted);
        container.removeEventListener('keydown', markInteracted);
      };
    }
    const observer = new ResizeObserver(() => {
      applyMinZoom();
      if (initialCenter === undefined && fitBounds && !interactedRef.current) {
        map.fitBounds(fitBounds, resolveFitOptions());
      }
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      container.removeEventListener('pointerdown', markInteracted);
      container.removeEventListener('wheel', markInteracted);
      container.removeEventListener('keydown', markInteracted);
    };
  }, [
    fitBounds,
    fitOnMount,
    fitOptions,
    initialCenter,
    initialZoom,
    map,
    maxBounds,
    minZoom,
    minZoomPadding,
  ]);

  useLayoutEffect(() => {
    if (
      focusLatitude == null ||
      focusLongitude == null ||
      focusKey == null ||
      focusZoom === undefined
    ) {
      if (lastFocusKeyRef.current != null) map.stop();
      lastFocusKeyRef.current = null;
      return;
    }

    const isNewSelection = lastFocusKeyRef.current !== focusKey;
    if (!isNewSelection && interactedRef.current) return;
    if (isNewSelection) {
      map.stop();
      lastFocusKeyRef.current = focusKey;
      interactedRef.current = false;
    }

    const zoom = Math.max(map.getZoom(), focusZoom);
    const resolvedFitOptions =
      typeof fitOptions === 'function'
        ? fitOptions(map.getContainer())
        : fitOptions;
    const paddingTopLeft = point(resolvedFitOptions.paddingTopLeft ?? [0, 0]);
    const paddingBottomRight = point(
      resolvedFitOptions.paddingBottomRight ?? [0, 0],
    );
    const visibleCenterOffset = paddingTopLeft
      .subtract(paddingBottomRight)
      .divideBy(2);
    const targetCenter = latLng(focusLatitude, focusLongitude);
    const adjustedCenter = map.unproject(
      map.project(targetCenter, zoom).subtract(visibleCenterOffset),
      zoom,
    );
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      map.setView(adjustedCenter, zoom, { animate: false });
    } else {
      map.flyTo(adjustedCenter, zoom, { duration: 0.6 });
    }
  }, [fitOptions, focusKey, focusLatitude, focusLongitude, focusZoom, map]);

  return null;
}
