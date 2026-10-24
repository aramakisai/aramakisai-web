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

/** 表示側と生成側が同じ正式profileを参照し、範囲やzoomのずれを防ぐ。 */
export const REGIONAL_MAP_CONFIG: RegionalMapConfig = {
  ...REGIONAL_MAP_TILE_PROFILE,
  // 新規座標を推測せず、既存会場マップの確定済みキャンパス範囲中央を使う。
  initialCenter: REGIONAL_MAP_INITIAL_CENTER,
  initialZoom: CAMPUS_MAP_CONFIG.minZoom,
  focusZoom: CAMPUS_MAP_CONFIG.minZoom,
};
