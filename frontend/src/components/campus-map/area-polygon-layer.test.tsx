import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CampusMapArea } from '@/lib/campus-map';
import { resolveAreaColor } from '@/lib/campus-map';

// campus-map.ts は cms.ts (env.ts の起動時検証を含む) に依存するため、
// campus-map.test.ts と同様にモックしてユニットテストの対象外にする。
vi.mock('@/lib/cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

const geoJsonProps: Record<string, unknown>[] = [];
const labelMarkerProps: Record<string, unknown>[] = [];
// ポリゴンごとに生成した「SVG path 要素」役の div。実 DOM に挿入し、
// キーボード操作の付与先として使う (本物の Leaflet は地図の SVG レイヤーへ挿入する)
const polygonElements: HTMLElement[] = [];

vi.mock('react-leaflet', () => ({
  GeoJSON: (
    props: Record<string, unknown> & { ref?: { current: unknown } },
  ) => {
    geoJsonProps.push(props);
    const element = document.createElement('div');
    document.body.appendChild(element);
    polygonElements.push(element);

    const listeners: Record<string, () => void> = {};
    const group = {
      getLayers: () => [{ getElement: () => element }],
      on: (event: string, cb: () => void) => {
        listeners[event] = cb;
      },
      off: (event: string) => {
        delete listeners[event];
      },
    };
    if (props.ref) props.ref.current = group;
    return <div data-testid="geojson" />;
  },
}));

afterEach(() => {
  geoJsonProps.length = 0;
  labelMarkerProps.length = 0;
  for (const el of polygonElements.splice(0)) el.remove();
});

vi.mock('./area-label-marker', () => ({
  AreaLabelMarker: (props: Record<string, unknown>) => {
    labelMarkerProps.push(props);
    return <div data-testid="label" />;
  },
}));

import { AreaPolygonLayer } from './area-polygon-layer';

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

describe('AreaPolygonLayer', () => {
  it('取得層が決めた順にポリゴンを描画する', () => {
    const areas = [area({ id: 1 }), area({ id: 2 }), area({ id: 3 })];
    render(
      <AreaPolygonLayer
        areas={areas}
        selectedAreaId={null}
        onAreaClick={() => {}}
      />,
    );
    expect(geoJsonProps.map((p) => p.data)).toEqual(
      areas.map((a) => a.geometry),
    );
  });

  it('エリアの表示色を塗りと枠線に反映する', () => {
    const a = area({ color: 'accent' });
    render(
      <AreaPolygonLayer
        areas={[a]}
        selectedAreaId={null}
        onAreaClick={() => {}}
      />,
    );
    const style = geoJsonProps.at(-1)!.style as Record<string, unknown>;
    expect(style.fillColor).toBe(resolveAreaColor('accent'));
    expect(style.color).toBe(resolveAreaColor('accent'));
  });

  it('通常時は塗りの不透明度 55% で描画する', () => {
    render(
      <AreaPolygonLayer
        areas={[area({})]}
        selectedAreaId={null}
        onAreaClick={() => {}}
      />,
    );
    const style = geoJsonProps.at(-1)!.style as Record<string, unknown>;
    expect(style.fillOpacity).toBe(0.55);
  });

  it('選択中は塗りの不透明度 72% にし枠線を太くする', () => {
    const a = area({ id: 5 });
    render(
      <AreaPolygonLayer
        areas={[a]}
        selectedAreaId={5}
        onAreaClick={() => {}}
      />,
    );
    const unselectedStyle = {
      ...(geoJsonProps.at(-1)!.style as Record<string, unknown>),
    };

    render(
      <AreaPolygonLayer
        areas={[a]}
        selectedAreaId={null}
        onAreaClick={() => {}}
      />,
    );
    const notSelectedStyle = geoJsonProps.at(-1)!.style as Record<
      string,
      unknown
    >;

    expect(unselectedStyle.fillOpacity).toBe(0.72);
    expect(unselectedStyle.weight).toBeGreaterThan(
      notSelectedStyle.weight as number,
    );
  });

  it('クリックでエリア ID を通知する', () => {
    const onAreaClick = vi.fn();
    const a = area({ id: 7 });
    render(
      <AreaPolygonLayer
        areas={[a]}
        selectedAreaId={null}
        onAreaClick={onAreaClick}
      />,
    );
    const handlers = geoJsonProps.at(-1)!.eventHandlers as {
      click: () => void;
    };
    handlers.click();
    expect(onAreaClick).toHaveBeenCalledWith(7);
  });

  it('ラベルへエリア名・geometry・選択状態を渡す', () => {
    const a = area({ id: 9, name: 'Bゾーン' });
    render(
      <AreaPolygonLayer
        areas={[a]}
        selectedAreaId={9}
        onAreaClick={() => {}}
      />,
    );
    const props = labelMarkerProps.at(-1)!;
    expect(props.name).toBe('Bゾーン');
    expect(props.geometry).toEqual(a.geometry);
    expect(props.selected).toBe(true);
  });

  it('ポリゴンをキーボードでフォーカス可能にする', () => {
    const a = area({ id: 3 });
    render(
      <AreaPolygonLayer
        areas={[a]}
        selectedAreaId={null}
        onAreaClick={() => {}}
      />,
    );
    const element = polygonElements.at(-1) ?? null;
    expect(element).not.toBeNull();
    expect(element!.getAttribute('tabindex')).toBe('0');
    expect(element!.getAttribute('role')).toBe('button');
  });

  it('Enter または Space でエリアを選択できる', () => {
    const onAreaClick = vi.fn();
    const a = area({ id: 42 });
    render(
      <AreaPolygonLayer
        areas={[a]}
        selectedAreaId={null}
        onAreaClick={onAreaClick}
      />,
    );
    const element = polygonElements.at(-1)!;

    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(onAreaClick).toHaveBeenCalledWith(42);

    onAreaClick.mockClear();
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    );
    expect(onAreaClick).toHaveBeenCalledWith(42);

    onAreaClick.mockClear();
    element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }),
    );
    expect(onAreaClick).not.toHaveBeenCalled();
  });
});
