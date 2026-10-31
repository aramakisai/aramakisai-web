'use client';

import 'leaflet/dist/leaflet.css';
import { useCallback, useMemo } from 'react';
import { latLngBounds } from 'leaflet';
import type { FitBoundsOptions, LatLngBoundsExpression } from 'leaflet';
import { AttributionControl, MapContainer, TileLayer } from 'react-leaflet';
import { computeMapFitOptions } from '@/components/map/map-fit-options';
import { MapTilePrefetch } from '@/components/map/map-tile-prefetch';
import { MapUserLocation } from '@/components/map/map-user-location';
import { MapViewportController } from '@/components/map/map-viewport-controller';
import { MapZoomControl } from '@/components/map/map-zoom-control';
import { useIsAboveMapBreakpoint } from '@/components/map/use-is-above-map-breakpoint';
import { CAMPUS_MAP_CONFIG, MAP_ATTRIBUTION } from '@/lib/campus-map-config';
import { REGIONAL_MAP_TILE_PROFILE as profile } from '@/lib/map-tile-profile';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorMarkerLayer } from './regional-sponsor-marker-layer';

// 1x1 透明 GIF。読み込みに失敗したタイルを破損画像として表示させない
const TRANSPARENT_TILE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycAAAAAAQABAAACAUwAOw==';

// 整数の native zoom にする。x.5 だと Leaflet がタイルの z を丸める境界に乗り、
// flyTo の途中でわずかに引いただけで 1 段下のタイルを引き伸ばした表示に切り替わる
const FOCUS_ZOOM = profile.maxNativeZoom;

// 全ピンの範囲で fit するとき、1 件だけ・全件が近接のときに過剰に寄らないための上限
const FIT_MAX_ZOOM = CAMPUS_MAP_CONFIG.minZoom;

const BOUNDS = profile.bounds as unknown as LatLngBoundsExpression;

export interface RegionalSponsorMapViewProps {
  /** 絞り込み後のピン */
  readonly sponsors: readonly RegionalSponsor[];
  /** 初期表示で収める範囲。絞り込みで画角を戻さないよう全件を渡す */
  readonly fitSponsors: readonly RegionalSponsor[];
  readonly selectedSponsorId: number | null;
  readonly onSelectSponsor: (sponsorId: number) => void;
  readonly onSelectLocation: (sponsorIds: readonly number[]) => void;
}

export function RegionalSponsorMapView({
  sponsors,
  fitSponsors,
  selectedSponsorId,
  onSelectSponsor,
  onSelectLocation,
}: RegionalSponsorMapViewProps) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();
  const markerSize = isAboveBreakpoint ? 48 : 32;

  const fitBounds = useMemo<LatLngBoundsExpression>(
    () =>
      fitSponsors.length === 0
        ? BOUNDS
        : latLngBounds(fitSponsors.map((s) => [s.latitude, s.longitude])),
    [fitSponsors],
  );
  // 地図コンテナ自体が SP ではシート上端までに縮むため、シートの高さは余白に足さない
  const fitOptions = useCallback(
    (container: HTMLElement): FitBoundsOptions => {
      const base = computeMapFitOptions(container, 0);
      const [left, top] = base.paddingTopLeft as [number, number];
      return {
        ...base,
        // ピンは下端中央アンカーなので、座標を余白内に置くだけでは画像上端が画面外へ出る
        paddingTopLeft: [left, top + markerSize],
        maxZoom: FIT_MAX_ZOOM,
      };
    },
    [markerSize],
  );
  const selectedSponsor =
    selectedSponsorId == null
      ? null
      : (sponsors.find((sponsor) => sponsor.id === selectedSponsorId) ?? null);

  return (
    <MapContainer
      bounds={fitBounds}
      minZoom={profile.minZoom}
      maxZoom={profile.maxZoom}
      maxBounds={BOUNDS}
      maxBoundsViscosity={1}
      zoomSnap={0.25}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={240}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
    >
      <TileLayer
        url={profile.urlTemplate}
        bounds={BOUNDS}
        minZoom={profile.minZoom}
        maxZoom={profile.maxZoom}
        minNativeZoom={profile.minNativeZoom}
        maxNativeZoom={profile.maxNativeZoom}
        attribution={MAP_ATTRIBUTION}
        errorTileUrl={TRANSPARENT_TILE_URL}
      />
      <MapTilePrefetch profile={profile} />
      <MapViewportController
        fitBounds={fitBounds}
        maxBounds={BOUNDS}
        minZoom={profile.minZoom}
        fitOptions={fitOptions}
        focusCenter={
          selectedSponsor
            ? [selectedSponsor.latitude, selectedSponsor.longitude]
            : null
        }
        focusKey={selectedSponsorId}
        focusZoom={FOCUS_ZOOM}
        focusFitOptions={fitOptions}
        refocusKey={isAboveBreakpoint ? 'desktop' : 'mobile'}
      />
      <RegionalSponsorMarkerLayer
        sponsors={sponsors}
        selectedSponsorId={selectedSponsorId}
        maxZoom={profile.maxZoom}
        markerSize={markerSize}
        visibleAreaOptions={fitOptions}
        onSelectSponsor={onSelectSponsor}
        onSelectLocation={onSelectLocation}
      />
      <AttributionControl
        position={isAboveBreakpoint ? 'bottomright' : 'bottomleft'}
        prefix={false}
      />
      <MapZoomControl />
      <MapUserLocation bounds={profile.bounds} />
    </MapContainer>
  );
}
