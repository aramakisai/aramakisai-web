'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { latLng, latLngBounds, point } from 'leaflet';
import type {
  FitBoundsOptions,
  LatLngBoundsExpression,
  LatLngExpression,
  Point,
} from 'leaflet';
import { prefersReducedMotion } from '@/lib/use-motion-preference';

type MapFitOptions = (container: HTMLElement) => FitBoundsOptions;

export interface MapViewportControllerProps {
  readonly fitBounds?: LatLngBoundsExpression;
  readonly initialCenter?: LatLngExpression;
  readonly initialZoom?: number;
  /** 指定時は初回表示だけ initialCenter/initialZoom の代わりにこの範囲へ fit する */
  readonly initialFitBounds?: LatLngBoundsExpression | null;
  readonly initialFitOptions?: MapFitOptions;
  readonly focusCenter?: LatLngExpression | null;
  readonly focusKey?: string | number | null;
  readonly focusZoom?: number;
  /** 選択位置へ寄せるときの余白 */
  readonly focusFitOptions?: MapFitOptions;
  /** 変わったとき、選択中の位置を現在のズームのまま見えている領域の中央へ平行移動する */
  readonly refocusKey?: string | number | null;
  readonly maxBounds: LatLngBoundsExpression;
  readonly minZoom: number;
  readonly minZoomPadding?: Point;
  readonly fitOptions: MapFitOptions;
  /**
   * 地図がシート・パネルの裏まで広がる画面向け。指定すると maxBounds をこの余白の分だけ広げ、
   * 余白の外側に範囲全体を収められるようにする。広げないと、画面が範囲より大きいとき
   * Leaflet が範囲を中央に固定して余白に合わせた fit や移動が効かない。
   * fitOptions の余白にはピンが縁に接しないための余裕が含まれ、そのまま広げると
   * 覆い隠されない位置に範囲外が見えてしまうため、別に受け取る
   */
  readonly maxBoundsPadding?: MapFitOptions;
}

/**
 * コンテナの寸法変化へLeafletを追従させ、利用者が操作するまでは指定範囲を
 * panel・sheet用の余白込みでfitする。最大範囲を覆えるzoomを動的な下限にする。
 */
export function MapViewportController({
  fitBounds,
  initialCenter,
  initialZoom,
  initialFitBounds,
  initialFitOptions,
  focusCenter,
  focusKey,
  focusZoom,
  focusFitOptions,
  refocusKey,
  maxBounds,
  minZoom,
  minZoomPadding,
  fitOptions,
  maxBoundsPadding,
}: MapViewportControllerProps) {
  const map = useMap();
  const extendMaxBounds = maxBoundsPadding !== undefined;
  const interactedRef = useRef(false);
  const initialViewAppliedRef = useRef(false);
  const lastFocusKeyRef = useRef<string | number | null>(null);
  const lastRefocusKeyRef = useRef(refocusKey);
  // シートの高さが動くたびに fitOptions 等が作り直されるため、effect を張り直さず最新値を参照する
  const fitOptionsRef = useRef(fitOptions);
  const focusFitOptionsRef = useRef(focusFitOptions);
  const initialFitOptionsRef = useRef(initialFitOptions);
  const minZoomPaddingRef = useRef(minZoomPadding);
  const maxBoundsPaddingRef = useRef(maxBoundsPadding);
  const syncPaddingRef = useRef<(() => void) | null>(null);
  const focusMovingRef = useRef(false);
  const paddingDirtyRef = useRef(false);
  const normalizedFocusCenter =
    focusCenter == null ? null : latLng(focusCenter);
  const focusLatitude = normalizedFocusCenter?.lat ?? null;
  const focusLongitude = normalizedFocusCenter?.lng ?? null;

  useLayoutEffect(() => {
    fitOptionsRef.current = fitOptions;
    focusFitOptionsRef.current = focusFitOptions;
    initialFitOptionsRef.current = initialFitOptions;
    minZoomPaddingRef.current = minZoomPadding;
    maxBoundsPaddingRef.current = maxBoundsPadding;
  });

  useEffect(() => {
    const container = map.getContainer();
    const resolveFitOptions = () => fitOptionsRef.current(container);
    const applyMaxBounds = (zoom: number) => {
      const options = maxBoundsPaddingRef.current;
      if (!options) {
        map.setMaxBounds(maxBounds);
        return;
      }
      const { paddingTopLeft, paddingBottomRight } = options(container);
      const topLeft = point(paddingTopLeft ?? [0, 0]);
      const bottomRight = point(paddingBottomRight ?? [0, 0]);
      const bounds = latLngBounds(maxBounds as LatLngExpression[]);
      map.setMaxBounds(
        latLngBounds(
          map.unproject(
            map
              .project(bounds.getSouthWest(), zoom)
              .add([-topLeft.x, bottomRight.y]),
            zoom,
          ),
          map.unproject(
            map
              .project(bounds.getNorthEast(), zoom)
              .add([bottomRight.x, -topLeft.y]),
            zoom,
          ),
        ),
      );
    };
    // fit 前はまだ zoom が定まらないため、最も広く取れる最小 zoom で広げておく
    applyMaxBounds(minZoom);
    const onZoomEnd = () => applyMaxBounds(map.getZoom());
    if (extendMaxBounds) map.on('zoomend', onZoomEnd);
    const applyMinZoom = () => {
      map.invalidateSize({ animate: false });
      const minZoomPadding = minZoomPaddingRef.current;
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
      if (initialFitBounds) {
        map.fitBounds(
          initialFitBounds,
          initialFitOptionsRef.current?.(container),
        );
      } else {
        map.setView(initialCenter, initialZoom, { animate: false });
      }
      initialViewAppliedRef.current = true;
    }

    const markInteracted = () => {
      interactedRef.current = true;
    };
    container.addEventListener('pointerdown', markInteracted);
    container.addEventListener('wheel', markInteracted, { passive: true });
    container.addEventListener('keydown', markInteracted);

    const onResize = () => {
      applyMinZoom();
      if (initialCenter === undefined && fitBounds && !interactedRef.current) {
        map.fitBounds(fitBounds, resolveFitOptions());
      }
    };
    syncPaddingRef.current = () => {
      applyMaxBounds(map.getZoom());
      onResize();
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(container);
    return () => {
      syncPaddingRef.current = null;
      if (extendMaxBounds) map.off('zoomend', onZoomEnd);
      observer.disconnect();
      container.removeEventListener('pointerdown', markInteracted);
      container.removeEventListener('wheel', markInteracted);
      container.removeEventListener('keydown', markInteracted);
    };
  }, [
    fitBounds,
    initialCenter,
    initialFitBounds,
    initialZoom,
    map,
    maxBounds,
    minZoom,
    extendMaxBounds,
  ]);

  // 選択直後の flyTo 中はシートの高さが変わり続ける。途中で範囲や下限を張り直すと
  // Leaflet が移動を打ち切って位置を補正するため、反映は移動の終了まで待つ
  const isFirstPaddingRunRef = useRef(true);
  useEffect(() => {
    if (isFirstPaddingRunRef.current) {
      isFirstPaddingRunRef.current = false;
      return;
    }
    if (focusMovingRef.current) {
      paddingDirtyRef.current = true;
      return;
    }
    syncPaddingRef.current?.();
  }, [fitOptions, minZoomPadding]);

  // 同じ commit でシートが移動先の高さを通知し終えてから終点を決めるため、layout effect にしない
  useEffect(() => {
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

    const refocus =
      lastRefocusKeyRef.current !== refocusKey &&
      lastFocusKeyRef.current === focusKey;
    lastRefocusKeyRef.current = refocusKey;
    if (lastFocusKeyRef.current === focusKey && !refocus) return;
    map.stop();
    lastFocusKeyRef.current = focusKey;
    // 選択は利用者の操作とみなし、以後のリサイズで全体表示へ戻さない
    interactedRef.current = true;

    const zoom = refocus ? map.getZoom() : Math.max(map.getZoom(), focusZoom);
    const resolvedFitOptions =
      focusFitOptionsRef.current?.(map.getContainer()) ?? {};
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

    if (prefersReducedMotion()) {
      map.setView(adjustedCenter, zoom, { animate: false });
    } else {
      // flyTo はズームが同じでも途中で引いて戻すため、画面内で届く移動は拡大縮小のない平行移動にする
      const offset =
        zoom === map.getZoom()
          ? map
              .project(adjustedCenter, zoom)
              .subtract(map.project(map.getCenter(), zoom))
              .round()
          : null;
      if (offset && offset.x === 0 && offset.y === 0) return;
      if (offset && map.getSize().contains(offset)) {
        map.panBy(offset, { duration: 0.6 });
      } else {
        map.flyTo(adjustedCenter, zoom, { duration: 0.6 });
      }
      focusMovingRef.current = true;
      // 次の選択の stop() や利用者の操作で打ち切られた場合も moveend は発火する
      map.once('moveend', () => {
        focusMovingRef.current = false;
        if (paddingDirtyRef.current) {
          paddingDirtyRef.current = false;
          syncPaddingRef.current?.();
        }
      });
    }
  }, [focusKey, focusLatitude, focusLongitude, focusZoom, map, refocusKey]);

  return null;
}
