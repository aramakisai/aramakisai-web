import {
  REGIONAL_MAP_TILE_PROFILE,
  type MapTileProfile,
} from './map-tile-profile';
import { CAMPUS_MAP_CONFIG } from './campus-map-config';

export interface RegionalMapConfig extends MapTileProfile {
  readonly initialCenter: [latitude: number, longitude: number];
  readonly initialZoom: number;
  readonly focusZoom: number;
}

const REGIONAL_MAP_INITIAL_CENTER: [number, number] = [
  (CAMPUS_MAP_CONFIG.campusBounds[0][0] +
    CAMPUS_MAP_CONFIG.campusBounds[1][0]) /
    2,
  (CAMPUS_MAP_CONFIG.campusBounds[0][1] +
    CAMPUS_MAP_CONFIG.campusBounds[1][1]) /
    2,
];

/** 表示側と生成側が同じ固定サービスprofileを参照し、範囲やzoomのずれを防ぐ。 */
export const REGIONAL_MAP_CONFIG: RegionalMapConfig = {
  ...REGIONAL_MAP_TILE_PROFILE,
  // 新規座標を推測せず、既存会場マップの確定済みキャンパス範囲中央を使う。
  initialCenter: REGIONAL_MAP_INITIAL_CENTER,
  initialZoom: CAMPUS_MAP_CONFIG.minZoom,
  // 整数の native zoom にする。x.5 だと Leaflet がタイルの z を丸める境界に乗り、
  // flyTo の途中でわずかに引いただけで 1 段下のタイルを引き伸ばした表示に切り替わる
  focusZoom: REGIONAL_MAP_TILE_PROFILE.maxNativeZoom,
};
