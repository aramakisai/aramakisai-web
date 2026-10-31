import { describe, expect, it, vi } from 'vitest';
import type { CampusMapArea } from './campus-map';
import type { MultiPolygonGeometry } from './campus-map-geometry';
import {
  buildAreaMapHref,
  excludeOutlierAreas,
  resolveTargetAreas,
  toAreaBounds,
} from './exhibition-location-map';

// exhibition-location-map.ts は campus-map.ts 経由で cms.ts (env.ts の起動時検証を含む) に
// 依存するため、campus-map.test.ts と同様にモックしてユニットテストの対象外にする。
vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

function squareRing(centerLongitude: number, centerLatitude: number) {
  return [
    [centerLongitude - 0.01, centerLatitude - 0.01],
    [centerLongitude - 0.01, centerLatitude + 0.01],
    [centerLongitude + 0.01, centerLatitude + 0.01],
    [centerLongitude + 0.01, centerLatitude - 0.01],
    [centerLongitude - 0.01, centerLatitude - 0.01],
  ];
}

function squareGeometry(
  centerLongitude: number,
  centerLatitude: number,
): MultiPolygonGeometry {
  return {
    type: 'MultiPolygon',
    coordinates: [[squareRing(centerLongitude, centerLatitude)]],
  };
}

// 1 エリアが複数ポリゴンを持つケースの bbox 検証用
function multiSquareGeometry(
  centers: readonly (readonly [longitude: number, latitude: number])[],
): MultiPolygonGeometry {
  return {
    type: 'MultiPolygon',
    coordinates: centers.map(([longitude, latitude]) => [
      squareRing(longitude, latitude),
    ]),
  };
}

function makeArea(
  id: number,
  overrides: Partial<CampusMapArea> = {},
): CampusMapArea {
  return {
    id,
    name: `エリア${id}`,
    geometry: squareGeometry(139.0 + id, 35.0 + id),
    color: 'accent',
    ...overrides,
    hasAed: false,
    hasToilet: false,
  };
}

describe('resolveTargetAreas', () => {
  it('areaIds の順序を保って対象エリアを抽出し、先頭を primary とする', () => {
    const area1 = makeArea(1);
    const area2 = makeArea(2);
    const area3 = makeArea(3);

    const result = resolveTargetAreas([3, 1, 2], [area1, area2, area3]);

    expect(result?.areas).toEqual([area3, area1, area2]);
    expect(result?.primary).toBe(area3);
  });

  it('areas に存在しない ID を読み飛ばす', () => {
    const area1 = makeArea(1);
    const area3 = makeArea(3);

    const result = resolveTargetAreas([1, 999, 3], [area1, area3]);

    expect(result?.areas).toEqual([area1, area3]);
  });

  it('一致する区画が一件もない場合は null を返す', () => {
    const result = resolveTargetAreas([999], [makeArea(1)]);

    expect(result).toBeNull();
  });

  it('areaIds が空の場合も null を返す', () => {
    const result = resolveTargetAreas([], [makeArea(1)]);

    expect(result).toBeNull();
  });
});

describe('toAreaBounds', () => {
  it('単一エリアのすべての頂点を含む矩形範囲を、緯度・経度の順で返す', () => {
    const area = makeArea(1, { geometry: squareGeometry(139.0, 35.0) });

    const bounds = toAreaBounds([area]);

    expect(bounds).toEqual({
      southWest: [34.99, 138.99],
      northEast: [35.01, 139.01],
    });
  });

  it('複数エリアにまたがるすべての頂点を含む範囲を返す', () => {
    const area1 = makeArea(1, { geometry: squareGeometry(139.0, 35.0) });
    const area2 = makeArea(2, { geometry: squareGeometry(140.0, 36.0) });

    const bounds = toAreaBounds([area1, area2]);

    expect(bounds).toEqual({
      southWest: [34.99, 138.99],
      northEast: [36.01, 140.01],
    });
  });

  it('1 エリアが複数ポリゴンを持つ場合、そのすべてのポリゴンを含む範囲を返す', () => {
    const area = makeArea(1, {
      geometry: multiSquareGeometry([
        [139.0, 35.0],
        [141.0, 37.0],
      ]),
    });

    const bounds = toAreaBounds([area]);

    expect(bounds).toEqual({
      southWest: [34.99, 138.99],
      northEast: [37.01, 141.01],
    });
  });
});

describe('buildAreaMapHref', () => {
  it('指定したエリアを選択状態とする構内マップページの URL を返す', () => {
    const area = makeArea(5);

    expect(buildAreaMapHref(area)).toBe('/map?area=5');
  });
});

describe('excludeOutlierAreas', () => {
  // [緯度中心, 経度中心] の本番相当値 (馬術場だけが北に孤立)
  const centers: readonly [string, number, number][] = [
    ['A', 36.43129, 139.045995],
    ['B', 36.430665, 139.04543],
    ['C', 36.430845, 139.04495],
    ['D', 36.430855, 139.0444],
    ['E', 36.43113, 139.04512],
    ['2', 36.43025, 139.045105],
    ['3', 36.429995, 139.045495],
    ['5', 36.430165, 139.04341],
    ['6', 36.43061, 139.043535],
    ['野外', 36.43113, 139.04512],
    ['武道', 36.42941, 139.044135],
    ['屋内', 36.42982, 139.043975],
    ['キッチン', 36.43106, 139.044245],
    ['弓道', 36.429615, 139.04308],
    ['馬術', 36.433105, 139.0439],
    ['本部', 36.430865, 139.04514],
  ];
  const toAreas = (list: typeof centers) =>
    list.map(([, lat, lng], i) =>
      makeArea(i + 1, { geometry: squareGeometry(lng, lat) }),
    );

  it('北に孤立したエリアだけを除く', () => {
    const areas = toAreas(centers);

    const result = excludeOutlierAreas(areas);

    expect(result).toHaveLength(areas.length - 1);
    expect(result).not.toContain(areas[14]);
  });

  it('外れ値がなければ全件を返す', () => {
    const areas = toAreas(centers.filter(([name]) => name !== '馬術'));

    expect(excludeOutlierAreas(areas)).toHaveLength(areas.length);
  });

  it('少数件でも落ちず、0 件にならない', () => {
    expect(excludeOutlierAreas([])).toEqual([]);
    const one = [makeArea(1)];
    expect(excludeOutlierAreas(one)).toEqual(one);
    const two = [makeArea(1), makeArea(2)];
    expect(excludeOutlierAreas(two).length).toBeGreaterThan(0);
  });
});
