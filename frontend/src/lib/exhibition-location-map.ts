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
 * areaIds の順序をそのまま保つ。areaIds はカードの category 単位で解決済みのものを渡す。
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

  // MultiPolygonGeometry の座標は [経度, 緯度] (GeoJSON の順)。AreaBounds は緯度・経度の順で返す
  for (const area of areas) {
    for (const polygon of area.geometry.coordinates) {
      for (const ring of polygon) {
        for (const [longitude, latitude] of ring) {
          minLatitude = Math.min(minLatitude, latitude);
          maxLatitude = Math.max(maxLatitude, latitude);
          minLongitude = Math.min(minLongitude, longitude);
          maxLongitude = Math.max(maxLongitude, longitude);
        }
      }
    }
  }

  return {
    southWest: [minLatitude, minLongitude],
    northEast: [maxLatitude, maxLongitude],
  };
}

// 線形補間の四分位数。ソート済み配列を渡す
function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * 外接矩形の中心が緯度・経度いずれかの軸で Tukey 法の外れ値になるエリアを除く。
 *
 * 敷地から離れた孤立エリア 1 件に初期表示の範囲が引き伸ばされ、主要エリア群が偏るのを避ける。
 * 除外すると 0 件になる場合は全件を返す。
 */
export function excludeOutlierAreas(
  areas: readonly CampusMapArea[],
): readonly CampusMapArea[] {
  const centers = areas.map((area) => {
    const { southWest, northEast } = toAreaBounds([area]);
    return [
      (southWest[0] + northEast[0]) / 2,
      (southWest[1] + northEast[1]) / 2,
    ] as const;
  });
  const fences = [0, 1].map((axis) => {
    const sorted = centers.map((c) => c[axis]).sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    return [q1 - 1.5 * iqr, q3 + 1.5 * iqr] as const;
  });
  const kept = areas.filter((_, i) =>
    fences.every(([lo, hi], axis) => {
      const v = centers[i][axis];
      return v >= lo && v <= hi;
    }),
  );
  return kept.length > 0 ? kept : areas;
}

/** 指定したエリアを選択状態とする構内マップページの URL を返す */
export function buildAreaMapHref(area: CampusMapArea): string {
  return buildCampusMapHref({ q: '', categories: [], selectedAreaId: area.id });
}
