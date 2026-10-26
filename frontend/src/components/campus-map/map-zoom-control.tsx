'use client';

import { ZoomControl } from 'react-leaflet';

// Leaflet の zoomInText / zoomOutText は innerHTML としてそのまま挿入されるため、
// React の MaterialIcon (現在地ボタンと同じ 24px・FILL 0) と同じ指定を文字列で組み立てる。
// aria-hidden はアイコンを装飾専用にするため (アクセシブルな名前は zoomInTitle/zoomOutTitle が担う)
const materialIcon = (name: string) =>
  `<span aria-hidden="true" class="material-symbols-sharp" style="font-size:24px;line-height:24px;font-variation-settings:'FILL' 0">${name}</span>`;
const ZOOM_IN_ICON = materialIcon('add');
const ZOOM_OUT_ICON = materialIcon('remove');

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
