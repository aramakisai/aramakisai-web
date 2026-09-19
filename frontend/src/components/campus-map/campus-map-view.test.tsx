import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CAMPUS_MAP_CONFIG, MAP_ATTRIBUTION } from '@/lib/campus-map-config';
import type { CampusMapArea } from '@/lib/campus-map';

// campus-map.ts は cms.ts (env.ts の起動時検証を含む) に依存するため、
// area-polygon-layer.test.tsx と同様にモックしてユニットテストの対象外にする。
vi.mock('@/lib/cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

const mapContainerProps: Record<string, unknown>[] = [];
const tileLayerProps: Record<string, unknown>[] = [];
const areaPolygonLayerProps: Record<string, unknown>[] = [];
let mapZoomControlRenderCount = 0;

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

vi.mock('./area-polygon-layer', () => ({
  AreaPolygonLayer: (props: Record<string, unknown>) => {
    areaPolygonLayerProps.push(props);
    return <div data-testid="area-polygon-layer" />;
  },
}));

vi.mock('./map-zoom-control', () => ({
  MapZoomControl: () => {
    mapZoomControlRenderCount += 1;
    return <div data-testid="map-zoom-control" />;
  },
}));

import { CampusMapView } from './campus-map-view';

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

describe('CampusMapView', () => {
  it('中心・初期ズーム・ズーム範囲・表示範囲の上限を設定値から渡す', () => {
    render(
      <CampusMapView
        areas={[]}
        selectedAreaId={null}
        onSelectArea={() => {}}
      />,
    );
    const props = mapContainerProps.at(-1)!;
    expect(props.center).toEqual(CAMPUS_MAP_CONFIG.center);
    expect(props.zoom).toBe(CAMPUS_MAP_CONFIG.initialZoom);
    expect(props.minZoom).toBe(CAMPUS_MAP_CONFIG.minZoom);
    expect(props.maxZoom).toBe(CAMPUS_MAP_CONFIG.maxZoom);
    expect(props.maxBounds).toEqual(CAMPUS_MAP_CONFIG.bounds);
  });

  it('表示範囲の外へドラッグできないよう粘性を最大にする', () => {
    render(
      <CampusMapView
        areas={[]}
        selectedAreaId={null}
        onSelectArea={() => {}}
      />,
    );
    expect(mapContainerProps.at(-1)!.maxBoundsViscosity).toBe(1);
  });

  it('地図コンテナに明示的な高さを与える', () => {
    render(
      <CampusMapView
        areas={[]}
        selectedAreaId={null}
        onSelectArea={() => {}}
      />,
    );
    const className = mapContainerProps.at(-1)!.className as string;
    expect(className).toMatch(/h-dvh|h-screen|h-full/);
  });

  it('タイルレイヤーに URL テンプレートと読み込み範囲・ズーム範囲を渡す', () => {
    render(
      <CampusMapView
        areas={[]}
        selectedAreaId={null}
        onSelectArea={() => {}}
      />,
    );
    const props = tileLayerProps.at(-1)!;
    expect(props.url).toBe(CAMPUS_MAP_CONFIG.tileUrlTemplate);
    expect(props.bounds).toEqual(CAMPUS_MAP_CONFIG.bounds);
    expect(props.minZoom).toBe(CAMPUS_MAP_CONFIG.minZoom);
    expect(props.maxZoom).toBe(CAMPUS_MAP_CONFIG.maxZoom);
  });

  it('出典表記を常時表示する', () => {
    render(
      <CampusMapView
        areas={[]}
        selectedAreaId={null}
        onSelectArea={() => {}}
      />,
    );
    expect(tileLayerProps.at(-1)!.attribution).toBe(MAP_ATTRIBUTION);
  });

  it('タイル読み込み失敗時の代替画像を指定する', () => {
    render(
      <CampusMapView
        areas={[]}
        selectedAreaId={null}
        onSelectArea={() => {}}
      />,
    );
    expect(tileLayerProps.at(-1)!.errorTileUrl as string).toMatch(
      /^data:image\//,
    );
  });

  it('エリア一覧と選択中 ID を AreaPolygonLayer へ渡す', () => {
    const areas = [area({ id: 1 }), area({ id: 2 })];
    render(
      <CampusMapView
        areas={areas}
        selectedAreaId={2}
        onSelectArea={() => {}}
      />,
    );
    const props = areaPolygonLayerProps.at(-1)!;
    expect(props.areas).toEqual(areas);
    expect(props.selectedAreaId).toBe(2);
  });

  it('既定の拡大縮小コントロールを無効化しカスタムのコントロールに置き換える', () => {
    render(
      <CampusMapView
        areas={[]}
        selectedAreaId={null}
        onSelectArea={() => {}}
      />,
    );
    expect(mapContainerProps.at(-1)!.zoomControl).toBe(false);
    expect(mapZoomControlRenderCount).toBeGreaterThan(0);
  });

  it('未選択のエリアをクリックすると選択中の識別子で通知する', () => {
    const onSelectArea = vi.fn();
    render(
      <CampusMapView
        areas={[area({ id: 3 })]}
        selectedAreaId={null}
        onSelectArea={onSelectArea}
      />,
    );
    const onAreaClick = areaPolygonLayerProps.at(-1)!.onAreaClick as (
      areaId: number,
    ) => void;
    onAreaClick(3);
    expect(onSelectArea).toHaveBeenCalledWith(3);
  });

  it('選択中のエリアを再度クリックすると解除として通知する', () => {
    const onSelectArea = vi.fn();
    render(
      <CampusMapView
        areas={[area({ id: 3 })]}
        selectedAreaId={3}
        onSelectArea={onSelectArea}
      />,
    );
    const onAreaClick = areaPolygonLayerProps.at(-1)!.onAreaClick as (
      areaId: number,
    ) => void;
    onAreaClick(3);
    expect(onSelectArea).toHaveBeenCalledWith(null);
  });
});
