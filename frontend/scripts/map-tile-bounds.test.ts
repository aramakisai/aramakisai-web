import { describe, it, expect } from 'vitest';
import {
  calculateMapTileBounds,
  exceedsTileCountLimit,
  resolveMapTileProfileFromArgs,
} from './map-tile-bounds';
import { CAMPUS_MAP_TILE_PROFILE } from '../src/lib/campus-map-config';
import {
  REGIONAL_MAP_TILE_PROFILE,
  type MapTileProfile,
} from '../src/lib/map-tile-profile';

const fixtureProfile: MapTileProfile = {
  id: 'campus',
  bounds: [
    [36.4241, 139.034],
    [36.4395, 139.0588],
  ],
  minZoom: 15.5,
  maxZoom: 21,
  minNativeZoom: 16,
  maxNativeZoom: 19,
  publicDirectory: 'test-output/map-tiles',
  urlTemplate: '/test-map-tiles/{z}/{x}/{y}.webp',
  expectedMaxTileCount: 2_181,
  expectedMaxBytes: 10_000_000,
};

describe('calculateMapTileBounds', () => {
  it('minZoom から maxZoom までの各ズームについて範囲を算出する', () => {
    const result = calculateMapTileBounds(fixtureProfile);
    expect(result.zoomRanges.map((r) => r.zoom)).toEqual([16, 17, 18, 19]);
  });

  it('各ズームの枚数は x 範囲 * y 範囲になる', () => {
    const result = calculateMapTileBounds(fixtureProfile);
    for (const range of result.zoomRanges) {
      expect(range.count).toBe(
        (range.xMax - range.xMin + 1) * (range.yMax - range.yMin + 1),
      );
    }
  });

  it('ズームが上がるほど範囲 (枚数) が広がる', () => {
    const result = calculateMapTileBounds(fixtureProfile);
    const [z16, z17, z18, z19] = result.zoomRanges;
    expect(z17.count).toBeGreaterThan(z16.count);
    expect(z18.count).toBeGreaterThan(z17.count);
    expect(z19.count).toBeGreaterThan(z18.count);
  });

  it('合計枚数は各ズームの枚数の合計と一致する', () => {
    const result = calculateMapTileBounds(fixtureProfile);
    const sum = result.zoomRanges.reduce((acc, r) => acc + r.count, 0);
    expect(result.totalCount).toBe(sum);
  });

  it('単一タイルに収まる極小の範囲では 1 ズームあたり 1 枚になる', () => {
    const result = calculateMapTileBounds({
      ...fixtureProfile,
      bounds: [
        [36.4318, 139.0464],
        [36.43181, 139.04641],
      ],
      minNativeZoom: 10,
      maxNativeZoom: 10,
    });
    expect(result.zoomRanges[0].count).toBe(1);
  });
});

describe('exceedsTileCountLimit', () => {
  it('profileの最大枚数ちょうどでは超過にならない', () => {
    expect(
      exceedsTileCountLimit(
        {
          zoomRanges: [],
          totalCount: fixtureProfile.expectedMaxTileCount,
        },
        fixtureProfile,
      ),
    ).toBe(false);
  });

  it('profileの最大枚数を超えると超過と判定する', () => {
    expect(
      exceedsTileCountLimit(
        {
          zoomRanges: [],
          totalCount: fixtureProfile.expectedMaxTileCount + 1,
        },
        fixtureProfile,
      ),
    ).toBe(true);
  });

  it('現行campus profileはz16-19・1454枚を維持する', () => {
    const result = calculateMapTileBounds(CAMPUS_MAP_TILE_PROFILE);
    expect(result.zoomRanges.map((range) => range.zoom)).toEqual([
      16, 17, 18, 19,
    ]);
    expect(result.totalCount).toBe(1454);
    expect(exceedsTileCountLimit(result, CAMPUS_MAP_TILE_PROFILE)).toBe(false);
  });

  it('固定regionalサービス範囲はz11-16で上限内に収まる', () => {
    const result = calculateMapTileBounds(REGIONAL_MAP_TILE_PROFILE);
    expect(result.zoomRanges.map(({ zoom }) => zoom)).toEqual([
      11, 12, 13, 14, 15, 16,
    ]);
    expect(result.zoomRanges.every(({ count }) => count > 0)).toBe(true);
    expect(exceedsTileCountLimit(result, REGIONAL_MAP_TILE_PROFILE)).toBe(
      false,
    );
  });
});

describe('resolveMapTileProfileFromArgs', () => {
  it('--profile campusを解決する', () => {
    expect(resolveMapTileProfileFromArgs(['--profile', 'campus'])).toBe(
      CAMPUS_MAP_TILE_PROFILE,
    );
  });

  it('profile未指定を拒否する', () => {
    expect(() => resolveMapTileProfileFromArgs([])).toThrow(/--profile/);
  });

  it('--profile regionalを正式profileへ解決する', () => {
    expect(resolveMapTileProfileFromArgs(['--profile', 'regional'])).toBe(
      REGIONAL_MAP_TILE_PROFILE,
    );
  });
});
