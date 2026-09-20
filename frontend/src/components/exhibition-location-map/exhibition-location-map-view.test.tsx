import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CAMPUS_MAP_CONFIG } from '@/lib/campus-map-config';
import type { CampusMapArea } from '@/lib/campus-map';
import type { AreaBounds } from '@/lib/exhibition-location-map';

const mapContainerProps: Record<string, unknown>[] = [];
const tileLayerProps: Record<string, unknown>[] = [];
const areaPolygonLayerProps: Record<string, unknown>[] = [];
const areaPinProps: Record<string, unknown>[] = [];
const recenterButtonProps: Record<string, unknown>[] = [];

vi.mock('react-leaflet', () => ({
  MapContainer: (props: Record<string, unknown>) => {
    mapContainerProps.push(props);
    return <div data-testid="map-container">{props.children as never}</div>;
  },
  TileLayer: (props: Record<string, unknown>) => {
    tileLayerProps.push(props);
    return <div data-testid="tile-layer" />;
  },
}));

vi.mock('@/components/campus-map/area-polygon-layer', () => ({
  AreaPolygonLayer: (props: Record<string, unknown>) => {
    areaPolygonLayerProps.push(props);
    return <div data-testid="area-polygon-layer" />;
  },
}));

vi.mock('./area-pin', () => ({
  AreaPin: (props: Record<string, unknown>) => {
    areaPinProps.push(props);
    return <div data-testid="area-pin" />;
  },
}));

vi.mock('./recenter-button', () => ({
  RecenterButton: (props: Record<string, unknown>) => {
    recenterButtonProps.push(props);
    return <div data-testid="recenter-button" />;
  },
}));

// GestureHandling は useMap (react-leaflet) に依存するため、地図構成の検証からは切り離す
vi.mock('./gesture-handling', () => ({
  GestureHandling: () => <div data-testid="gesture-handling" />,
}));

import { ExhibitionLocationMapView } from './exhibition-location-map-view';

function area(overrides: Partial<CampusMapArea>): CampusMapArea {
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

// 実機の pointer 種別 (coarse/fine) を切り替える。既定は非タッチ端末 (fine) とする
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('ExhibitionLocationMapView', () => {
  it('セクション内の有限高で地図を構成し、ビューポート高に依存させない', () => {
    mockMatchMedia(false);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    const outer = document.querySelector(
      '[data-testid="map-container"]',
    )!.parentElement!;
    expect(outer.className).toMatch(/h-\[240px\]/);
    expect(outer.className).toMatch(/md:h-\[360px\]/);
    expect(outer.className).not.toMatch(/h-dvh|h-screen|100vh|100svh/);
  });

  it('構内マップと同じ縮尺範囲と表示範囲の上限を適用する', () => {
    mockMatchMedia(false);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    const props = mapContainerProps.at(-1)!;
    expect(props.minZoom).toBe(CAMPUS_MAP_CONFIG.minZoom);
    expect(props.maxZoom).toBe(CAMPUS_MAP_CONFIG.maxZoom);
    expect(props.maxBounds).toEqual(CAMPUS_MAP_CONFIG.bounds);

    const tileProps = tileLayerProps.at(-1)!;
    expect(tileProps.url).toBe(CAMPUS_MAP_CONFIG.tileUrlTemplate);
    expect(tileProps.minZoom).toBe(CAMPUS_MAP_CONFIG.minZoom);
    expect(tileProps.maxZoom).toBe(CAMPUS_MAP_CONFIG.maxZoom);
  });

  it('初期表示は範囲のみを与え、中心と縮尺を個別には与えない', () => {
    mockMatchMedia(false);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    const props = mapContainerProps.at(-1)!;
    expect(props.bounds).toEqual([BOUNDS.southWest, BOUNDS.northEast]);
    expect(props.center).toBeUndefined();
    expect(props.zoom).toBeUndefined();
  });

  it('全エリアをポリゴン層へ渡し、選択状態を持たない', () => {
    mockMatchMedia(false);
    const allAreas = [area({ id: 1 }), area({ id: 2 }), area({ id: 3 })];
    render(
      <ExhibitionLocationMapView
        areas={allAreas}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    const props = areaPolygonLayerProps.at(-1)!;
    expect(props.areas).toEqual(allAreas);
    expect(props.selectedAreaId).toBeNull();
  });

  it('ポリゴンのクリックに副作用を持たせない', () => {
    mockMatchMedia(false);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    const onAreaClick = areaPolygonLayerProps.at(-1)!.onAreaClick as (
      areaId: number,
    ) => void;
    expect(() => onAreaClick(1)).not.toThrow();
    expect(onAreaClick(1)).toBeUndefined();
  });

  it('企画の所在エリアにのみピンを描画する', () => {
    mockMatchMedia(false);
    const allAreas = [area({ id: 1 }), area({ id: 2 }), area({ id: 3 })];
    const targetAreas = [area({ id: 2 })] as const;
    areaPinProps.length = 0;
    render(
      <ExhibitionLocationMapView
        areas={allAreas}
        targetAreas={targetAreas}
        bounds={BOUNDS}
      />,
    );

    expect(areaPinProps).toHaveLength(1);
    expect(areaPinProps[0]!.geometry).toEqual(targetAreas[0].geometry);
  });

  it('非タッチ端末では地図のドラッグ移動を許可する', () => {
    mockMatchMedia(false);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    expect(mapContainerProps.at(-1)!.dragging).toBe(true);
  });

  it('タッチ端末では地図のドラッグ移動を無効化し、1本指をページスクロールに譲る', () => {
    mockMatchMedia(true);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    expect(mapContainerProps.at(-1)!.dragging).toBe(false);
  });

  it('wheel 単体でのズームを無効化し、Ctrl 併用時のみ GestureHandling が扱う', () => {
    mockMatchMedia(false);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    expect(mapContainerProps.at(-1)!.scrollWheelZoom).toBe(false);
  });

  it('初期表示と同じ表示範囲を RecenterButton へ渡す', () => {
    mockMatchMedia(false);
    render(
      <ExhibitionLocationMapView
        areas={[area({ id: 1 })]}
        targetAreas={[area({ id: 1 })]}
        bounds={BOUNDS}
      />,
    );
    expect(recenterButtonProps.at(-1)!.bounds).toEqual(BOUNDS);
  });
});
