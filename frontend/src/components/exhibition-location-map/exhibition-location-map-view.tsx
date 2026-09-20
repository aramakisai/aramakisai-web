'use client';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { CAMPUS_MAP_CONFIG, MAP_ATTRIBUTION } from '@/lib/campus-map-config';
import type { CampusMapArea } from '@/lib/campus-map';
import type { AreaBounds } from '@/lib/exhibition-location-map';
import { AreaPolygonLayer } from '@/components/campus-map/area-polygon-layer';
import { AreaPin } from './area-pin';
import { RecenterButton } from './recenter-button';

// leaflet の型は mutable なタプルを要求するため、readonly な設定値をここでキャストする
const MAX_BOUNDS =
  CAMPUS_MAP_CONFIG.bounds as unknown as LatLngBoundsExpression;

// 1x1 透明 GIF。読み込みに失敗したタイルを破損画像として表示させない (campus-map-view と同じ対処)
const TRANSPARENT_TILE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycAAAAAAQABAAACAUwAOw==';

export interface ExhibitionLocationMapViewProps {
  readonly areas: readonly [CampusMapArea, ...CampusMapArea[]];
  readonly bounds: AreaBounds;
}

// 埋め込み文脈は選択状態の概念を持たない。ポリゴンのクリックを遷移や選択変更に繋げないための no-op
function handleAreaClick(): void {}

export function ExhibitionLocationMapView({
  areas,
  bounds,
}: ExhibitionLocationMapViewProps) {
  const { minZoom, maxZoom, tileUrlTemplate } = CAMPUS_MAP_CONFIG;
  // leaflet の型は mutable なタプルを要求するため、readonly な bounds をここでキャストする
  const initialBounds = [
    bounds.southWest,
    bounds.northEast,
  ] as unknown as LatLngBoundsExpression;

  return (
    // Figma 実測: MapPreview の高さは SP (95:12 内 95:46) が 240px、PC (95:2 内 95:4) が 360px
    <div className="relative h-[240px] w-full overflow-clip rounded-xl border border-gray-200 bg-gray-100 md:h-[360px]">
      <MapContainer
        bounds={initialBounds}
        minZoom={minZoom}
        maxZoom={maxZoom}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url={tileUrlTemplate}
          bounds={MAX_BOUNDS}
          minZoom={minZoom}
          maxZoom={maxZoom}
          attribution={MAP_ATTRIBUTION}
          errorTileUrl={TRANSPARENT_TILE_URL}
        />
        <AreaPolygonLayer
          areas={areas}
          selectedAreaId={null}
          onAreaClick={handleAreaClick}
        />
        {areas.map((area) => (
          <AreaPin key={area.id} geometry={area.geometry} />
        ))}
        <RecenterButton bounds={bounds} />
      </MapContainer>
    </div>
  );
}
