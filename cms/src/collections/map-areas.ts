import type { CollectionConfig } from 'payload';

/** tailwind.config.ts のカラートークン名と一致させる。任意の色値の入力は受け付けない (要件 6.2) */
const COLORS = [
  { name: 'primary', label: 'プライマリ' },
  { name: 'secondary', label: 'セカンダリ' },
  { name: 'accent', label: 'アクセント' },
  { name: 'accent-alt', label: 'アクセント (サブ)' },
  { name: 'info', label: 'インフォ' },
  { name: 'success', label: 'サクセス' },
  { name: 'warning', label: 'ワーニング' },
] as const;

type Position = number[];

const isValidLongitude = (longitude: number) => longitude >= -180 && longitude <= 180;
const isValidLatitude = (latitude: number) => latitude >= -90 && latitude <= 90;

// frontend/src/lib/campus-map-geometry.ts の polygonGeometrySchema と同じ検証規則。
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

function validatePolygonGeometry(value: unknown): true | string {
  if (typeof value !== 'object' || value === null) return '不正な GeoJSON Polygon です';
  const { type, coordinates } = value as { type?: unknown; coordinates?: unknown };
  if (type !== 'Polygon') return 'type が Polygon ではありません';
  if (!Array.isArray(coordinates) || coordinates.length < 1) return '外環がありません';
  if (!coordinates.every(isValidRing)) {
    return 'リングの点数不足・未閉包、または座標が経度・緯度の範囲外です';
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
      admin: { description: 'GeoJSON Polygon' },
      validate: validatePolygonGeometry,
    },
    {
      name: 'color',
      type: 'select',
      label: 'マップ表示色',
      options: COLORS.map(({ name, label }) => ({ label, value: name })),
      admin: { description: '未設定の場合は既定色で描画する' },
    },
    {
      name: 'sort',
      type: 'number',
      label: '表示順',
    },
  ],
};
