'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, type Ref } from 'react';
import { AttributionControl, MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngBoundsExpression, Map as LeafletMap } from 'leaflet';
import { sendGaEvent } from '@/lib/analytics';
import { CAMPUS_MAP_CONFIG, MAP_ATTRIBUTION } from '@/lib/campus-map-config';
import type { CampusMapArea, CampusMapPoint } from '@/lib/campus-map';
import { toAreaBounds } from '@/lib/exhibition-location-map';
import { AreaPolygonLayer } from './area-polygon-layer';
import { MapPointMarker } from './map-point-marker';
import { MapUserLocation } from './map-user-location';
import { MapViewportSync } from './map-viewport-sync';
import { MapZoomControl } from './map-zoom-control';
import { useIsAboveMapBreakpoint } from './use-is-above-map-breakpoint';

// leaflet の型は mutable なタプルを要求するため、readonly な設定値をここでキャストする
const CAMPUS_BOUNDS =
  CAMPUS_MAP_CONFIG.campusBounds as unknown as LatLngBoundsExpression;
const BOUNDS = CAMPUS_MAP_CONFIG.bounds as unknown as LatLngBoundsExpression;

// 1x1 透明 GIF。読み込みに失敗したタイルを破損画像として表示させない (要件 8.3)
const TRANSPARENT_TILE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycAAAAAAQABAAACAUwAOw==';

export interface CampusMapViewProps {
  readonly areas: readonly CampusMapArea[];
  readonly points?: readonly CampusMapPoint[];
  readonly selectedAreaId: number | null;
  readonly onSelectArea: (areaId: number | null) => void;
  /** 端末用は下部の操作部品に現在地を出さない */
  readonly showUserLocation?: boolean;
  /** 端末用は自前のボタンから mapRef 経由でズームするため、Leaflet のコントロールを出さない */
  readonly showZoomControl?: boolean;
  /** 端末用は下部の操作部品と重ならないよう出典表記を右上に置く */
  readonly attributionTop?: boolean;
  readonly mapRef?: Ref<LeafletMap>;
  /** 端末用は下部の操作部品が地図に重なるため、その高さを避けて全エリアを収める */
  readonly fitBottomInset?: number;
  /** 左パネルと下部の操作部品が地図の上に浮く端末用で、可視領域の中央へ全エリアを置けるよう maxBounds を辺の長さの割合だけ広げる */
  readonly maxBoundsPad?: number;
  /** 表示範囲のタイルを読み終えたとき(Leaflet の GridLayer load)に呼ぶ */
  readonly onTilesLoaded?: () => void;
}

// navigation entry はドキュメントの最初の URL のまま変わらないため、/map 直接表示後に別ページから
// クライアント遷移で戻った場合も entry だけでは判別できない。ドキュメント内で最初の whenReady だけを
// 直接表示の候補にし、時間(performance.now())は直接表示のときだけ意味を持つので soft には付けない
let firstReadyPending = true;

function sendMapReady() {
  const first = firstReadyPending;
  firstReadyPending = false;
  const entry = performance.getEntriesByType('navigation')[0];
  let hard = false;
  try {
    hard = first && !!entry && new URL(entry.name).pathname === '/map';
  } catch {}
  sendGaEvent(
    'campus_map',
    hard
      ? {
          result: 'ready',
          method: 'hard',
          duration_ms: Math.round(performance.now()),
        }
      : { result: 'ready', method: 'soft' },
  );
}

export function CampusMapView({
  areas,
  points = [],
  selectedAreaId,
  onSelectArea,
  showUserLocation = true,
  showZoomControl = true,
  attributionTop = false,
  mapRef,
  fitBottomInset,
  maxBoundsPad = 0,
  onTilesLoaded,
}: CampusMapViewProps) {
  const { minZoom, maxZoom, minNativeZoom, maxNativeZoom, tileUrlTemplate } =
    CAMPUS_MAP_CONFIG;
  const isAboveBreakpoint = useIsAboveMapBreakpoint();
  // 敷地の外接矩形ではなく実際のエリア群に合わせる。エリア取得失敗時だけ敷地全体へ戻す
  const fitBounds = useMemo<LatLngBoundsExpression>(() => {
    if (areas.length === 0) return CAMPUS_BOUNDS;
    const { southWest, northEast } = toAreaBounds(
      areas as [CampusMapArea, ...CampusMapArea[]],
    );
    return [southWest, northEast] as unknown as LatLngBoundsExpression;
  }, [areas]);
  const maxBounds = useMemo<LatLngBoundsExpression>(() => {
    const [[s, w], [n, e]] = CAMPUS_MAP_CONFIG.bounds;
    const dLat = (n - s) * maxBoundsPad;
    const dLng = (e - w) * maxBoundsPad;
    return [
      [s - dLat, w - dLng],
      [n + dLat, e + dLng],
    ];
  }, [maxBoundsPad]);
  const tileErrors = useRef(0);
  const tileEventHandlers = useMemo(
    () => ({
      tileerror: () => {
        tileErrors.current += 1;
      },
      load: () => onTilesLoaded?.(),
    }),
    [onTilesLoaded],
  );

  // 離脱時に送るため、タイル失敗はその都度ではなく集計して最初の1回だけ送る
  useEffect(() => {
    let sent = false;
    const flush = () => {
      if (sent || tileErrors.current === 0) return;
      sent = true;
      sendGaEvent('campus_map', {
        result: 'tile_error',
        item_count: tileErrors.current,
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, []);

  // 選択中のエリアの再選択は解除として扱う (要件 2.6)。URL の書き換えは呼び出し元に委ねる
  const handleAreaClick = (areaId: number) => {
    onSelectArea(areaId === selectedAreaId ? null : areaId);
  };

  return (
    <MapContainer
      bounds={fitBounds}
      minZoom={minZoom}
      maxZoom={maxZoom}
      maxBounds={maxBounds}
      maxBoundsViscosity={1}
      // 整数に吸着させず、ピンチ・ホイール・ボタンで連続的に拡縮させる
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={240}
      // 既定のコントロールは左上固定で MapZoomControl と置き換える (design.md 参照)
      zoomControl={false}
      // 既定の帰属表示コントロールは Leaflet の旗ロゴが付くため、prefix なしのものに差し替える
      attributionControl={false}
      ref={mapRef}
      whenReady={sendMapReady}
      className="h-full w-full"
    >
      <TileLayer
        url={tileUrlTemplate}
        bounds={BOUNDS}
        minZoom={minZoom}
        maxZoom={maxZoom}
        minNativeZoom={minNativeZoom}
        maxNativeZoom={maxNativeZoom}
        attribution={MAP_ATTRIBUTION}
        errorTileUrl={TRANSPARENT_TILE_URL}
        eventHandlers={tileEventHandlers}
      />
      <MapViewportSync fitBounds={fitBounds} bottomInset={fitBottomInset} />
      <AreaPolygonLayer
        areas={areas}
        selectedAreaId={selectedAreaId}
        onAreaClick={handleAreaClick}
      />
      {points.map((point) => (
        <MapPointMarker key={point.id} point={point} />
      ))}
      {/*
       * Leaflet は同じ角 (position) に複数のコントロールがあるとき、後から addTo された
       * ものほど角の内側 (画面端から遠い側) に挿入する (Control.prototype.addTo の
       * corner.insertBefore(container, corner.firstChild) 参照)。PC はズームを上・
       * 出典表記を角に最も近い下に置きたいため、出典表記を先に、ズームを後にマウントする。
       * SP は出典表記を bottomleft に出すため互いに別の角となり、この順序は影響しない
       */}
      <AttributionControl
        position={
          attributionTop
            ? 'topright'
            : isAboveBreakpoint
              ? 'bottomright'
              : 'bottomleft'
        }
        prefix={false}
      />
      {showZoomControl && <MapZoomControl />}
      {showUserLocation && <MapUserLocation />}
    </MapContainer>
  );
}
