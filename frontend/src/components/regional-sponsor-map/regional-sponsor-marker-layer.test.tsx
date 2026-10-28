import { useLayoutEffect, useRef } from 'react';
import type { ReactNode, Ref } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  getContainer: () => document.body,
};

vi.mock('react-leaflet', () => ({
  useMapEvents: (handlers: Record<string, () => void>) => {
    mocks.handlers = handlers;
    return map;
  },
  Marker: ({
    ref,
    title,
    zIndexOffset,
    eventHandlers,
    icon,
    keyboard,
  }: {
    ref?: Ref<{ getElement: () => HTMLButtonElement | null }>;
    title: string;
    zIndexOffset?: number;
    eventHandlers: {
      add?: (event: {
        target: { getElement: () => HTMLButtonElement | null };
      }) => void;
      click: () => void;
    };
    icon: {
      options: { html?: string | HTMLElement | false; className?: string };
    };
    keyboard?: boolean;
    children?: ReactNode;
  }) => {
    const elementRef = useRef<HTMLButtonElement>(null);
    useLayoutEffect(() => {
      const marker = { getElement: () => elementRef.current };
      if (typeof ref === 'function') ref(marker);
      eventHandlers.add?.({ target: marker });
      return () => {
        if (typeof ref === 'function') ref(null);
      };
    }, [eventHandlers, ref]);
    return (
      <button
        ref={elementRef}
        type="button"
        aria-label={title}
        aria-current={
          String(icon.options.className).includes('--selected')
            ? 'true'
            : undefined
        }
        data-icon-html={String(icon.options.html)}
        data-z-index={zIndexOffset}
        data-leaflet-keyboard={String(keyboard)}
        onClick={eventHandlers.click}
      >
        {title}
      </button>
    );
  },
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
    phone: null,
    websiteUrl: null,
    order: id,
  };
}

const baseProps = {
  profile,
  markerSize: 48 as const,
  visibleAreaOptions: () => ({
    paddingTopLeft: [12, 34] as [number, number],
    paddingBottomRight: [56, 78] as [number, number],
    maxZoom: 15,
    animate: false,
  }),
  selectedSponsorId: null,
  onSelectSponsor: vi.fn(),
  onSelectLocation: vi.fn(),
};

beforeEach(() => {
  mocks.zoom = 10;
  mocks.fitBounds.mockReset();
  baseProps.onSelectSponsor.mockReset();
  baseProps.onSelectLocation.mockReset();
  vi.unstubAllGlobals();
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

  it.each(['Enter', ' '])('%sで単独ピンを一度だけ選択する', (key) => {
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1)]}
      />,
    );
    const pin = screen.getByRole('button', { name: 'テスト専用1、病院' });
    pin.focus();
    fireEvent.keyDown(pin, { key });

    expect(pin).toHaveFocus();
    expect(baseProps.onSelectSponsor).toHaveBeenCalledTimes(1);
    expect(pin).toHaveAttribute('data-leaflet-keyboard', 'false');
  });

  it('異なる座標のclusterを初回の余白と maxZoom 17 相当の上限で拡大する', () => {
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
    const [, options] = mocks.fitBounds.mock.calls[0]!;
    expect(options).toEqual({
      paddingTopLeft: [12, 34],
      paddingBottomRight: [56, 78],
      maxZoom: 18,
    });
    expect(baseProps.onSelectLocation).not.toHaveBeenCalled();
  });

  it('reduced motion では cluster の拡大をアニメーションしない', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1), sponsor(2, 36.41, 139.11)]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /2件の地域協賛/ }));
    expect(mocks.fitBounds.mock.calls[0]![1]).toMatchObject({
      animate: false,
      maxZoom: 18,
    });
  });

  it('同一座標の企業は1本の地点ピンになり、選ぶと地図を動かさず地点の一覧を開く', () => {
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1), sponsor(2, 36.4, 139.1)]}
      />,
    );
    const pin = screen.getByRole('button', {
      name: '2件の地域協賛：テスト専用1（病院）、テスト専用2（ショップ）。選択して一覧を表示',
    });
    expect(pin).toHaveAttribute(
      'data-icon-html',
      expect.stringContaining('pin-neutral.svg'),
    );
    fireEvent.click(pin);
    expect(baseProps.onSelectLocation).toHaveBeenCalledWith('1,2');
    expect(mocks.fitBounds).not.toHaveBeenCalled();
    expect(baseProps.onSelectSponsor).not.toHaveBeenCalled();
  });

  it('同一座標の企業を選択中は、中立色の地点ピンの代わりに選択ピンだけを出す', () => {
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1), sponsor(2, 36.4, 139.1)]}
        selectedSponsorId={2}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'テスト専用2、ショップ' }),
    ).toHaveAttribute('aria-current', 'true');
  });

  it('最大zoomでは座標が数pxだけ違う企業を1本の地点ピンにまとめ、押すと地点の一覧を開く', () => {
    mocks.zoom = 18;
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[
          sponsor(1, 36.4, 139.1),
          sponsor(2, 36.41, 139.1),
          sponsor(3, 37.9, 139.1),
        ]}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
    fireEvent.click(
      screen.getByRole('button', {
        name: '2件の地域協賛：テスト専用1（病院）、テスト専用2（ショップ）。選択して一覧を表示',
      }),
    );
    expect(baseProps.onSelectLocation).toHaveBeenCalledWith('1,2');
    expect(mocks.fitBounds).not.toHaveBeenCalled();
  });

  it('最大zoomでもマーカー径より離れた企業は個別のピンにする', () => {
    mocks.zoom = 18;
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1), sponsor(2, 37.4, 139.1)]}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'テスト専用1、病院' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'テスト専用2、ショップ' }),
    ).toBeInTheDocument();
  });

  it('重なったピンは一覧の並びで後のものを前面にする', () => {
    mocks.zoom = 18;
    render(
      <RegionalSponsorMarkerLayer
        {...baseProps}
        sponsors={[sponsor(1, 36.4, 139.1), sponsor(2, 37.4, 139.11)]}
      />,
    );
    const z = (name: string) =>
      Number(screen.getByRole('button', { name }).dataset.zIndex);
    expect(z('テスト専用2、ショップ')).toBeGreaterThan(z('テスト専用1、病院'));
  });

  it('画面で下にあるピンでも順位が後なら前面になり、選択中は常に最前面になる', () => {
    mocks.zoom = 18;
    // mock の project は y = 経度*100。ピン1は ピン2・3 より y が 5000px 大きい(画面で下)
    const sponsors = [
      sponsor(1, 36.4, 189.1),
      sponsor(2, 37.41, 139.11),
      sponsor(3, 38.42, 139.12),
    ];
    const layout = (selectedSponsorId: number | null) => {
      const { unmount } = render(
        <RegionalSponsorMarkerLayer
          {...baseProps}
          sponsors={sponsors}
          selectedSponsorId={selectedSponsorId}
        />,
      );
      const front = (id: number, lng: number) =>
        Number(
          screen.getByRole('button', {
            name: new RegExp(`^テスト専用${id}、`),
          }).dataset.zIndex,
        ) +
        lng * 100;
      const result = [front(1, 189.1), front(2, 139.11), front(3, 139.12)];
      unmount();
      return result;
    };
    const [a, b, c] = layout(null);
    expect(c).toBeGreaterThan(b!);
    expect(b).toBeGreaterThan(a!);
    const [a1, b1, c1] = layout(1);
    expect(a1).toBeGreaterThan(Math.max(b1!, c1!));
  });
});
