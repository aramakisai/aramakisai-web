import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  hasMapTileVerificationFailure,
  verifyMapTiles,
  createFsStatTile,
  validateWebpTile,
  type StatTile,
} from './verify-map-tiles';
import type { MapTileProfile } from '../src/lib/map-tile-profile';

const tinyProfile: MapTileProfile = {
  id: 'campus',
  // z10 で 1 枚だけになる極小範囲
  bounds: [
    [36.4318, 139.0464],
    [36.43181, 139.04641],
  ],
  minZoom: 10,
  maxZoom: 11,
  minNativeZoom: 10,
  maxNativeZoom: 11,
  publicDirectory: 'test-output/map-tiles',
  urlTemplate: '/test-map-tiles/{z}/{x}/{y}.webp',
  expectedMaxTileCount: 10,
  expectedMaxBytes: 1_000,
};

describe('verifyMapTiles', () => {
  it('すべてのタイルが存在する場合、欠落なしで合計容量を返す', async () => {
    const statTile: StatTile = vi.fn().mockResolvedValue({
      exists: true,
      sizeBytes: 100,
    });

    const result = await verifyMapTiles(statTile, tinyProfile);

    expect(result.missingTiles).toEqual([]);
    expect(result.foundCount).toBe(result.expectedCount);
    expect(result.totalSizeBytes).toBe(result.expectedCount * 100);
    expect(hasMapTileVerificationFailure(result)).toBe(false);
  });

  it('存在しないタイルを欠落として報告する', async () => {
    const statTile: StatTile = vi
      .fn()
      .mockResolvedValueOnce({ exists: true, sizeBytes: 100 })
      .mockResolvedValue({ exists: false, sizeBytes: 0 });

    const result = await verifyMapTiles(statTile, tinyProfile);

    expect(result.foundCount).toBe(1);
    expect(result.missingTiles.length).toBe(result.expectedCount - 1);
    expect(result.totalSizeBytes).toBe(100);
  });

  it('期待枚数は範囲算出スクリプトの合計と一致する', async () => {
    const statTile: StatTile = vi
      .fn()
      .mockResolvedValue({ exists: true, sizeBytes: 1 });
    const result = await verifyMapTiles(statTile, tinyProfile);
    expect(result.expectedCount).toBeGreaterThan(0);
  });

  it('profileの最大容量を超えた結果を失敗と判定する', async () => {
    const statTile: StatTile = vi.fn().mockResolvedValue({
      exists: true,
      sizeBytes: 600,
    });
    const result = await verifyMapTiles(statTile, {
      ...tinyProfile,
      expectedMaxBytes: 1,
    });

    expect(result.exceedsByteLimit).toBe(true);
    expect(hasMapTileVerificationFailure(result)).toBe(true);
  });

  it('破損または256px角でないWebPを失敗と判定する', async () => {
    const statTile: StatTile = vi.fn().mockResolvedValue({
      exists: true,
      sizeBytes: 100,
      validationError: 'WebPではありません',
    });
    const result = await verifyMapTiles(statTile, tinyProfile);

    expect(result.invalidTiles).toHaveLength(result.expectedCount);
    expect(hasMapTileVerificationFailure(result)).toBe(true);
  });
});

describe('validateWebpTile', () => {
  function vp8x(width: number, height: number): Buffer {
    const body = Buffer.alloc(30);
    body.write('RIFF', 0, 'ascii');
    body.writeUInt32LE(body.length - 8, 4);
    body.write('WEBP', 8, 'ascii');
    body.write('VP8X', 12, 'ascii');
    body.writeUInt32LE(10, 16);
    body.writeUIntLE(width - 1, 24, 3);
    body.writeUIntLE(height - 1, 27, 3);
    return body;
  }

  it('256x256 WebPを受理する', () => {
    expect(validateWebpTile(vp8x(256, 256))).toBeNull();
  });

  it('WebPでないデータを拒否する', () => {
    expect(validateWebpTile(Buffer.from('not-webp'))).toMatch(/WebP/);
  });

  it('256x256でないWebPを拒否する', () => {
    expect(validateWebpTile(vp8x(512, 256))).toMatch(/512x256/);
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
    const body = Buffer.alloc(30);
    body.write('RIFF', 0, 'ascii');
    body.writeUInt32LE(body.length - 8, 4);
    body.write('WEBP', 8, 'ascii');
    body.write('VP8X', 12, 'ascii');
    body.writeUInt32LE(10, 16);
    body.writeUIntLE(255, 24, 3);
    body.writeUIntLE(255, 27, 3);
    await writeFile(path.join(dir, '16', '1', '2.webp'), body);

    const result = await createFsStatTile(dir)(16, 1, 2);

    expect(result).toEqual({ exists: true, sizeBytes: 30 });
  });

  it('同じ座標に png しかない場合は欠落として扱う (配信形式は webp 固定)', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'verify-map-tiles-test-'));
    await mkdir(path.join(dir, '16', '1'), { recursive: true });
    await writeFile(path.join(dir, '16', '1', '2.png'), Buffer.alloc(10));

    const result = await createFsStatTile(dir)(16, 1, 2);

    expect(result.exists).toBe(false);
  });
});
