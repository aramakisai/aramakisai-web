import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  hasMapTileVerificationFailure,
  verifyMapTiles,
  createFsStatTile,
  validateWebpTile,
  type StatTile,
  BLANK_TILE_BYTES,
  LANDMARK_MIN_BYTES,
} from './verify-map-tiles';
import type { MapTileProfile } from '../src/lib/map-tile-profile';

const tinyProfile: MapTileProfile = {
  id: 'campus',
  // 空白検出の対象外ズーム (z10 以下) で 1 枚だけになる極小範囲
  bounds: [
    [36.4318, 139.0464],
    [36.43181, 139.04641],
  ],
  minZoom: 10,
  maxZoom: 10,
  minNativeZoom: 9,
  maxNativeZoom: 10,
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
    expect(result.expectedCount).toBe(2);
    expect(result.foundCount).toBe(2);
    expect(result.totalSizeBytes).toBe(200);
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

  it('合計容量が上限ちょうどなら合格する', async () => {
    const statTile: StatTile = vi.fn().mockResolvedValue({
      exists: true,
      sizeBytes: 600,
    });
    const result = await verifyMapTiles(statTile, {
      ...tinyProfile,
      expectedMaxBytes: 1_200,
    });

    expect(result.exceedsByteLimit).toBe(false);
    expect(hasMapTileVerificationFailure(result)).toBe(false);
  });

  it('破損したWebPを失敗と判定する', async () => {
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

describe('空白タイル検出', () => {
  const z16Profile: MapTileProfile = {
    ...tinyProfile,
    minNativeZoom: 16,
    maxNativeZoom: 16,
    minZoom: 16,
    maxZoom: 16,
    bounds: [
      [36.4318, 139.0464],
      [36.4335, 139.0485],
    ],
    expectedMaxTileCount: 100,
    expectedMaxBytes: 10_000_000,
  };

  it('z16で許容割合を超える小タイルを失敗と判定する', async () => {
    const statTile: StatTile = vi
      .fn()
      .mockResolvedValue({ exists: true, sizeBytes: BLANK_TILE_BYTES - 1 });
    const result = await verifyMapTiles(statTile, z16Profile);

    expect(result.blankTileViolations).toHaveLength(1);
    expect(hasMapTileVerificationFailure(result)).toBe(true);
  });

  // 先頭 blankCount 枚だけ小タイルにする
  const blankFirst = (blankCount: number): StatTile => {
    let calls = 0;
    return async () => ({
      exists: true,
      sizeBytes: calls++ < blankCount ? BLANK_TILE_BYTES - 1 : BLANK_TILE_BYTES,
    });
  };

  // z16 は 48 枚で許容 3% (1.44 枚)、z13 は許容 0%
  const z16Wide: MapTileProfile = {
    ...z16Profile,
    bounds: [
      [36.43, 139.04],
      [36.45, 139.08],
    ],
    expectedMaxTileCount: 100,
  };

  it('z16の許容割合以内 (1/48枚) の空白は合格する', async () => {
    const result = await verifyMapTiles(blankFirst(1), z16Wide);

    expect(result.expectedCount).toBe(48);
    expect(result.blankTileViolations).toEqual([]);
    expect(hasMapTileVerificationFailure(result)).toBe(false);
  });

  it('z16の許容割合を1枚超える (2/48枚) と失敗する', async () => {
    const result = await verifyMapTiles(blankFirst(2), z16Wide);

    expect(result.blankTileViolations).toEqual([
      { zoom: 16, blankCount: 2, totalCount: 48, maxRatio: 0.03 },
    ]);
    expect(hasMapTileVerificationFailure(result)).toBe(true);
  });

  it('許容0%のz13は空白0枚なら合格し、1枚でも混ざると失敗する', async () => {
    const z13: MapTileProfile = {
      ...z16Wide,
      minZoom: 13,
      maxZoom: 13,
      minNativeZoom: 13,
      maxNativeZoom: 13,
    };
    const ok = await verifyMapTiles(blankFirst(0), z13);
    expect(ok.blankTileViolations).toEqual([]);

    const ng = await verifyMapTiles(blankFirst(1), z13);
    expect(ng.blankTileViolations.map((v) => v.zoom)).toEqual([13]);
    expect(hasMapTileVerificationFailure(ng)).toBe(true);
  });

  it('十分な大きさのタイルは通す', async () => {
    const statTile: StatTile = vi
      .fn()
      .mockResolvedValue({ exists: true, sizeBytes: BLANK_TILE_BYTES });
    const result = await verifyMapTiles(statTile, z16Profile);

    expect(result.blankTileViolations).toEqual([]);
  });

  it('基準点タイルがLANDMARK_MIN_BYTESちょうどなら違反にならない', async () => {
    const profile: MapTileProfile = {
      ...tinyProfile,
      minNativeZoom: 13,
      maxNativeZoom: 13,
      expectedMaxBytes: 10_000_000,
      landmarks: [{ name: '基準点', latitude: 36.4318, longitude: 139.0464 }],
    };
    const exact = vi
      .fn()
      .mockResolvedValue({ exists: true, sizeBytes: LANDMARK_MIN_BYTES });
    const result = await verifyMapTiles(exact, profile);

    expect(result.landmarkViolations).toEqual([]);
  });

  it('z13〜16の基準点タイルが小さければ失敗と判定する', async () => {
    const profile: MapTileProfile = {
      ...tinyProfile,
      minNativeZoom: 13,
      maxNativeZoom: 13,
      expectedMaxBytes: 10_000_000,
      landmarks: [{ name: '基準点', latitude: 36.4318, longitude: 139.0464 }],
    };
    const small = vi
      .fn()
      .mockResolvedValue({ exists: true, sizeBytes: LANDMARK_MIN_BYTES - 1 });
    const result = await verifyMapTiles(small, profile);

    expect(result.landmarkViolations.map((v) => v.zoom)).toEqual([
      13, 14, 15, 16,
    ]);
    expect(hasMapTileVerificationFailure(result)).toBe(true);
  });
});

describe('validateWebpTile', () => {
  it('RIFF/WEBPヘッダーを受理する', () => {
    const body = Buffer.alloc(12);
    body.write('RIFF', 0, 'ascii');
    body.write('WEBP', 8, 'ascii');
    expect(validateWebpTile(body)).toBeNull();
  });

  it('コミット済みの実タイル (VP8) を受理する', async () => {
    const body = await readFile(
      path.join(__dirname, '..', 'public/regional-map-tiles/11/1814/800.webp'),
    );
    expect(body.toString('ascii', 12, 16)).toBe('VP8 ');
    expect(validateWebpTile(body)).toBeNull();
  });

  it('WebPでないデータを拒否する', () => {
    expect(validateWebpTile(Buffer.from('not-webp'))).toMatch(/WebP/);
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
