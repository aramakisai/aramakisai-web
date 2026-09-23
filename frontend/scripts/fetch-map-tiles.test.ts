import { describe, it, expect, vi } from 'vitest';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  fetchMapTiles,
  tileUrl,
  validatePngBody,
  type FetchTileBytes,
  type TileCoord,
} from './fetch-map-tiles';

const PNG_BODY = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake-png-data'),
]);

const coords: TileCoord[] = [
  { zoom: 18, x: 10, y: 20 },
  { zoom: 18, x: 10, y: 21 },
];

describe('tileUrl', () => {
  it('overv/openstreetmap-tile-server の /tile/{z}/{x}/{y}.png 形式を組み立てる', () => {
    expect(tileUrl('http://localhost:8080', { zoom: 18, x: 10, y: 20 })).toBe(
      'http://localhost:8080/tile/18/10/20.png',
    );
  });
});

describe('validatePngBody', () => {
  it('PNG マジックバイトを含むボディを正常と判定する', () => {
    expect(validatePngBody(PNG_BODY)).toBeNull();
  });

  it('HTML など非 PNG のレスポンスを異常として検出する', () => {
    const htmlBody = Buffer.from('<html><body>Not Found</body></html>');
    expect(validatePngBody(htmlBody)).toMatch(/マジックバイト/);
  });

  it('空のレスポンスを異常として検出する', () => {
    expect(validatePngBody(Buffer.alloc(0))).toMatch(/空です/);
  });
});

describe('fetchMapTiles', () => {
  it('すべて成功した場合、ファイルへ書き出して失敗なしで返す', async () => {
    const fetchTileBytes: FetchTileBytes = vi
      .fn()
      .mockResolvedValue({ status: 200, body: PNG_BODY });
    const dir = await mkdtemp(path.join(tmpdir(), 'fetch-map-tiles-test-'));
    try {
      const result = await fetchMapTiles(coords, {
        baseUrl: 'http://localhost:8080',
        outDir: dir,
        fetchTileBytes,
      });

      expect(result.succeededCount).toBe(2);
      expect(result.failures).toEqual([]);
      const written = await readFile(path.join(dir, '18', '10', '20.png'));
      expect(written.equals(PNG_BODY)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('HTTP ステータス異常を座標付きで失敗として報告する', async () => {
    const fetchTileBytes: FetchTileBytes = vi
      .fn()
      .mockResolvedValue({ status: 404, body: Buffer.alloc(0) });

    const result = await fetchMapTiles(coords, {
      baseUrl: 'http://localhost:8080',
      outDir: '/unused',
      fetchTileBytes,
      writeFile: vi.fn(),
    });

    expect(result.succeededCount).toBe(0);
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0]).toMatchObject({
      zoom: 18,
      x: 10,
      y: 20,
      reason: 'HTTP 404',
    });
  });

  it('ステータス 200 でも中身が非 PNG なら座標付きで失敗として報告する', async () => {
    const fetchTileBytes: FetchTileBytes = vi.fn().mockResolvedValue({
      status: 200,
      body: Buffer.from('<html>error page</html>'),
    });

    const result = await fetchMapTiles(coords, {
      baseUrl: 'http://localhost:8080',
      outDir: '/unused',
      fetchTileBytes,
      writeFile: vi.fn(),
    });

    expect(result.succeededCount).toBe(0);
    expect(result.failures.every((f) => /マジックバイト/.test(f.reason))).toBe(
      true,
    );
  });

  it('ネットワークエラーも座標付きで失敗として報告する', async () => {
    const fetchTileBytes: FetchTileBytes = vi
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await fetchMapTiles(coords, {
      baseUrl: 'http://localhost:8080',
      outDir: '/unused',
      fetchTileBytes,
      writeFile: vi.fn(),
    });

    expect(result.failures).toHaveLength(2);
    expect(result.failures[0].reason).toMatch(/ECONNREFUSED/);
  });
});
