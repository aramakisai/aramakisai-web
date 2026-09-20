import { describe, expect, it, vi } from 'vitest';
import type { CampusMapArea } from './campus-map';
import type { PolygonGeometry } from './campus-map-geometry';
import {
  buildAreaMapHref,
  resolveTargetAreas,
  toAreaBounds,
} from './exhibition-location-map';

// exhibition-location-map.ts は campus-map.ts 経由で cms.ts (env.ts の起動時検証を含む) に
// 依存するため、campus-map.test.ts と同様にモックしてユニットテストの対象外にする。
vi.mock('./cms', () => ({
  cms: { findMany: vi.fn(), findById: vi.fn(), findGlobal: vi.fn() },
}));

function squareGeometry(
  centerLongitude: number,
  centerLatitude: number,
): PolygonGeometry {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [centerLongitude - 0.01, centerLatitude - 0.01],
        [centerLongitude - 0.01, centerLatitude + 0.01],
        [centerLongitude + 0.01, centerLatitude + 0.01],
        [centerLongitude + 0.01, centerLatitude - 0.01],
        [centerLongitude - 0.01, centerLatitude - 0.01],
      ],
    ],
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
    sort: id,
    ...overrides,
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
});

describe('buildAreaMapHref', () => {
  it('指定したエリアを選択状態とする構内マップページの URL を返す', () => {
    const area = makeArea(5);

    expect(buildAreaMapHref(area)).toBe('/map?area=5');
  });
});
