import { stat } from 'node:fs/promises';
import path from 'node:path';
import { calculateMapTileBounds } from './map-tile-bounds';
import { CAMPUS_MAP_CONFIG } from '../src/lib/campus-map-config';

export interface TileStat {
  readonly exists: boolean;
  readonly sizeBytes: number;
}

export type StatTile = (
  zoom: number,
  x: number,
  y: number,
) => Promise<TileStat>;

export interface MissingTile {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export interface VerifyMapTilesResult {
  readonly expectedCount: number;
  readonly foundCount: number;
  readonly missingTiles: readonly MissingTile[];
  readonly totalSizeBytes: number;
}

export async function verifyMapTiles(
  statTile: StatTile,
  config: Parameters<typeof calculateMapTileBounds>[0] = CAMPUS_MAP_CONFIG,
): Promise<VerifyMapTilesResult> {
  const { zoomRanges, totalCount } = calculateMapTileBounds(config);
  const missingTiles: MissingTile[] = [];
  let foundCount = 0;
  let totalSizeBytes = 0;

  for (const range of zoomRanges) {
    for (let x = range.xMin; x <= range.xMax; x++) {
      for (let y = range.yMin; y <= range.yMax; y++) {
        const result = await statTile(range.zoom, x, y);
        if (result.exists) {
          foundCount++;
          totalSizeBytes += result.sizeBytes;
        } else {
          missingTiles.push({ zoom: range.zoom, x, y });
        }
      }
    }
  }

  return {
    expectedCount: totalCount,
    foundCount,
    missingTiles,
    totalSizeBytes,
  };
}

export function createFsStatTile(tilesDir: string): StatTile {
  return async (zoom, x, y) => {
    const filePath = path.join(tilesDir, String(zoom), String(x), `${y}.webp`);
    try {
      const fileStat = await stat(filePath);
      return { exists: true, sizeBytes: fileStat.size };
    } catch {
      return { exists: false, sizeBytes: 0 };
    }
  };
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main(): Promise<void> {
  const tilesDir =
    process.env.MAP_TILES_DIR ??
    path.join(__dirname, '..', 'public', 'map-tiles');
  const result = await verifyMapTiles(createFsStatTile(tilesDir));

  console.log(`期待枚数: ${result.expectedCount} 枚`);
  console.log(`存在: ${result.foundCount} 枚`);
  console.log(`総容量: ${formatBytes(result.totalSizeBytes)}`);

  if (result.missingTiles.length > 0) {
    console.error(`${result.missingTiles.length} 枚が欠落しています:`);
    for (const tile of result.missingTiles.slice(0, 20)) {
      console.error(`  z${tile.zoom}/${tile.x}/${tile.y}.webp`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
