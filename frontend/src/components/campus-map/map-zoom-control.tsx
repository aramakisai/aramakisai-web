'use client';

import { ZoomControl } from 'react-leaflet';

// 左上は将来 MapSidePanel (デスクトップの左ペイン) と重なるため、
// 空いている右下に置く (design.md の「重ならない配置」要件)
export function MapZoomControl() {
  return <ZoomControl position="bottomright" />;
}
