import { z } from 'zod';

/**
 * GeoJSON の座標。[経度, 緯度] または [経度, 緯度, 高度]。
 * `@types/geojson` の `Position` (可変配列) と代入互換にするため readonly にしない。
 * react-leaflet の `<GeoJSON data>` がその型を要求する。
 */
export type Position = number[];

/** 1 本のリング (外環または内環) */
export type LinearRing = Position[];

/** 1 つのポリゴンの外環と 0 個以上の内環 */
export type PolygonCoordinates = LinearRing[];

/**
 * CMS (map-areas.ts の normalizeToMultiPolygon) が保存時に常に MultiPolygon へ正規化するため、
 * フロントの内部表現もこれに合わせる。react-leaflet の `<GeoJSON data>` にそのまま渡せる形。
 */
export interface MultiPolygonGeometry {
  readonly type: 'MultiPolygon';
  readonly coordinates: readonly PolygonCoordinates[];
}

/** 検証結果。失敗理由は呼び出し側のログに使う */
export type GeometryParseResult =
  | { readonly kind: 'valid'; readonly value: MultiPolygonGeometry }
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

const polygonCoordinatesSchema = z
  .array(linearRingSchema)
  .min(1, '外環がありません');

// 本番デプロイ前のフロントは CMS 側の正規化 (4e831ba) より先に配信されうるため、
// 旧形式の Polygon も受理し valid 時に MultiPolygon へ正規化する
const legacyPolygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: polygonCoordinatesSchema,
});

/** CMS 側の保存時検証 (`map-areas.ts` の `validateMultiPolygonGeometry`) と一致するスキーマ */
export const multiPolygonGeometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(polygonCoordinatesSchema).min(1, 'ポリゴンがありません'),
});

const areaGeometrySchema = z.union([
  legacyPolygonSchema,
  multiPolygonGeometrySchema,
]);

/** Payload の json 値をエリアの図形として解釈し、MultiPolygon へ正規化する */
export function parseAreaGeometry(value: unknown): GeometryParseResult {
  const result = areaGeometrySchema.safeParse(value);
  if (!result.success) {
    return {
      kind: 'invalid',
      reason:
        result.error.issues[0]?.message ??
        '不正な GeoJSON Polygon/MultiPolygon です',
    };
  }
  const parsed = result.data;
  return {
    kind: 'valid',
    value:
      parsed.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [parsed.coordinates] }
        : parsed,
  };
}

/**
 * 符号付き面積 (2 倍) と重心の重み付き合計。リング 1 本分。
 * 経度・緯度は絶対値が ~139, ~36 と大きいため、そのまま shoelace 公式にかけると
 * 頂点間の微小な差分 (キャンパス内の建物 1 棟分、10^-4 度未満) が桁落ちで失われ、
 * 重心がポリゴンの外側に大きくずれる (実測: Bグループ/キッチンカーの複数ポリゴンで発生)。
 * リングの始点を原点に平行移動してから計算し (面積・重心は平行移動で不変)、最後に戻す。
 */
function ringMoments(ring: Position[]) {
  const [originX, originY] = ring[0];
  let area = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x0 = ring[i][0] - originX;
    const y0 = ring[i][1] - originY;
    const x1 = ring[i + 1][0] - originX;
    const y1 = ring[i + 1][1] - originY;
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    weightedX += (x0 + x1) * cross;
    weightedY += (y0 + y1) * cross;
  }
  return { area: area / 2, weightedX, weightedY, originX, originY };
}

/** 外環から重心を算出する。[緯度, 経度] を返す (Leaflet の順) */
function outerRingCentroid(
  outerRing: Position[],
): readonly [latitude: number, longitude: number] {
  const { area, weightedX, weightedY, originX, originY } =
    ringMoments(outerRing);

  if (area === 0) {
    // ponytail: 面積 0 の退化リングは頂点平均にフォールバック。矩形中心の運用形状では起きない
    const vertices = outerRing.slice(0, -1);
    const [sumX, sumY] = vertices.reduce(
      ([accX, accY], [x, y]) => [accX + x, accY + y],
      [0, 0],
    );
    return [sumY / vertices.length, sumX / vertices.length];
  }

  return [weightedY / (6 * area) + originY, weightedX / (6 * area) + originX];
}

/** 1 ポリゴン単位の重心。外環のみで算出する (内環は無視、既存仕様のまま) */
export function singlePolygonCentroid(
  polygon: PolygonCoordinates,
): readonly [latitude: number, longitude: number] {
  const [outerRing] = polygon;
  return outerRingCentroid(outerRing);
}

function polygonAbsArea(polygon: PolygonCoordinates): number {
  return Math.abs(ringMoments(polygon[0]).area);
}

/**
 * ラベル配置用の重心。MultiPolygon 中で面積が最大のポリゴンを選び、その重心を返す
 * (1 エリア = 1 ラベルにするため、複数ポリゴンから代表点を 1 つ決める必要がある)。
 * 凹形状では重心が外に出ることがある (design.md 参照)
 */
export function polygonCentroid(
  geometry: MultiPolygonGeometry,
): readonly [latitude: number, longitude: number] {
  const [first, ...rest] = geometry.coordinates;
  const largest = rest.reduce(
    (best, candidate) =>
      polygonAbsArea(candidate) > polygonAbsArea(best) ? candidate : best,
    first,
  );
  return singlePolygonCentroid(largest);
}
