import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CampusMapArea } from '@/lib/campus-map';
import type { AreaBounds } from '@/lib/exhibition-location-map';

type DynamicOptions = {
  readonly ssr?: boolean;
  readonly loading?: () => ReactNode;
};

// vi.mock はファイル先頭へ巻き上げられるため、参照する可変値は vi.hoisted で用意する
const state = vi.hoisted(() => ({
  dynamicOptions: undefined as DynamicOptions | undefined,
  shouldThrow: false,
}));

// ExhibitionLocationMapView (Leaflet 依存) の実体を読み込ませず、
// dynamic() の呼び出しオプションと読み込み失敗時の挙動を検証対象にする
vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options?: DynamicOptions) => {
    state.dynamicOptions = options;
    return function MockedExhibitionLocationMapView() {
      if (state.shouldThrow) {
        throw new Error('failed to load map view');
      }
      return <div data-testid="map-view" />;
    };
  },
}));

import { ExhibitionLocationMap } from './exhibition-location-map';

function area(overrides: Partial<CampusMapArea> = {}): CampusMapArea {
  return {
    id: 1,
    name: 'Aゾーン',
    color: 'primary',
    sort: 0,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [139.0, 36.43],
          [139.001, 36.43],
          [139.001, 36.431],
          [139.0, 36.431],
          [139.0, 36.43],
        ],
      ],
    },
    ...overrides,
  };
}

const BOUNDS: AreaBounds = {
  southWest: [36.42, 139.0],
  northEast: [36.44, 139.02],
};

const MAP_HREF = '/map?area=1';

describe('ExhibitionLocationMap', () => {
  afterEach(() => {
    state.shouldThrow = false;
    vi.restoreAllMocks();
  });

  it('地図本体をクライアント側で SSR なしに遅延読み込みする (要件 5.4)', () => {
    render(
      <ExhibitionLocationMap
        areas={[area()]}
        bounds={BOUNDS}
        mapHref={MAP_HREF}
        areaNames={['Aゾーン']}
      />,
    );
    expect(state.dynamicOptions?.ssr).toBe(false);
  });

  it('読み込み中はセクションの占有領域 (Figma 実測: 95:4/95:46) を確保する (要件 5.1)', () => {
    render(
      <ExhibitionLocationMap
        areas={[area()]}
        bounds={BOUNDS}
        mapHref={MAP_HREF}
        areaNames={['Aゾーン']}
      />,
    );
    render(<>{state.dynamicOptions?.loading?.()}</>);

    const placeholder = screen.getByRole('status');
    expect(placeholder.className).toMatch(/h-\[240px\]/);
    expect(placeholder.className).toMatch(/md:h-\[360px\]/);
  });

  it('地図の描画資産の読み込みに失敗した場合、エリア名と構内マップページへの遷移リンクへ切り替える (要件 5.2)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.shouldThrow = true;

    render(
      <ExhibitionLocationMap
        areas={[area()]}
        bounds={BOUNDS}
        mapHref={MAP_HREF}
        areaNames={['Aゾーン', 'Bゾーン']}
      />,
    );

    expect(screen.queryByTestId('map-view')).not.toBeInTheDocument();
    expect(screen.getByText(/Aゾーン/)).toBeInTheDocument();
    expect(screen.getByText(/Bゾーン/)).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', MAP_HREF);
  });

  it('読み込みに成功した場合は地図本体を描画する', () => {
    render(
      <ExhibitionLocationMap
        areas={[area()]}
        bounds={BOUNDS}
        mapHref={MAP_HREF}
        areaNames={['Aゾーン']}
      />,
    );
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });
});
