import { mkdir, writeFile as fsWriteFile } from 'node:fs/promises';
import path from 'node:path';
import {
  calculateMapTileBounds,
  type MapTileBoundsResult,
} from './map-tile-bounds';
import { CAMPUS_MAP_CONFIG } from '../src/lib/campus-map-config';

export interface TileCoord {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export function tileCoordsFromBoundsResult(
  bounds: MapTileBoundsResult,
): TileCoord[] {
  const coords: TileCoord[] = [];
  for (const range of bounds.zoomRanges) {
    for (let x = range.xMin; x <= range.xMax; x++) {
      for (let y = range.yMin; y <= range.yMax; y++) {
        coords.push({ zoom: range.zoom, x, y });
      }
    }
  }
  return coords;
}

export function tileUrl(baseUrl: string, coord: TileCoord): string {
  return `${baseUrl}/tile/${coord.zoom}/${coord.x}/${coord.y}.png`;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function validatePngBody(body: Buffer): string | null {
  if (body.length === 0) {
    return 'レスポンスボディが空です';
  }
  if (
    body.length < PNG_MAGIC.length ||
    !body.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
  ) {
    return 'PNG のマジックバイトを含みません';
  }
  return null;
}

export interface FetchedTile {
  readonly status: number;
  readonly body: Buffer;
}

export type FetchTileBytes = (url: string) => Promise<FetchedTile>;

export function createHttpFetchTileBytes(): FetchTileBytes {
  return async (url) => {
    const response = await fetch(url);
    const body = Buffer.from(await response.arrayBuffer());
    return { status: response.status, body };
  };
}

export interface TileFetchFailure extends TileCoord {
  readonly reason: string;
}

export interface FetchMapTilesResult {
  readonly succeededCount: number;
  readonly failures: readonly TileFetchFailure[];
}

export interface FetchMapTilesOptions {
  readonly baseUrl: string;
  readonly outDir: string;
  readonly fetchTileBytes: FetchTileBytes;
  readonly concurrency?: number;
  readonly writeFile?: (filePath: string, body: Buffer) => Promise<void>;
}

async function defaultWriteFile(filePath: string, body: Buffer): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await fsWriteFile(filePath, body);
}

// mod_tile 自体は ModTileThrottlingTiles でタイル配信のスロットリングを無効化 (Off) している。
// ボトルネックは Apache MPM event の ThreadsPerChild (25) 側にあるため、
// それを上回らない並列度に抑えて 1 リクエストずつのタイムアウト連鎖を避ける
export const DEFAULT_CONCURRENCY = 16;

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  async function runNext(): Promise<void> {
    while (nextIndex < items.length) {
      const item = items[nextIndex++];
      await worker(item);
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, runNext));
}

export async function fetchMapTiles(
  coords: readonly TileCoord[],
  options: FetchMapTilesOptions,
): Promise<FetchMapTilesResult> {
  const {
    baseUrl,
    outDir,
    fetchTileBytes,
    concurrency = DEFAULT_CONCURRENCY,
    writeFile = defaultWriteFile,
  } = options;
  const failures: TileFetchFailure[] = [];
  let succeededCount = 0;

  await runWithConcurrency(coords, concurrency, async (coord) => {
    const url = tileUrl(baseUrl, coord);
    let fetched: FetchedTile;
    try {
      fetched = await fetchTileBytes(url);
    } catch (error) {
      failures.push({
        ...coord,
        reason: `リクエストに失敗しました: ${String(error)}`,
      });
      return;
    }

    if (fetched.status !== 200) {
      failures.push({ ...coord, reason: `HTTP ${fetched.status}` });
      return;
    }

    const invalidReason = validatePngBody(fetched.body);
    if (invalidReason) {
      failures.push({ ...coord, reason: invalidReason });
      return;
    }

    const filePath = path.join(
      outDir,
      String(coord.zoom),
      String(coord.x),
      `${coord.y}.png`,
    );
    await writeFile(filePath, fetched.body);
    succeededCount++;
  });

  return { succeededCount, failures };
}

async function main(): Promise<void> {
  const baseUrl = process.env.MAP_TILE_SERVER_URL ?? 'http://localhost:8080';
  const outDir = process.env.MAP_TILES_OUT_DIR ?? 'rendered-tiles';
  const coords = tileCoordsFromBoundsResult(
    calculateMapTileBounds(CAMPUS_MAP_CONFIG),
  );

  console.log(
    `${coords.length} 枚を ${baseUrl} から取得します (並列度: ${DEFAULT_CONCURRENCY})`,
  );

  const result = await fetchMapTiles(coords, {
    baseUrl,
    outDir,
    fetchTileBytes: createHttpFetchTileBytes(),
  });

  console.log(`取得成功: ${result.succeededCount} 枚`);

  if (result.failures.length > 0) {
    console.error(`${result.failures.length} 枚の取得に失敗しました:`);
    for (const failure of result.failures) {
      console.error(
        `  z${failure.zoom}/${failure.x}/${failure.y}: ${failure.reason}`,
      );
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
