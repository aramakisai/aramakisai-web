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

describe('ExhibitionLocationMapView', () => {
  it('セクション内の有限高で地図を構成し、ビューポート高に依存させない', () => {
    render(
      <ExhibitionLocationMapView areas={[area({ id: 1 })]} bounds={BOUNDS} />,
    );
    const outer = document.querySelector(
      '[data-testid="map-container"]',
    )!.parentElement!;
    expect(outer.className).toMatch(/h-\[240px\]/);
    expect(outer.className).toMatch(/md:h-\[360px\]/);
    expect(outer.className).not.toMatch(/h-dvh|h-screen|100vh|100svh/);
  });

  it('構内マップと同じ縮尺範囲と表示範囲の上限を適用する', () => {
    render(
      <ExhibitionLocationMapView areas={[area({ id: 1 })]} bounds={BOUNDS} />,
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
    render(
      <ExhibitionLocationMapView areas={[area({ id: 1 })]} bounds={BOUNDS} />,
    );
    const props = mapContainerProps.at(-1)!;
    expect(props.bounds).toEqual([BOUNDS.southWest, BOUNDS.northEast]);
    expect(props.center).toBeUndefined();
    expect(props.zoom).toBeUndefined();
  });

  it('対象エリアをすべて同一の描画規則で描き、選択状態を持たない', () => {
    const areas = [area({ id: 1 }), area({ id: 2 })] as const;
    render(<ExhibitionLocationMapView areas={areas} bounds={BOUNDS} />);
    const props = areaPolygonLayerProps.at(-1)!;
    expect(props.areas).toEqual(areas);
    expect(props.selectedAreaId).toBeNull();
  });

  it('ポリゴンのクリックに副作用を持たせない', () => {
    render(
      <ExhibitionLocationMapView areas={[area({ id: 1 })]} bounds={BOUNDS} />,
    );
    const onAreaClick = areaPolygonLayerProps.at(-1)!.onAreaClick as (
      areaId: number,
    ) => void;
    expect(() => onAreaClick(1)).not.toThrow();
    expect(onAreaClick(1)).toBeUndefined();
  });

  it('来場者による拡大縮小と移動を受け付け、操作後も対象エリアの描画とピンが維持される', () => {
    const areas = [area({ id: 1 }), area({ id: 2 })] as const;
    areaPinProps.length = 0;
    render(<ExhibitionLocationMapView areas={areas} bounds={BOUNDS} />);

    // 拡大縮小・移動を無効化する props (leaflet の既定は有効) を明示的に false にしていないことを確認する
    const props = mapContainerProps.at(-1)!;
    expect(props.dragging).not.toBe(false);
    expect(props.scrollWheelZoom).not.toBe(false);
    expect(props.touchZoom).not.toBe(false);
    expect(props.doubleClickZoom).not.toBe(false);

    // ポリゴン層とピンは MapContainer の静的な子であり、地図の移動・拡大縮小を購読して
    // 消える分岐を持たない。操作の有無にかかわらず常に描画され続ける
    expect(areaPolygonLayerProps.at(-1)!.areas).toEqual(areas);
    expect(areaPinProps).toHaveLength(2);
    expect(areaPinProps[0]!.geometry).toEqual(areas[0].geometry);
    expect(areaPinProps[1]!.geometry).toEqual(areas[1].geometry);
  });

  it('初期表示と同じ表示範囲を RecenterButton へ渡す', () => {
    render(
      <ExhibitionLocationMapView areas={[area({ id: 1 })]} bounds={BOUNDS} />,
    );
    expect(recenterButtonProps.at(-1)!.bounds).toEqual(BOUNDS);
  });
});
