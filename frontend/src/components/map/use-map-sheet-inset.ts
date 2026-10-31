'use client';

import { useCallback, useRef, useState } from 'react';
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

const toInset = (height: number) =>
  Math.max(
    0,
    Math.min(height, (window.innerHeight * MAP_FOLLOW_MAX_VH) / 100) -
      SHEET_RADIUS_PX,
  );

export function useMapSheetInset() {
  const [bottomInset, setBottomInset] = useState(0);
  // 伸びる向きでは地図コンテナが縮むのが遅れる。即時の行き先と、コンテナに反映済みの値を分けて持つ
  const targetInsetRef = useRef(0);
  const appliedInsetRef = useRef(0);
  const onTargetHeightIntent = useCallback((height: number) => {
    targetInsetRef.current = toInset(height);
  }, []);
  const onTargetHeightChange = useCallback((height: number) => {
    const inset = toInset(height);
    appliedInsetRef.current = inset;
    setBottomInset(inset);
  }, []);
  /** これから縮む分。焦点合わせの下余白に足す */
  const getPendingInset = useCallback(
    () => targetInsetRef.current - appliedInsetRef.current,
    [],
  );
  return {
    bottomInset,
    onTargetHeightChange,
    onTargetHeightIntent,
    getPendingInset,
  };
}

/** 下部ナビの表示条件 (live かつ 1024px 未満) と同じ条件で、その高さ分だけ下端を空ける。値は PhasedBottomSpacer と揃える */
export function useMapNavClass(): string {
  return usePhase().phase === 'live'
    ? '[--map-nav:calc(4rem+env(safe-area-inset-bottom))] lg:[--map-nav:0px]'
    : '[--map-nav:0px]';
}
