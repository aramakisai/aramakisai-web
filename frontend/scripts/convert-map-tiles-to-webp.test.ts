import { describe, it, expect, vi } from 'vitest';
import {
  convertMapTilesToWebp,
  CWEBP_QUALITY,
  type RunCwebp,
} from './convert-map-tiles-to-webp';
import type { TileCoord } from './fetch-map-tiles';

const coords: TileCoord[] = [
  { zoom: 18, x: 10, y: 20 },
  { zoom: 18, x: 10, y: 21 },
];

describe('convertMapTilesToWebp', () => {
  it('すべて成功した場合、既定の品質で cwebp を実行し元の PNG を削除する', async () => {
    const runCwebp: RunCwebp = vi.fn().mockResolvedValue(undefined);
    const removeFile = vi.fn().mockResolvedValue(undefined);

    const result = await convertMapTilesToWebp(coords, '/tiles', {
      runCwebp,
      removeFile,
    });

    expect(result.convertedCount).toBe(2);
    expect(result.failures).toEqual([]);
    expect(runCwebp).toHaveBeenCalledWith(
      '/tiles/18/10/20.png',
      '/tiles/18/10/20.webp',
      CWEBP_QUALITY,
    );
    expect(removeFile).toHaveBeenCalledWith('/tiles/18/10/20.png');
    expect(removeFile).toHaveBeenCalledTimes(2);
  });

  it('quality を指定した場合はそれを cwebp に渡す', async () => {
    const runCwebp: RunCwebp = vi.fn().mockResolvedValue(undefined);

    await convertMapTilesToWebp(coords, '/tiles', {
      runCwebp,
      removeFile: vi.fn().mockResolvedValue(undefined),
      quality: 50,
    });

    expect(runCwebp).toHaveBeenCalledWith(
      '/tiles/18/10/20.png',
      '/tiles/18/10/20.webp',
      50,
    );
  });

  it('cwebp が失敗した場合は座標付きで失敗として報告し、元の PNG は残す', async () => {
    const runCwebp: RunCwebp = vi
      .fn()
      .mockRejectedValueOnce(new Error('cwebp exited with code 1'))
      .mockResolvedValue(undefined);
    const removeFile = vi.fn().mockResolvedValue(undefined);

    const result = await convertMapTilesToWebp(coords, '/tiles', {
      runCwebp,
      removeFile,
    });

    expect(result.convertedCount).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatchObject({
      zoom: 18,
      x: 10,
      y: 20,
      reason: expect.stringMatching(/cwebp exited with code 1/),
    });
    // 変換に失敗したタイルの PNG は削除しない (失敗したタイルが1枚も残らなくなるのを防ぐ)
    expect(removeFile).toHaveBeenCalledTimes(1);
    expect(removeFile).not.toHaveBeenCalledWith('/tiles/18/10/20.png');
  });
});
