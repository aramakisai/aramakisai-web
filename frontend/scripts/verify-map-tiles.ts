import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  calculateMapTileBounds,
  latitudeToTileY,
  longitudeToTileX,
  resolveMapTileProfileFromArgs,
} from './map-tile-bounds';
import type { MapTileProfile } from '../src/lib/map-tile-profile';

export interface TileStat {
  readonly exists: boolean;
  readonly sizeBytes: number;
  readonly validationError?: string;
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

export interface InvalidTile extends MissingTile {
  readonly reason: string;
}

export interface BlankTileViolation {
  readonly zoom: number;
  readonly blankCount: number;
  readonly totalCount: number;
  readonly maxRatio: number;
}

export interface LandmarkViolation extends MissingTile {
  readonly name: string;
  readonly sizeBytes: number;
}

// 描画漏れのタイルは空白の無地になり、WebP で数百バイトまで縮む。
// 海や山林で正当に小さくなるタイルがあるため、ズームごとに許容割合を持つ
export const BLANK_TILE_BYTES = 1024;
export const BLANK_TILE_MAX_RATIO: Readonly<Record<number, number>> = {
  11: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 0.01,
  16: 0.03,
};
// 住宅地の朝倉町 z16 は正常描画でも約4.0KBに収まるため、4KBでは誤検出する
export const LANDMARK_MIN_BYTES = 3072;
const LANDMARK_ZOOMS = [13, 14, 15, 16];

export interface VerifyMapTilesResult {
  readonly expectedCount: number;
  readonly foundCount: number;
  readonly missingTiles: readonly MissingTile[];
  readonly invalidTiles: readonly InvalidTile[];
  readonly blankTileViolations: readonly BlankTileViolation[];
  readonly landmarkViolations: readonly LandmarkViolation[];
  readonly totalSizeBytes: number;
  readonly exceedsByteLimit: boolean;
}

export async function verifyMapTiles(
  statTile: StatTile,
  profile: MapTileProfile,
): Promise<VerifyMapTilesResult> {
  const { zoomRanges, totalCount } = calculateMapTileBounds(profile);
  const missingTiles: MissingTile[] = [];
  const invalidTiles: InvalidTile[] = [];
  let foundCount = 0;
  const blankTileViolations: BlankTileViolation[] = [];
  const landmarkViolations: LandmarkViolation[] = [];
  let totalSizeBytes = 0;

  for (const range of zoomRanges) {
    let blankCount = 0;
    let zoomCount = 0;
    for (let x = range.xMin; x <= range.xMax; x++) {
      for (let y = range.yMin; y <= range.yMax; y++) {
        const result = await statTile(range.zoom, x, y);
        if (result.exists) {
          foundCount++;
          totalSizeBytes += result.sizeBytes;
          zoomCount++;
          if (result.sizeBytes < BLANK_TILE_BYTES) blankCount++;
          if (result.validationError) {
            invalidTiles.push({
              zoom: range.zoom,
              x,
              y,
              reason: result.validationError,
            });
          }
        } else {
          missingTiles.push({ zoom: range.zoom, x, y });
        }
      }
    }
    const maxRatio = BLANK_TILE_MAX_RATIO[range.zoom];
    if (maxRatio !== undefined && blankCount > zoomCount * maxRatio) {
      blankTileViolations.push({
        zoom: range.zoom,
        blankCount,
        totalCount: zoomCount,
        maxRatio,
      });
    }
  }

  for (const landmark of profile.landmarks ?? []) {
    for (const zoom of LANDMARK_ZOOMS) {
      const x = longitudeToTileX(landmark.longitude, zoom);
      const y = latitudeToTileY(landmark.latitude, zoom);
      const result = await statTile(zoom, x, y);
      if (result.exists && result.sizeBytes < LANDMARK_MIN_BYTES) {
        landmarkViolations.push({
          name: landmark.name,
          zoom,
          x,
          y,
          sizeBytes: result.sizeBytes,
        });
      }
    }
  }

  return {
    expectedCount: totalCount,
    foundCount,
    missingTiles,
    invalidTiles,
    blankTileViolations,
    landmarkViolations,
    totalSizeBytes,
    exceedsByteLimit: totalSizeBytes > profile.expectedMaxBytes,
  };
}

export function hasMapTileVerificationFailure(
  result: VerifyMapTilesResult,
): boolean {
  return (
    result.missingTiles.length > 0 ||
    result.invalidTiles.length > 0 ||
    result.blankTileViolations.length > 0 ||
    result.landmarkViolations.length > 0 ||
    result.exceedsByteLimit
  );
}

export function validateWebpTile(body: Buffer): string | null {
  if (
    body.length < 12 ||
    body.toString('ascii', 0, 4) !== 'RIFF' ||
    body.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return 'WebPのRIFFヘッダーがありません';
  }
  return null;
}

export function createFsStatTile(tilesDir: string): StatTile {
  return async (zoom, x, y) => {
    const filePath = path.join(tilesDir, String(zoom), String(x), `${y}.webp`);
    try {
      const body = await readFile(filePath);
      const validationError = validateWebpTile(body);
      return {
        exists: true,
        sizeBytes: body.length,
        ...(validationError ? { validationError } : {}),
      };
    } catch {
      return { exists: false, sizeBytes: 0 };
    }
  };
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

async function main(): Promise<void> {
  const profile = resolveMapTileProfileFromArgs(process.argv.slice(2));
  const tilesDir =
    process.env.MAP_TILES_DIR ??
    path.join(__dirname, '..', profile.publicDirectory);
  const result = await verifyMapTiles(createFsStatTile(tilesDir), profile);

  console.log(`profile: ${profile.id}`);
  console.log(`期待枚数: ${result.expectedCount} 枚`);
  console.log(`存在: ${result.foundCount} 枚`);
  console.log(`総容量: ${formatBytes(result.totalSizeBytes)}`);
  console.log(`最大容量: ${formatBytes(profile.expectedMaxBytes)}`);

  if (result.missingTiles.length > 0) {
    console.error(`${result.missingTiles.length} 枚が欠落しています:`);
    for (const tile of result.missingTiles.slice(0, 20)) {
      console.error(`  z${tile.zoom}/${tile.x}/${tile.y}.webp`);
    }
  }
  if (result.invalidTiles.length > 0) {
    console.error(`${result.invalidTiles.length} 枚が不正です:`);
    for (const tile of result.invalidTiles.slice(0, 20)) {
      console.error(`  z${tile.zoom}/${tile.x}/${tile.y}.webp: ${tile.reason}`);
    }
  }
  for (const v of result.blankTileViolations) {
    console.error(
      `z${v.zoom}: ${BLANK_TILE_BYTES}B未満のタイルが ${v.blankCount}/${v.totalCount} 枚 (許容 ${v.maxRatio * 100}%)`,
    );
  }
  for (const v of result.landmarkViolations) {
    console.error(
      `${v.name} を含む z${v.zoom}/${v.x}/${v.y}.webp が ${v.sizeBytes}B (${LANDMARK_MIN_BYTES}B未満)`,
    );
  }
  if (result.exceedsByteLimit) {
    console.error(`最大容量 ${profile.expectedMaxBytes} bytesを超えています`);
  }
  if (hasMapTileVerificationFailure(result)) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
