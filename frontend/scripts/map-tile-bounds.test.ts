import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import {
  calculateMapTileBounds,
  exceedsTileCountLimit,
  resolveMapTileProfileFromArgs,
} from './map-tile-bounds';
import { CAMPUS_MAP_TILE_PROFILE } from '../src/lib/campus-map-config';
import {
  isWithinMapTileProfile,
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
  it('minNativeZoom から maxNativeZoom までの各ズームについて範囲を算出する (minZoom は 15.5 でも 16 から)', () => {
    const result = calculateMapTileBounds(fixtureProfile);
    expect(result.zoomRanges.map((r) => r.zoom)).toEqual([16, 17, 18, 19]);
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

  it('固定regionalサービス範囲はz11-16・4656枚で上限内に収まる', () => {
    const result = calculateMapTileBounds(REGIONAL_MAP_TILE_PROFILE);
    expect(result.zoomRanges.map(({ zoom }) => zoom)).toEqual([
      11, 12, 13, 14, 15, 16,
    ]);
    expect(result.totalCount).toBe(4656);
    expect(exceedsTileCountLimit(result, REGIONAL_MAP_TILE_PROFILE)).toBe(
      false,
    );

    const z11 = result.zoomRanges[0];
    expect([z11.xMin, z11.xMax, z11.yMin, z11.yMax]).toEqual([
      1814, 1816, 800, 802,
    ]);
    // コミット済みタイルの構成と範囲が一致すること
    const z11Dir = path.join(
      __dirname,
      '..',
      REGIONAL_MAP_TILE_PROFILE.publicDirectory,
      '11',
    );
    expect(readdirSync(z11Dir).sort()).toEqual(['1814', '1815', '1816']);
    for (const x of ['1814', '1815', '1816']) {
      expect(readdirSync(path.join(z11Dir, x)).sort()).toEqual([
        '800.webp',
        '801.webp',
        '802.webp',
      ]);
    }
  });

  it('regional profileの範囲にlandmark全件と荒牧キャンパス中心が入る', () => {
    const landmarks = REGIONAL_MAP_TILE_PROFILE.landmarks;
    expect(landmarks.length).toBeGreaterThan(0);
    for (const { latitude, longitude } of landmarks) {
      expect(
        isWithinMapTileProfile(REGIONAL_MAP_TILE_PROFILE, latitude, longitude),
      ).toBe(true);
    }
    const [[south, west], [north, east]] = CAMPUS_MAP_TILE_PROFILE.bounds;
    expect(
      isWithinMapTileProfile(
        REGIONAL_MAP_TILE_PROFILE,
        (south + north) / 2,
        (west + east) / 2,
      ),
    ).toBe(true);
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
