import type { ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegionalMapConfig } from '@/lib/regional-map-config';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

const mocks = vi.hoisted(() => ({
  zoom: 10,
  handlers: {} as Record<string, () => void>,
  fitBounds: vi.fn(),
}));

const map = {
  getZoom: () => mocks.zoom,
  project: ([latitude, longitude]: readonly number[]) => ({
    x: latitude! * 100,
    y: longitude! * 100,
  }),
  unproject: ([x, y]: readonly number[]) => ({ lat: x! / 100, lng: y! / 100 }),
  fitBounds: mocks.fitBounds,
};

vi.mock('react-leaflet', () => ({
  useMapEvents: (handlers: Record<string, () => void>) => {
    mocks.handlers = handlers;
    return map;
  },
  Marker: ({
    title,
    zIndexOffset,
    eventHandlers,
    icon,
  }: {
    title: string;
    zIndexOffset?: number;
    eventHandlers: { click: () => void };
    icon: { options: { html?: string | HTMLElement | false } };
    children?: ReactNode;
  }) => (
    <button
      type="button"
      aria-label={title}
      aria-current={zIndexOffset === 1000 ? 'true' : undefined}
      data-icon-html={String(icon.options.html)}
      onClick={eventHandlers.click}
    >
      {title}
    </button>
  ),
}));

import { RegionalSponsorMarkerLayer } from './regional-sponsor-marker-layer';

const profile: RegionalMapConfig = {
  id: 'regional',
  bounds: [
    [36, 139],
    [37, 140],
  ],
  minZoom: 8,
  maxZoom: 18,
  minNativeZoom: 8,
  maxNativeZoom: 16,
  publicDirectory: 'public/regional-map-tiles',
  urlTemplate: '/regional-map-tiles/{z}/{x}/{y}.webp',
  expectedMaxTileCount: 10,
  expectedMaxBytes: 10,
  initialCenter: [36.43068, 139.044795],
  initialZoom: 15.5,
  focusZoom: 15.5,
};

function sponsor(
  id: number,
  latitude: number,
  longitude: number,
): RegionalSponsor {
  return {
    id,
    name: `テスト専用${id}`,
    category: id === 1 ? 'hospital' : 'shop',
    latitude,
    longitude,
    address: null,
    imageId: null,
    imageAlt: null,
    imageDecorative: false,
    message: null,
    businessHours: null,
    closedDays: null,
    phone: null,
    websiteUrl: null,
    order: id,
  };
}

const baseProps = {
  profile,
  markerSize: 48 as const,
  fitOptions: { animate: false },
  selectedSponsorId: null,
  spiderfiedClusterId: null,
  onSelectSponsor: vi.fn(),
  onSpiderfyChange: vi.fn(),
};

beforeEach(() => {
  mocks.zoom = 10;
  mocks.fitBounds.mockReset();
  baseProps.onSelectSponsor.mockReset();
  baseProps.onSpiderfyChange.mockReset();
});

describe('RegionalSponsorMarkerLayer', () => {
  it('カテゴリ名を含む単独ピンから詳細を開き、選択中を色以外でも示す', () => {
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1)]}
        selectedSponsorId={1}
      />,
    );
    const pin = screen.getByRole('button', { name: 'テスト専用1、病院' });
    expect(pin).toHaveAttribute('aria-current', 'true');
    expect(pin).toHaveAttribute(
      'data-icon-html',
      expect.stringContaining('pin-hospital.svg'),
    );
    fireEvent.click(pin);
    expect(baseProps.onSelectSponsor).toHaveBeenCalledWith(1);
  });

  it('異なる座標のclusterを余白付きで拡大する', () => {
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1), sponsor(2, 36.41, 139.11)]}
      />,
    );
    const cluster = screen.getByRole('button', {
      name: '2件の地域協賛：テスト専用1（病院）、テスト専用2（ショップ）。選択して拡大',
    });
    expect(cluster).toHaveAttribute(
      'data-icon-html',
      expect.stringContaining('pin-neutral.svg'),
    );
    expect(cluster.getAttribute('data-icon-html')).not.toContain('>2<');
    fireEvent.click(cluster);
    expect(mocks.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ animate: false, maxZoom: 18 }),
    );
  });

  it('同一座標clusterを放射状展開し、各店舗を個別選択できる', () => {
    const same = [sponsor(1, 36.4, 139.1), sponsor(2, 36.4, 139.1)];
    const { rerender } = render(
      <RegionalSponsorMarkerLayer {...baseProps} sponsors={same} />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: '2件の地域協賛：テスト専用1（病院）、テスト専用2（ショップ）。選択して拡大',
      }),
    );
    expect(baseProps.onSpiderfyChange).toHaveBeenCalledWith('cluster:1,2');

    rerender(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={same}
        spiderfiedClusterId="cluster:1,2"
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'テスト専用2、ショップ' }),
    );
    expect(baseProps.onSelectSponsor).toHaveBeenCalledWith(2);
  });

  it('地図移動・zoom・背景選択で展開を閉じる', () => {
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1), sponsor(2, 36.4, 139.1)]}
        spiderfiedClusterId="cluster:1,2"
      />,
    );
    act(() => {
      mocks.handlers.moveend();
      mocks.handlers.zoomend();
      mocks.handlers.click();
    });
    expect(baseProps.onSpiderfyChange).toHaveBeenCalledTimes(3);
    expect(baseProps.onSpiderfyChange).toHaveBeenLastCalledWith(null);
  });
});
