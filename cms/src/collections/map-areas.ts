import type { CollectionConfig } from 'payload';

type Position = number[];
type PolygonCoordinates = Position[][];

const isValidLongitude = (longitude: number) => longitude >= -180 && longitude <= 180;
const isValidLatitude = (latitude: number) => latitude >= -90 && latitude <= 90;

// frontend/src/lib/campus-map-geometry.ts の座標検証規則と同じ。
// cms/ と frontend/ は別パッケージで直接 import できないため、規則を複製している
function isValidPosition(value: unknown): value is Position {
  if (!Array.isArray(value) || value.length < 2 || value.length > 3) return false;
  if (!value.every((n) => typeof n === 'number')) return false;
  const [longitude, latitude] = value;
  return isValidLongitude(longitude) && isValidLatitude(latitude);
}

function isClosedRing(ring: Position[]): boolean {
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

function isValidRing(value: unknown): value is Position[] {
  return Array.isArray(value) && value.length >= 4 && value.every(isValidPosition) && isClosedRing(value);
}

function isValidPolygonCoordinates(value: unknown): value is PolygonCoordinates {
  return Array.isArray(value) && value.length >= 1 && value.every(isValidRing);
}

function extractPolygons(geometry: unknown): PolygonCoordinates[] | null {
  if (typeof geometry !== 'object' || geometry === null) return null;
  const { type, coordinates } = geometry as { type?: unknown; coordinates?: unknown };
  if (type === 'Polygon') return [coordinates as PolygonCoordinates];
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) return coordinates as PolygonCoordinates[];
  return null;
}

// geojson.io は Polygon/MultiPolygon 単体だけでなく、それらを geometry に持つ Feature/FeatureCollection も
// 出力するため、貼り付けをそのまま受け付けられるよう保存前に MultiPolygon へ正規化する
function normalizeToMultiPolygon(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const obj = value as { type?: unknown; geometry?: unknown; features?: unknown };

  if (obj.type === 'FeatureCollection') {
    if (!Array.isArray(obj.features) || obj.features.length === 0) return value;
    const polygons: PolygonCoordinates[] = [];
    for (const feature of obj.features) {
      const polys = extractPolygons((feature as { geometry?: unknown } | null)?.geometry);
      // Polygon/MultiPolygon 以外の feature が混ざる場合は正規化せず validate に委ねてエラーにする
      if (!polys) return value;
      polygons.push(...polys);
    }
    return { type: 'MultiPolygon', coordinates: polygons };
  }

  const geometry = obj.type === 'Feature' ? obj.geometry : value;
  const polygons = extractPolygons(geometry);
  if (!polygons) return value;
  return { type: 'MultiPolygon', coordinates: polygons };
}

function validateMultiPolygonGeometry(value: unknown): true | string {
  if (typeof value !== 'object' || value === null) return '不正な GeoJSON です';
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  if (type !== 'MultiPolygon') {
    return 'GeoJSON Polygon / MultiPolygon / Feature / FeatureCollection のいずれかを指定してください';
  }
  if (!Array.isArray(coordinates) || coordinates.length < 1) return 'ポリゴンがありません';
  if (!coordinates.every(isValidPolygonCoordinates)) {
    return 'リングの点数不足・未閉包、または座標が経度・緯度の範囲外です';
  }
  return true;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function validateHexColor(value: unknown): true | string {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) {
    return 'Hex カラーコード (例: #7fc8ad) を指定してください';
  }
  return true;
}

export const MapAreas: CollectionConfig = {
  slug: 'map_areas',
  labels: { singular: 'マップエリア', plural: 'マップエリア' },
  admin: {
    useAsTitle: 'name',
  },
  defaultSort: 'sort',
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: '表示名',
      admin: { description: '例: "Aゾーン"' },
    },
    {
      name: 'geometry',
      type: 'json',
      required: true,
      label: '図形',
      admin: { description: 'GeoJSON (Polygon / MultiPolygon / geojson.io の出力)' },
      hooks: {
        beforeChange: [({ value }) => normalizeToMultiPolygon(value)],
      },
      validate: validateMultiPolygonGeometry,
    },
    {
      name: 'color',
      type: 'text',
      label: 'マップ表示色',
      maxLength: 7,
      admin: { description: '例: #7fc8ad。未設定の場合は既定色' },
      hooks: {
        beforeChange: [({ value }) => (typeof value === 'string' ? value.toLowerCase() : value)],
      },
      validate: validateHexColor,
    },
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
