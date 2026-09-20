import { buildCampusMapHref, type CampusMapArea } from './campus-map';

/** 南西端と北東端の緯度経度で表す矩形範囲 */
export interface AreaBounds {
  readonly southWest: readonly [latitude: number, longitude: number];
  readonly northEast: readonly [latitude: number, longitude: number];
}

/** 企画位置セクションが描画する対象エリアの集合 */
export interface TargetAreas {
  /** 描画可能な区画。areaIds の順序を保つ。空配列にはならない */
  readonly areas: readonly [CampusMapArea, ...CampusMapArea[]];
  /** 遷移先クエリに用いる区画。areas の先頭と一致する */
  readonly primary: CampusMapArea;
}

/**
 * 企画の areaIds と取得済みのエリア一覧から対象エリアを解決する。
 *
 * areaIds の順序をそのまま保つ。これは exhibitions.ts の resolveAreaIds が
 * 直接の area_id を先に Set へ追加することに依存しており、先頭要素が
 * 「直接の所在エリア、それがなければ最初の出演ステージの所在エリア」と
 * 一致する (要件 3.3)。この順序は回帰テストで固定する。
 */
export function resolveTargetAreas(
  areaIds: readonly number[],
  areas: readonly CampusMapArea[],
): TargetAreas | null {
  const areasById = new Map(areas.map((area) => [area.id, area]));
  const resolved = areaIds
    .map((id) => areasById.get(id))
    .filter((area): area is CampusMapArea => area !== undefined);

  if (resolved.length === 0) {
    return null;
  }

  const [primary, ...rest] = resolved;
  return { areas: [primary, ...rest], primary };
}

/** 対象エリアのすべての頂点を含む矩形範囲を返す */
export function toAreaBounds(
  areas: readonly [CampusMapArea, ...CampusMapArea[]],
): AreaBounds {
  let minLatitude = Infinity;
  let minLongitude = Infinity;
  let maxLatitude = -Infinity;
  let maxLongitude = -Infinity;

  // PolygonGeometry の座標は [経度, 緯度] (GeoJSON の順)。AreaBounds は緯度・経度の順で返す
  for (const area of areas) {
    for (const ring of area.geometry.coordinates) {
      for (const [longitude, latitude] of ring) {
        minLatitude = Math.min(minLatitude, latitude);
        maxLatitude = Math.max(maxLatitude, latitude);
        minLongitude = Math.min(minLongitude, longitude);
        maxLongitude = Math.max(maxLongitude, longitude);
      }
    }
  }

  return {
    southWest: [minLatitude, minLongitude],
    northEast: [maxLatitude, maxLongitude],
  };
}

/** 指定したエリアを選択状態とする構内マップページの URL を返す */
export function buildAreaMapHref(area: CampusMapArea): string {
  return buildCampusMapHref({ q: '', categories: [], selectedAreaId: area.id });
}
