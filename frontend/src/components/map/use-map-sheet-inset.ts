'use client';

import { useCallback, useState } from 'react';
import { usePhase } from '@/lib/use-phase';

// シートが全画面近くまで伸びても地図コンテナが潰れないよう、追従はこの高さで止める
const MAP_FOLLOW_MAX_VH = 55;
// 角丸の裏が空かないよう、地図はシート上端からこの分だけシートの下に潜らせる
const SHEET_RADIUS_PX = 16;

/**
 * SP では地図コンテナ自体をシート上端までに縮め、fitBounds・maxBounds がシートに
 * 隠れない可視領域基準になるようにする。コントロールは潜らせた分だけ持ち上げる
 */
export const MAP_VIEWPORT_CLASS =
  'h-[calc(100dvh-var(--map-nav)-var(--map-bottom-inset))] lg:h-[calc(100dvh-var(--map-nav))] max-lg:[&_.leaflet-bottom]:mb-4';

export function useMapSheetInset() {
  const [bottomInset, setBottomInset] = useState(0);
  const onHeightChange = useCallback((height: number) => {
    setBottomInset(
      Math.max(
        0,
        Math.min(height, (window.innerHeight * MAP_FOLLOW_MAX_VH) / 100) -
          SHEET_RADIUS_PX,
      ),
    );
  }, []);
  return { bottomInset, onHeightChange };
}

/** 下部ナビの表示条件 (live かつ 1024px 未満) と同じ条件で、その高さ分だけ下端を空ける。値は PhasedBottomSpacer と揃える */
export function useMapNavClass(): string {
  return usePhase().phase === 'live'
    ? '[--map-nav:calc(4rem+env(safe-area-inset-bottom))] lg:[--map-nav:0px]'
    : '[--map-nav:0px]';
}
