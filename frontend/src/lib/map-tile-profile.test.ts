import { describe, expect, it } from 'vitest';
import {
  CAMPUS_MAP_CONFIG,
  CAMPUS_MAP_TILE_PROFILE,
} from './campus-map-config';
import {
  getMapTileProfile,
  REGIONAL_MAP_TILE_PROFILE,
} from './map-tile-profile';

describe('map tile profiles', () => {
  it('campus profileは既存の範囲・zoom・URLをそのまま公開する', () => {
    expect(CAMPUS_MAP_TILE_PROFILE).toMatchObject({
      id: 'campus',
      bounds: CAMPUS_MAP_CONFIG.bounds,
      minZoom: CAMPUS_MAP_CONFIG.minZoom,
      maxZoom: CAMPUS_MAP_CONFIG.maxZoom,
      minNativeZoom: CAMPUS_MAP_CONFIG.minNativeZoom,
      maxNativeZoom: CAMPUS_MAP_CONFIG.maxNativeZoom,
      publicDirectory: 'public/map-tiles',
      urlTemplate: '/map-tiles/{z}/{x}/{y}.webp',
    });
    expect(getMapTileProfile('campus')).toBe(CAMPUS_MAP_TILE_PROFILE);
  });

  it('regional profileは正式34社を画面別の表示余白込みで覆う', () => {
    expect(REGIONAL_MAP_TILE_PROFILE).toMatchObject({
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
      expectedMaxTileCount: 6_984,
      expectedMaxBytes: 64 * 1024 * 1024,
    });
    expect(getMapTileProfile('regional')).toBe(REGIONAL_MAP_TILE_PROFILE);
  });

  it('未知のprofile名を拒否する', () => {
    expect(() => getMapTileProfile('fixture')).toThrow(/不明なprofile/);
  });
});
