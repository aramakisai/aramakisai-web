'use client';

import { ZoomControl } from 'react-leaflet';

// Leaflet の zoomInText / zoomOutText は innerHTML としてそのまま挿入される。
// aria-hidden はアイコンを装飾専用にするため (アクセシブルな名前は zoomInTitle/zoomOutTitle が担う)
const ZOOM_IN_ICON =
  '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M9.16667 10.8333H4.16667V9.16667H9.16667V4.16667H10.8333V9.16667H15.8333V10.8333H10.8333V15.8333H9.16667V10.8333Z" fill="currentColor"/></svg>';
const ZOOM_OUT_ICON =
  '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4.16667 10.8333V9.16667H15.8333V10.8333H4.16667Z" fill="currentColor"/></svg>';

/**
 * 見た目 (サイズ・枠線・角丸・影・地図端からの余白) は globals.css の
 * .leaflet-control-zoom 上書きで Figma のデザインに合わせている。react-leaflet の
 * ZoomControl をそのまま使うことで、上限/下限での無効化 (aria-disabled/leaflet-disabled) や
 * クリック・スクロールイベントが地図のパン操作に伝播しない対処を Leaflet 本体の実装に任せられる。
 * 左上は将来 MapSidePanel (デスクトップの左ペイン) と重なるため、空いている右下に置く
 */
export function MapZoomControl() {
  return (
    <ZoomControl
      position="bottomright"
      zoomInTitle="拡大"
      zoomOutTitle="縮小"
      zoomInText={ZOOM_IN_ICON}
      zoomOutText={ZOOM_OUT_ICON}
    />
  );
}
