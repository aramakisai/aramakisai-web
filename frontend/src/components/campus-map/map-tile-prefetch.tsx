'use client';

import { useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';

// TileLayer の既定値。同じ TileLayer は tileSize を上書きしていない
const TILE_SIZE = 256;

// Leaflet は Math.round(zoom) でタイルの段を選ぶ。段が切り替わった直後は新しい段が未取得で
// 旧い段の引き伸ばしが見え、ベクタだけ先に動いて見えるため、隣の段を表示範囲ぶん先に取っておく
function prefetch(map: LeafletMap, seen: Set<string>) {
  const { minNativeZoom, maxNativeZoom, tileUrlTemplate } = CAMPUS_MAP_CONFIG;
  const current = Math.min(
    maxNativeZoom,
    Math.max(minNativeZoom, Math.round(map.getZoom())),
  );
  const bounds = map.getBounds();
  for (const z of [current + 1, current - 1]) {
    if (z < minNativeZoom || z > maxNativeZoom) continue;
    const nw = map.project(bounds.getNorthWest(), z);
    const se = map.project(bounds.getSouthEast(), z);
    for (
      let x = Math.floor(nw.x / TILE_SIZE);
      x <= Math.floor(se.x / TILE_SIZE);
      x++
    ) {
      for (
        let y = Math.floor(nw.y / TILE_SIZE);
        y <= Math.floor(se.y / TILE_SIZE);
        y++
      ) {
        const url = tileUrlTemplate
          .replace('{z}', String(z))
          .replace('{x}', String(x))
          .replace('{y}', String(y));
        if (seen.has(url)) continue;
        seen.add(url);
        new Image().src = url;
      }
    }
  }
}

export function MapTilePrefetch() {
  const map = useMap();
  const seen = useRef(new Set<string>());
  useMapEvents({
    moveend: () => prefetch(map, seen.current),
    zoomend: () => prefetch(map, seen.current),
  });
  useEffect(() => {
    prefetch(map, seen.current);
  }, [map]);
  return null;
}
