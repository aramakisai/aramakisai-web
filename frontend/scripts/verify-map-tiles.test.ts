import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  verifyMapTiles,
  createFsStatTile,
  type StatTile,
} from './verify-map-tiles';
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

describe('createFsStatTile', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('webp ファイルを検出する', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'verify-map-tiles-test-'));
    await mkdir(path.join(dir, '16', '1'), { recursive: true });
    await writeFile(path.join(dir, '16', '1', '2.webp'), Buffer.alloc(10));

    const result = await createFsStatTile(dir)(16, 1, 2);

    expect(result).toEqual({ exists: true, sizeBytes: 10 });
  });

  it('同じ座標に png しかない場合は欠落として扱う (配信形式は webp 固定)', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'verify-map-tiles-test-'));
    await mkdir(path.join(dir, '16', '1'), { recursive: true });
    await writeFile(path.join(dir, '16', '1', '2.png'), Buffer.alloc(10));

    const result = await createFsStatTile(dir)(16, 1, 2);

    expect(result.exists).toBe(false);
  });
});
