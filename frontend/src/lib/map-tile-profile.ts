import { CAMPUS_MAP_TILE_PROFILE } from './campus-map-config';

export type MapTileProfileId = 'campus' | 'regional';

export interface MapTileProfile {
  readonly id: MapTileProfileId;
  readonly bounds: readonly [
    readonly [latitude: number, longitude: number],
    readonly [latitude: number, longitude: number],
  ];
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly minNativeZoom: number;
  readonly maxNativeZoom: number;
  readonly publicDirectory: string;
  readonly urlTemplate: string;
  readonly expectedMaxTileCount: number;
  readonly expectedMaxBytes: number;
  /** 描画漏れ検出用。z13以上でこの地点を含むタイルが無地でないことを検査する */
  readonly landmarks?: readonly MapTileLandmark[];
}

export interface MapTileLandmark {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * 年度ごとの協賛企業データから独立した固定の地域協賛サービス範囲。
 * 前橋市街と周辺の通常利用範囲を覆い、z17はz16の電子拡大とする。
 * この範囲外のレコードは公開DTOへの変換時に除外して警告する。
 */
export const REGIONAL_MAP_TILE_PROFILE = {
  id: 'regional',
  bounds: [
    [36.3105, 138.92],
    [36.521, 139.2985],
  ],
  minZoom: 10.5,
  maxZoom: 17,
  minNativeZoom: 11,
  maxNativeZoom: 16,
  publicDirectory: 'public/regional-map-tiles',
  urlTemplate: '/regional-map-tiles/{z}/{x}/{y}.webp',
  // 現行範囲の計算値に余裕を持たせた生成前の停止基準。
  expectedMaxTileCount: 6_984,
  // 市街部の文字量を考慮しつつ、成果物を64MiB未満に制限する。
  expectedMaxBytes: 64 * 1024 * 1024,
  // 駅は OSM の railway=station ノード、朝倉町は依頼で指定された座標、
  // 荒牧キャンパスは campusBounds の中心
  landmarks: [
    { name: '前橋駅', latitude: 36.383276, longitude: 139.0727221 },
    { name: '朝倉町', latitude: 36.3619, longitude: 139.093 },
    { name: '新前橋駅', latitude: 36.3789954, longitude: 139.0468295 },
    { name: '高崎駅', latitude: 36.3223662, longitude: 139.0125458 },
    { name: '荒牧キャンパス', latitude: 36.43068, longitude: 139.044795 },
  ],
} as const satisfies MapTileProfile;

export function isWithinMapTileProfile(
  profile: MapTileProfile,
  latitude: number,
  longitude: number,
): boolean {
  const [[south, west], [north, east]] = profile.bounds;
  return (
    latitude >= south &&
    latitude <= north &&
    longitude >= west &&
    longitude <= east
  );
}

export function getMapTileProfile(profileId: string): MapTileProfile {
  if (profileId === 'campus') return CAMPUS_MAP_TILE_PROFILE;
  if (profileId === 'regional') return REGIONAL_MAP_TILE_PROFILE;
  throw new Error(`不明なprofileです: ${profileId}`);
}
