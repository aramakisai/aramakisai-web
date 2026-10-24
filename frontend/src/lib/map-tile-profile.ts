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
}

/**
 * 正式34社の東端へ2km、PC左panel側の西端へ約9kmのpan余白を加え、
 * 1440x900と390x844のpanel/sheetを除く表示領域から全所在地へ移動できる
 * よう南北を広げたタイル・pan範囲。z17をnative生成すると13,095枚増えるため
 * nativeはz16で止め、z17は電子拡大とする。
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
  // 計算値4,656枚の1.5倍を生成前の停止基準にする。
  expectedMaxTileCount: 6_984,
  // 市街部の文字量を考慮しつつ、成果物を64MiB未満に制限する。
  expectedMaxBytes: 64 * 1024 * 1024,
} as const satisfies MapTileProfile;

export function getMapTileProfile(profileId: string): MapTileProfile {
  if (profileId === 'campus') return CAMPUS_MAP_TILE_PROFILE;
  if (profileId === 'regional') return REGIONAL_MAP_TILE_PROFILE;
  throw new Error(`不明なprofileです: ${profileId}`);
}
