import { z } from 'zod';

/**
 * GeoJSON の座標。[経度, 緯度] または [経度, 緯度, 高度]。
 * `@types/geojson` の `Position` (可変配列) と代入互換にするため readonly にしない。
 * react-leaflet の `<GeoJSON data>` がその型を要求する。
 */
export type Position = number[];

/** 外環と 0 個以上の内環からなる Polygon */
export interface PolygonGeometry {
  readonly type: 'Polygon';
  readonly coordinates: Position[][];
}

/** 検証結果。失敗理由は呼び出し側のログに使う */
export type GeometryParseResult =
  | { readonly kind: 'valid'; readonly value: PolygonGeometry }
  | { readonly kind: 'invalid'; readonly reason: string };

const isValidLongitude = (longitude: number) =>
  longitude >= -180 && longitude <= 180;
const isValidLatitude = (latitude: number) => latitude >= -90 && latitude <= 90;

// 第 3 要素 (高度) は GeoJSON 仕様上許されるため、max(3) で受け入れつつ検証・重心算出では無視する
const positionSchema = z
  .array(z.number())
  .min(2)
  .max(3)
  .refine(
    ([longitude, latitude]) =>
      isValidLongitude(longitude) && isValidLatitude(latitude),
    {
      message: '座標が経度・緯度の範囲外です',
    },
  );

function isClosedRing(ring: Position[]): boolean {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

const linearRingSchema = z
  .array(positionSchema)
  .min(4, 'リングの点数が不足しています')
  .refine(isClosedRing, { message: 'リングの始点と終点が一致していません' });

/** CMS 側の保存時検証 (`map-areas.ts` の `validate`) と共有するスキーマ */
export const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(linearRingSchema).min(1, '外環がありません'),
});

/** Payload の json 値を Polygon として解釈する */
export function parsePolygonGeometry(value: unknown): GeometryParseResult {
  const result = polygonGeometrySchema.safeParse(value);
  if (!result.success) {
    return {
      kind: 'invalid',
      reason: result.error.issues[0]?.message ?? '不正な GeoJSON Polygon です',
    };
  }
  return { kind: 'valid', value: result.data };
}

/** ラベル配置用の重心。外環から算出する。[緯度, 経度] を返す (Leaflet の順) */
export function polygonCentroid(
  geometry: PolygonGeometry,
): readonly [latitude: number, longitude: number] {
  const [outerRing] = geometry.coordinates;

  // 符号付き面積による標準的なポリゴン重心。凹形状では重心が外に出ることがある (design.md 参照)
  let area = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let i = 0; i < outerRing.length - 1; i++) {
    const [x0, y0] = outerRing[i];
    const [x1, y1] = outerRing[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    weightedX += (x0 + x1) * cross;
    weightedY += (y0 + y1) * cross;
  }
  area /= 2;

  if (area === 0) {
    // ponytail: 面積 0 の退化リングは頂点平均にフォールバック。矩形中心の運用形状では起きない
    const vertices = outerRing.slice(0, -1);
    const [sumX, sumY] = vertices.reduce(
      ([accX, accY], [x, y]) => [accX + x, accY + y],
      [0, 0],
    );
    return [sumY / vertices.length, sumX / vertices.length];
  }

  return [weightedY / (6 * area), weightedX / (6 * area)];
}
