import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REGIONAL_MAP_TILE_PROFILE as profile } from '@/lib/map-tile-profile';

const mocks = vi.hoisted(() => ({
  above: true,
  mapProps: [] as Record<string, unknown>[],
  tileProps: [] as Record<string, unknown>[],
  viewportProps: [] as Record<string, unknown>[],
  markerProps: [] as Record<string, unknown>[],
  attributionProps: [] as Record<string, unknown>[],
  prefetchProps: [] as Record<string, unknown>[],
  locationProps: [] as Record<string, unknown>[],
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => {
    mocks.mapProps.push(props);
    return <div data-testid="leaflet-map">{children}</div>;
  },
  TileLayer: (props: Record<string, unknown>) => {
    mocks.tileProps.push(props);
    return <div data-testid="tile-layer" />;
  },
  AttributionControl: (props: Record<string, unknown>) => {
    mocks.attributionProps.push(props);
    return <div data-testid="attribution" />;
  },
}));

vi.mock('@/components/map/use-is-above-map-breakpoint', () => ({
  useIsAboveMapBreakpoint: () => mocks.above,
}));

vi.mock('@/components/map/map-viewport-controller', () => ({
  MapViewportController: (props: Record<string, unknown>) => {
    mocks.viewportProps.push(props);
    return null;
  },
}));

vi.mock('@/components/map/map-zoom-control', () => ({
  MapZoomControl: () => <div data-testid="zoom-control" />,
}));

vi.mock('@/components/map/map-tile-prefetch', () => ({
  MapTilePrefetch: (props: Record<string, unknown>) => {
    mocks.prefetchProps.push(props);
    return null;
  },
}));

vi.mock('@/components/map/map-user-location', () => ({
  MapUserLocation: (props: Record<string, unknown>) => {
    mocks.locationProps.push(props);
    return <div data-testid="user-location" />;
  },
}));

vi.mock('./regional-sponsor-marker-layer', () => ({
  RegionalSponsorMarkerLayer: (props: Record<string, unknown>) => {
    mocks.markerProps.push(props);
    return <div data-testid="marker-layer" />;
  },
}));

import { RegionalSponsorMapView } from './regional-sponsor-map-view';

const container = document.createElement('div');
const fitOptionsOf = (name: 'fitOptions' | 'focusFitOptions') =>
  (mocks.viewportProps.at(-1)![name] as (c: HTMLElement) => unknown)(container);

function sponsor(id: number, latitude: number, longitude: number) {
  return {
    id,
    name: `店舗${id}`,
    category: 'shop' as const,
    latitude,
    longitude,
    address: null,
    imageId: null,
    imageAlt: null,
    imageDecorative: false,
    message: null,
    businessHours: null,
    phone: null,
    websiteUrl: null,
  };
}

const baseProps = {
  sponsors: [],
  fitSponsors: [],
  selectedSponsorId: null,
  onSelectSponsor: vi.fn(),
  onSelectLocation: vi.fn(),
};

beforeEach(() => {
  mocks.above = true;
  for (const key of [
    'mapProps',
    'tileProps',
    'viewportProps',
    'markerProps',
    'attributionProps',
    'prefetchProps',
    'locationProps',
  ] as const) {
    mocks[key].length = 0;
  }
});

describe('RegionalSponsorMapView', () => {
  it('地域profileの自前タイル・範囲・zoom・出典を構内マップと同じ部品へ接続する', () => {
    render(<RegionalSponsorMapView {...baseProps} />);

    expect(mocks.tileProps.at(-1)).toMatchObject({
      url: '/regional-map-tiles/{z}/{x}/{y}.webp',
      minNativeZoom: profile.minNativeZoom,
      maxNativeZoom: profile.maxNativeZoom,
      errorTileUrl: expect.stringContaining('data:image/gif'),
    });
    expect(mocks.prefetchProps.at(-1)).toEqual({ profile });
    expect(mocks.locationProps.at(-1)).toEqual({ bounds: profile.bounds });
    expect(mocks.viewportProps.at(-1)).toMatchObject({
      minZoom: profile.minZoom,
      focusCenter: null,
      focusKey: null,
      focusZoom: profile.maxNativeZoom,
      maxBounds: profile.bounds,
    });
    expect(mocks.markerProps.at(-1)).toMatchObject({ markerSize: 48 });
    expect(mocks.attributionProps.at(-1)).toEqual({
      position: 'bottomright',
      prefix: false,
    });
    expect(screen.getByTestId('zoom-control')).toBeInTheDocument();
  });

  it('初期表示は全ピンの範囲に fit し、操作するまでリサイズで再 fit できるよう fitBounds で渡す', () => {
    render(
      <RegionalSponsorMapView
        {...baseProps}
        fitSponsors={[sponsor(1, 36.4, 139.0), sponsor(2, 36.5, 139.2)]}
      />,
    );
    const { fitBounds } = mocks.viewportProps.at(-1) as {
      fitBounds: { getSouthWest: () => { lat: number } };
    };
    expect(fitBounds.getSouthWest().lat).toBe(36.4);
    expect(mocks.viewportProps.at(-1)).not.toHaveProperty('initialCenter');
    expect(mocks.mapProps.at(-1)).toHaveProperty('bounds', fitBounds);
  });

  it('fit の余白は構内マップの算出を使い、寄せ先にも同じ余白を使う', () => {
    render(<RegionalSponsorMapView {...baseProps} />);
    expect(fitOptionsOf('fitOptions')).toMatchObject({
      paddingTopLeft: [32, 32],
      paddingBottomRight: [32, 32 + 16],
      animate: false,
    });
    expect(fitOptionsOf('focusFitOptions')).toEqual(fitOptionsOf('fitOptions'));
  });

  it('選択した店舗の位置を共通の viewport controller へ渡す', () => {
    render(
      <RegionalSponsorMapView
        {...baseProps}
        sponsors={[sponsor(101, 36.5, 139.2)]}
        selectedSponsorId={101}
      />,
    );
    expect(mocks.viewportProps.at(-1)).toMatchObject({
      focusCenter: [36.5, 139.2],
      focusKey: 101,
      focusZoom: profile.maxNativeZoom,
    });
  });

  it('スマートフォンは32pxピンと左下の出典を使う', () => {
    mocks.above = false;
    render(<RegionalSponsorMapView {...baseProps} />);
    expect(mocks.markerProps.at(-1)).toMatchObject({ markerSize: 32 });
    expect(mocks.attributionProps.at(-1)).toEqual({
      position: 'bottomleft',
      prefix: false,
    });
  });
});
