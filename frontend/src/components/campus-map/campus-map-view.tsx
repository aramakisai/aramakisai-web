'use client';

import 'leaflet/dist/leaflet.css';
import { AttributionControl, MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import { CAMPUS_MAP_CONFIG, MAP_ATTRIBUTION } from '@/lib/campus-map-config';
import type { CampusMapArea } from '@/lib/campus-map';
import { AreaPolygonLayer } from './area-polygon-layer';
import { MapZoomControl } from './map-zoom-control';
import { useIsAboveMapBreakpoint } from './use-is-above-map-breakpoint';

// leaflet の型は mutable なタプルを要求するため、readonly な設定値をここでキャストする
const CENTER = CAMPUS_MAP_CONFIG.center as unknown as LatLngExpression;
const BOUNDS = CAMPUS_MAP_CONFIG.bounds as unknown as LatLngBoundsExpression;

// 1x1 透明 GIF。読み込みに失敗したタイルを破損画像として表示させない (要件 8.3)
const TRANSPARENT_TILE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycAAAAAAQABAAACAUwAOw==';

export interface CampusMapViewProps {
  readonly areas: readonly CampusMapArea[];
  readonly selectedAreaId: number | null;
  readonly onSelectArea: (areaId: number | null) => void;
}

export function CampusMapView({
  areas,
  selectedAreaId,
  onSelectArea,
}: CampusMapViewProps) {
  const { initialZoom, minZoom, maxZoom, tileUrlTemplate } = CAMPUS_MAP_CONFIG;
  const isAboveBreakpoint = useIsAboveMapBreakpoint();

  // 選択中のエリアの再選択は解除として扱う (要件 2.6)。URL の書き換えは呼び出し元に委ねる
  const handleAreaClick = (areaId: number) => {
    onSelectArea(areaId === selectedAreaId ? null : areaId);
  };

  return (
    <MapContainer
      center={CENTER}
      zoom={initialZoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      maxBounds={BOUNDS}
      maxBoundsViscosity={1}
      // 既定のコントロールは左上固定で MapZoomControl と置き換える (design.md 参照)
      zoomControl={false}
      // 既定の帰属表示コントロールは Leaflet の旗ロゴが付くため、prefix なしのものに差し替える
      attributionControl={false}
      className="h-dvh w-full"
    >
      <TileLayer
        url={tileUrlTemplate}
        bounds={BOUNDS}
        minZoom={minZoom}
        maxZoom={maxZoom}
        attribution={MAP_ATTRIBUTION}
        errorTileUrl={TRANSPARENT_TILE_URL}
      />
      <AreaPolygonLayer
        areas={areas}
        selectedAreaId={selectedAreaId}
        onAreaClick={handleAreaClick}
      />
      {/*
       * Leaflet は同じ角 (position) に複数のコントロールがあるとき、後から addTo された
       * ものほど角の内側 (画面端から遠い側) に挿入する (Control.prototype.addTo の
       * corner.insertBefore(container, corner.firstChild) 参照)。PC はズームを上・
       * 出典表記を角に最も近い下に置きたいため、出典表記を先に、ズームを後にマウントする。
       * SP は出典表記を bottomleft に出すため互いに別の角となり、この順序は影響しない
       */}
      <AttributionControl
        position={isAboveBreakpoint ? 'bottomright' : 'bottomleft'}
        prefix={false}
      />
      <MapZoomControl />
    </MapContainer>
  );
}
