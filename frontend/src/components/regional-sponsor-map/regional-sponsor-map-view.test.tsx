import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REGIONAL_MAP_TILE_PROFILE as profile } from '@/lib/map-tile-profile';

const mocks = vi.hoisted(() => ({
  mapProps: [] as Record<string, unknown>[],
  tileProps: [] as Record<string, unknown>[],
  viewportProps: [] as Record<string, unknown>[],
  markerProps: [] as Record<string, unknown>[],
  attributionProps: [] as Record<string, unknown>[],
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

vi.mock('@/components/map/map-viewport-controller', () => ({
  MapViewportController: (props: Record<string, unknown>) => {
    mocks.viewportProps.push(props);
    return null;
  },
}));

vi.mock('@/components/map/map-zoom-control', () => ({
  MapZoomControl: () => <div data-testid="zoom-control" />,
}));

vi.mock('./regional-sponsor-marker-layer', () => ({
  RegionalSponsorMarkerLayer: (props: Record<string, unknown>) => {
    mocks.markerProps.push(props);
    return <div data-testid="marker-layer" />;
  },
}));

import { RegionalSponsorMapView } from './regional-sponsor-map-view';

const fitOptionsOf = (name: 'fitOptions') =>
  (mocks.viewportProps.at(-1)![name] as () => unknown)();

const baseProps = {
  sponsors: [],
  selectedSponsorId: null,
  isDesktop: true,
  mobileBottomInset: 0,
  onSelectSponsor: vi.fn(),
  onSelectLocation: vi.fn(),
};

beforeEach(() => {
  Object.values(mocks).forEach((list) => (list.length = 0));
});

describe('RegionalSponsorMapView', () => {
  it('地域profileの自前タイル・範囲・zoom・出典・余白をLeafletへ接続する', () => {
    render(<RegionalSponsorMapView {...baseProps} />);

    expect(mocks.tileProps.at(-1)).toMatchObject({
      url: '/regional-map-tiles/{z}/{x}/{y}.webp',
      minNativeZoom: profile.minNativeZoom,
      maxNativeZoom: profile.maxNativeZoom,
      errorTileUrl: expect.stringContaining('data:image/gif'),
    });
    expect(mocks.viewportProps.at(-1)).toMatchObject({
      minZoom: profile.minZoom,
      minZoomPadding: undefined,
      maxBoundsPadding: undefined,
      focusCenter: null,
      focusKey: null,
      focusZoom: profile.maxNativeZoom,
      maxBounds: profile.bounds,
    });
    expect(fitOptionsOf('fitOptions')).toMatchObject({
      paddingTopLeft: [396, 24],
    });
    expect(mocks.markerProps.at(-1)).toMatchObject({ markerSize: 48 });
    expect(mocks.attributionProps.at(-1)).toEqual({
      position: 'bottomright',
      prefix: false,
    });
    expect(screen.getByTestId('zoom-control')).toBeInTheDocument();
  });

  it('passes the selected sponsor position to the shared viewport controller', () => {
    render(
      <RegionalSponsorMapView
        {...baseProps}
        sponsors={[
          {
            id: 101,
            name: '選択店舗',
            category: 'shop',
            latitude: 36.5,
            longitude: 139.2,
            address: '群馬県前橋市',
            imageId: null,
            imageAlt: null,
            imageDecorative: false,
            message: null,
            businessHours: null,
            phone: null,
            websiteUrl: null,
          },
        ]}
        selectedSponsorId={101}
      />,
    );

    expect(mocks.viewportProps.at(-1)).toMatchObject({
      focusCenter: [36.5, 139.2],
      focusKey: 101,
      focusZoom: profile.maxNativeZoom,
    });
  });

  it('スマートフォンは32pxピン・左下出典・上部とsheetのfit余白を使う', () => {
    render(
      <RegionalSponsorMapView
        {...baseProps}
        isDesktop={false}
        mobileBottomInset={380}
      />,
    );
    expect(mocks.markerProps.at(-1)).toMatchObject({ markerSize: 32 });
    expect(mocks.viewportProps.at(-1)).toMatchObject({
      minZoomPadding: { x: 0, y: 380 },
      maxBoundsPadding: expect.any(Function),
    });
    expect(fitOptionsOf('fitOptions')).toMatchObject({
      paddingTopLeft: [16, 136],
      paddingBottomRight: [16, 396],
    });
    expect(mocks.attributionProps.at(-1)).toEqual({
      position: 'bottomleft',
      prefix: false,
    });
    expect(screen.getByTestId('leaflet-map').parentElement).toHaveStyle({
      '--regional-map-bottom-inset': '380px',
    });
  });

  it('loading、透明error tile、失敗通知、再読込を一覧を覆わず提供する', () => {
    render(<RegionalSponsorMapView {...baseProps} />);
    expect(screen.getByText('地図を読み込んでいます…')).toBeInTheDocument();
    const events = mocks.tileProps.at(-1)!.eventHandlers as Record<
      string,
      () => void
    >;

    act(() => events.load());
    expect(
      screen.queryByText('地図を読み込んでいます…'),
    ).not.toBeInTheDocument();
    act(() => events.tileerror());
    expect(screen.getByRole('alert')).toHaveTextContent(
      '一覧は引き続き利用できます',
    );
    fireEvent.click(screen.getByRole('button', { name: '地図を再読み込み' }));
    expect(screen.getByText('地図を読み込んでいます…')).toBeInTheDocument();
    expect(mocks.tileProps.length).toBeGreaterThan(1);
  });
});
