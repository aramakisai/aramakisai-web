'use client';

import 'leaflet/dist/leaflet.css';
import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { latLngBounds, point } from 'leaflet';
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

// 会場マップの MapViewportSync と同じ、ピンが画面端に接しないための余白
const FIT_MARGIN = 32;

// ズームボタン(幅 40)と globals.css の右余白(24)。ピンがボタンの裏に入らないよう右の余白に足す
const ZOOM_CONTROL_WIDTH = 40 + 24;

function mobileOverlayBottom(container: HTMLElement | null) {
  const overlay = document
    .querySelector('[data-regional-search-overlay]')
    ?.getBoundingClientRect();
  const top = container?.getBoundingClientRect().top ?? 0;
  return overlay?.height ? Math.max(0, overlay.bottom - top) : 0;
}

export interface RegionalSponsorMapViewProps {
  readonly profile: RegionalMapConfig | null;
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsorId: number | null;
  readonly isDesktop: boolean;
  readonly mobileBottomInset: number;
  /** SP で選択したピンへ寄せるとき、transition 前でもシートの移動先の高さを使うため */
  readonly getMobileSheetTargetHeight?: () => number | null;
  /** SP で展開したシートが地図を覆うとき、構内マップの全画面シートと同様にズームと出典表記を出さない */
  readonly controlsHidden?: boolean;
  readonly onSelectSponsor: (sponsorId: number) => void;
  readonly onSelectLocation: (locationKey: string) => void;
}

export function RegionalSponsorMapView({
  profile,
  sponsors,
  selectedSponsorId,
  isDesktop,
  mobileBottomInset,
  getMobileSheetTargetHeight,
  controlsHidden = false,
  onSelectSponsor,
  onSelectLocation,
}: RegionalSponsorMapViewProps) {
  const [loading, setLoading] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [tileKey, setTileKey] = useState(0);

  // 初回表示は絞り込み前の全ピンで固定する。以降の絞り込みで画角を戻さないため初期値だけ使う
  const [initialPinBounds] = useState(() =>
    sponsors.length > 0
      ? latLngBounds(sponsors.map((s) => [s.latitude, s.longitude]))
      : null,
  );
  const initialFitOptions = useCallback(
    (container: HTMLElement): FitBoundsOptions => {
      const rect = container.getBoundingClientRect();
      const panel = document
        .querySelector('[data-map-side-panel]')
        ?.getBoundingClientRect();
      const overlay = document
        .querySelector('[data-regional-search-overlay]')
        ?.getBoundingClientRect();
      // state の高さは ResizeObserver 経由で遅れるため、初回 fit は DOM の実測値を使う
      const sheetHeight = isDesktop
        ? 0
        : (document
            .querySelector('[data-testid="map-bottom-sheet"]')
            ?.getBoundingClientRect().height ?? mobileBottomInset);
      const left = panel?.width ? Math.max(0, panel.right - rect.left) : 0;
      const top = overlay?.height ? Math.max(0, overlay.bottom - rect.top) : 0;
      return {
        paddingTopLeft: [left + FIT_MARGIN, top + FIT_MARGIN],
        paddingBottomRight: [
          FIT_MARGIN + ZOOM_CONTROL_WIDTH,
          FIT_MARGIN + (isDesktop ? 16 : sheetHeight),
        ],
        // 1 件だけ、または全件が近接のときに過剰に寄らないよう従来の初期 zoom を上限にする
        maxZoom: profile?.initialZoom,
        animate: false,
      };
    },
    [isDesktop, mobileBottomInset, profile?.initialZoom],
  );

  const fitOptions = useMemo<FitBoundsOptions>(
    () => ({
      paddingTopLeft: isDesktop ? [396, 24] : [16, 136],
      paddingBottomRight: isDesktop ? [24, 24] : [16, mobileBottomInset + 16],
      animate: false,
    }),
    [isDesktop, mobileBottomInset],
  );
  const focusFitOptions = useCallback((): FitBoundsOptions => {
    if (isDesktop) return fitOptions;
    const sheetHeight = getMobileSheetTargetHeight?.() ?? mobileBottomInset;
    return { ...fitOptions, paddingBottomRight: [16, sheetHeight + 16] };
  }, [fitOptions, getMobileSheetTargetHeight, isDesktop, mobileBottomInset]);
  // 範囲外のタイルが見えないよう、広げる幅と最小 zoom の余白は覆い隠される領域(SP の検索 overlay と
  // シート)だけにする。PC はパネルの隙間から範囲外が見えるため広げず、画面全体を範囲で覆う
  const maxBoundsPadding = useCallback(
    (container: HTMLElement): FitBoundsOptions => ({
      paddingTopLeft: [0, mobileOverlayBottom(container)],
      paddingBottomRight: [0, mobileBottomInset],
    }),
    [mobileBottomInset],
  );
  const minZoomPadding = useMemo<Point | undefined>(
    () =>
      isDesktop
        ? undefined
        : point(0, mobileOverlayBottom(null) + mobileBottomInset),
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
  const controlInset = isDesktop ? 0 : Math.max(0, mobileBottomInset);

  return (
    <div
      className={`regional-sponsor-map relative h-full w-full ${controlsHidden ? '[&_.leaflet-control-container]:invisible' : ''}`}
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
          initialFitBounds={initialPinBounds}
          initialFitOptions={initialFitOptions}
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
          focusFitOptions={focusFitOptions}
          refocusKey={isDesktop ? 'desktop' : 'mobile'}
          extendMaxBoundsByPadding={!isDesktop}
          maxBoundsPadding={maxBoundsPadding}
        />
        <RegionalSponsorMarkerLayer
          sponsors={sponsors}
          selectedSponsorId={selectedSponsorId}
          profile={profile}
          markerSize={isDesktop ? 48 : 32}
          visibleAreaOptions={initialFitOptions}
          onSelectSponsor={onSelectSponsor}
          onSelectLocation={onSelectLocation}
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
