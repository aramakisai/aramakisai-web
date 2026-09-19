import { describe, it, expect, vi } from 'vitest';
import { verifyMapTiles, type StatTile } from './verify-map-tiles';
import type { CampusMapConfig } from '../src/lib/campus-map-config';

const tinyConfig: Pick<CampusMapConfig, 'bounds' | 'minZoom' | 'maxZoom'> = {
  // z10 で 1 枚だけになる極小範囲
  bounds: [
    [36.4318, 139.0464],
    [36.43181, 139.04641],
  ],
  minZoom: 10,
  maxZoom: 11,
};

describe('verifyMapTiles', () => {
  it('すべてのタイルが存在する場合、欠落なしで合計容量を返す', async () => {
    const statTile: StatTile = vi.fn().mockResolvedValue({
      exists: true,
      sizeBytes: 100,
    });

    const result = await verifyMapTiles(statTile, tinyConfig);

    expect(result.missingTiles).toEqual([]);
    expect(result.foundCount).toBe(result.expectedCount);
    expect(result.totalSizeBytes).toBe(result.expectedCount * 100);
  });

  it('存在しないタイルを欠落として報告する', async () => {
    const statTile: StatTile = vi
      .fn()
      .mockResolvedValueOnce({ exists: true, sizeBytes: 100 })
      .mockResolvedValue({ exists: false, sizeBytes: 0 });

    const result = await verifyMapTiles(statTile, tinyConfig);

    expect(result.foundCount).toBe(1);
    expect(result.missingTiles.length).toBe(result.expectedCount - 1);
    expect(result.totalSizeBytes).toBe(100);
  });

  it('期待枚数は範囲算出スクリプトの合計と一致する', async () => {
    const statTile: StatTile = vi
      .fn()
      .mockResolvedValue({ exists: true, sizeBytes: 1 });
    const result = await verifyMapTiles(statTile, tinyConfig);
    expect(result.expectedCount).toBeGreaterThan(0);
  });
});
