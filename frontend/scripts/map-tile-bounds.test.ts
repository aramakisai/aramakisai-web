import { describe, it, expect } from 'vitest';
import {
  calculateMapTileBounds,
  exceedsTileCountThreshold,
  TILE_COUNT_THRESHOLD,
} from './map-tile-bounds';
import type { CampusMapConfig } from '../src/lib/campus-map-config';

const baseConfig: Pick<CampusMapConfig, 'bounds' | 'minZoom' | 'maxZoom'> = {
  bounds: [
    [36.4241, 139.034],
    [36.4395, 139.0588],
  ],
  minZoom: 17,
  maxZoom: 19,
};

describe('calculateMapTileBounds', () => {
  it('minZoom から maxZoom までの各ズームについて範囲を算出する', () => {
    const result = calculateMapTileBounds(baseConfig);
    expect(result.zoomRanges.map((r) => r.zoom)).toEqual([17, 18, 19]);
  });

  it('各ズームの枚数は x 範囲 * y 範囲になる', () => {
    const result = calculateMapTileBounds(baseConfig);
    for (const range of result.zoomRanges) {
      expect(range.count).toBe(
        (range.xMax - range.xMin + 1) * (range.yMax - range.yMin + 1),
      );
    }
  });

  it('ズームが上がるほど範囲 (枚数) が広がる', () => {
    const result = calculateMapTileBounds(baseConfig);
    const [z17, z18, z19] = result.zoomRanges;
    expect(z18.count).toBeGreaterThan(z17.count);
    expect(z19.count).toBeGreaterThan(z18.count);
  });

  it('合計枚数は各ズームの枚数の合計と一致する', () => {
    const result = calculateMapTileBounds(baseConfig);
    const sum = result.zoomRanges.reduce((acc, r) => acc + r.count, 0);
    expect(result.totalCount).toBe(sum);
  });

  it('単一タイルに収まる極小の範囲では 1 ズームあたり 1 枚になる', () => {
    const result = calculateMapTileBounds({
      bounds: [
        [36.4318, 139.0464],
        [36.43181, 139.04641],
      ],
      minZoom: 10,
      maxZoom: 10,
    });
    expect(result.zoomRanges[0].count).toBe(1);
  });
});

describe('exceedsTileCountThreshold', () => {
  it('想定枚数 (1323) の 1.5 倍ちょうどでは超過にならない', () => {
    expect(
      exceedsTileCountThreshold({
        zoomRanges: [],
        totalCount: TILE_COUNT_THRESHOLD,
      }),
    ).toBe(false);
  });

  it('想定枚数の 1.5 倍を超えると超過と判定する', () => {
    expect(
      exceedsTileCountThreshold({
        zoomRanges: [],
        totalCount: TILE_COUNT_THRESHOLD + 1,
      }),
    ).toBe(true);
  });

  it('現行の CAMPUS_MAP_CONFIG から算出した枚数は閾値を超えない', () => {
    const result = calculateMapTileBounds(baseConfig);
    expect(exceedsTileCountThreshold(result)).toBe(false);
  });
});
