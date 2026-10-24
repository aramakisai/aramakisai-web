'use client';

import 'leaflet/dist/leaflet.css';
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { point } from 'leaflet';
import type { FitBoundsOptions, LatLngBoundsExpression, Point } from 'leaflet';
import { AttributionControl, MapContainer, TileLayer } from 'react-leaflet';
import { MapViewportController } from '@/components/map/map-viewport-controller';
import { MapZoomControl } from '@/components/campus-map/map-zoom-control';
import { MAP_ATTRIBUTION } from '@/lib/campus-map-config';
import type { RegionalMapConfig } from '@/lib/regional-map-config';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorMarkerLayer } from './regional-sponsor-marker-layer';

const TRANSPARENT_TILE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ycAAAAAAQABAAACAUwAOw==';

export interface RegionalSponsorMapViewProps {
  readonly profile: RegionalMapConfig | null;
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsorId: number | null;
  readonly spiderfiedClusterId: string | null;
  readonly isDesktop: boolean;
  readonly mobileBottomInset: number;
  readonly onSelectSponsor: (sponsorId: number) => void;
  readonly onSpiderfyChange: (clusterId: string | null) => void;
}

export function RegionalSponsorMapView({
  profile,
  sponsors,
  selectedSponsorId,
  spiderfiedClusterId,
  isDesktop,
  mobileBottomInset,
  onSelectSponsor,
  onSpiderfyChange,
}: RegionalSponsorMapViewProps) {
  const [loading, setLoading] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [tileKey, setTileKey] = useState(0);

  const fitOptions = useMemo<FitBoundsOptions>(
    () => ({
      paddingTopLeft: isDesktop ? [396, 24] : [16, 136],
      paddingBottomRight: isDesktop ? [24, 24] : [16, mobileBottomInset + 16],
      animate: false,
    }),
    [isDesktop, mobileBottomInset],
  );
  const minZoomPadding = useMemo<Point>(
    () => (isDesktop ? point(420, 48) : point(32, mobileBottomInset + 152)),
    [isDesktop, mobileBottomInset],
  );

  if (!profile) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-600"
        role="status"
      >
        地域地図は準備中です
      </div>
    );
  }

  const bounds = profile.bounds as unknown as LatLngBoundsExpression;
  const selectedSponsor =
    selectedSponsorId == null
      ? null
      : (sponsors.find((sponsor) => sponsor.id === selectedSponsorId) ?? null);
  const controlInset = isDesktop ? 0 : Math.max(0, mobileBottomInset - 16);

  return (
    <div
      className="regional-sponsor-map relative h-full w-full"
      style={
        { '--regional-map-bottom-inset': `${controlInset}px` } as CSSProperties
      }
    >
      <MapContainer
        center={profile.initialCenter}
        zoom={profile.initialZoom}
        minZoom={profile.minZoom}
        maxZoom={profile.maxZoom}
        maxBounds={bounds}
        maxBoundsViscosity={1}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={240}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          key={tileKey}
          url={profile.urlTemplate}
          bounds={bounds}
          minZoom={profile.minZoom}
          maxZoom={profile.maxZoom}
          minNativeZoom={profile.minNativeZoom}
          maxNativeZoom={profile.maxNativeZoom}
          attribution={MAP_ATTRIBUTION}
          errorTileUrl={TRANSPARENT_TILE_URL}
          eventHandlers={{
            loading: () => {
              setLoading(true);
              setTileError(false);
            },
            load: () => setLoading(false),
            tileerror: () => {
              setLoading(false);
              setTileError(true);
            },
          }}
        />
        <MapViewportController
          initialCenter={profile.initialCenter}
          initialZoom={profile.initialZoom}
          focusCenter={
            selectedSponsor
              ? [selectedSponsor.latitude, selectedSponsor.longitude]
              : null
          }
          focusKey={selectedSponsorId}
          focusZoom={profile.focusZoom}
          maxBounds={bounds}
          minZoom={profile.minZoom}
          minZoomPadding={minZoomPadding}
          fitOptions={fitOptions}
        />
        <RegionalSponsorMarkerLayer
          sponsors={sponsors}
          selectedSponsorId={selectedSponsorId}
          spiderfiedClusterId={spiderfiedClusterId}
          profile={profile}
          markerSize={isDesktop ? 48 : 32}
          fitOptions={fitOptions}
          onSelectSponsor={onSelectSponsor}
          onSpiderfyChange={onSpiderfyChange}
        />
        <AttributionControl
          position={isDesktop ? 'bottomright' : 'bottomleft'}
          prefix={false}
        />
        <MapZoomControl />
      </MapContainer>
      {loading && !tileError && (
        <p
          className="pointer-events-none absolute left-1/2 top-1/2 z-[900] -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm text-gray-600 shadow-card"
          role="status"
        >
          地図を読み込んでいます…
        </p>
      )}
      {tileError && (
        <div
          className="absolute left-1/2 top-1/2 z-[900] -translate-x-1/2 rounded-lg border border-warning bg-white/95 p-3 text-center shadow-card"
          role="alert"
        >
          <p className="text-sm text-text">
            地図タイルを読み込めませんでした。一覧は引き続き利用できます。
          </p>
          <button
            type="button"
            onClick={() => {
              setTileError(false);
              setLoading(true);
              setTileKey((value) => value + 1);
            }}
            className="mt-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            地図を再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
