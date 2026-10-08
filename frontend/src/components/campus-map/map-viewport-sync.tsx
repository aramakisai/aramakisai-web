'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { FitBoundsOptions, LatLngBoundsExpression } from 'leaflet';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';

// 下側はシートの角丸の裏に潜る 16px 分を足す
const TILE_BOUNDS =
  CAMPUS_MAP_CONFIG.bounds as unknown as LatLngBoundsExpression;

const FIT_OPTIONS: FitBoundsOptions = {
  paddingTopLeft: [8, 8],
  paddingBottomRight: [8, 24],
  animate: false,
};

/**
 * 地図コンテナはボトムシートの高さに追従して伸縮する。Leaflet は window の resize しか
 * 監視しないため、コンテナ自身の寸法変化で invalidateSize を呼んで中心を保つ。
 * 初期表示はシートの実測高さが確定してから収まる倍率に決まるため、利用者が操作する
 * までは寸法変化のたびにキャンパス全体へ合わせ直す。
 * 縮小の下限はタイル範囲がコンテナ全体を覆う倍率 (広い画面ほど高くなる)。固定値だと
 * 大きい画面でタイル外の灰色が出る。config の minZoom はタイルが存在しない倍率を
 * 避ける絶対下限として残す
 */
export function MapViewportSync({
  fitBounds,
}: {
  readonly fitBounds: LatLngBoundsExpression;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    // fitBounds より先に下限を更新しないと、下限未満の倍率に一度合わせてしまう
    const applyMinZoom = () => {
      map.invalidateSize({ animate: false });
      map.setMinZoom(
        Math.max(
          CAMPUS_MAP_CONFIG.minZoom,
          map.getBoundsZoom(TILE_BOUNDS, true),
        ),
      );
    };
    applyMinZoom();
    let interacted = false;
    const markInteracted = () => {
      interacted = true;
    };
    container.addEventListener('pointerdown', markInteracted);
    container.addEventListener('wheel', markInteracted, { passive: true });

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        container.removeEventListener('pointerdown', markInteracted);
        container.removeEventListener('wheel', markInteracted);
      };
    }
    const observer = new ResizeObserver(() => {
      applyMinZoom();
      if (!interacted) map.fitBounds(fitBounds, FIT_OPTIONS);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      container.removeEventListener('pointerdown', markInteracted);
      container.removeEventListener('wheel', markInteracted);
    };
  }, [map, fitBounds]);

  return null;
}
