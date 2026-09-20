import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { tileCoordsFromBoundsResult, type TileCoord } from './fetch-map-tiles';
import { calculateMapTileBounds } from './map-tile-bounds';
import { CAMPUS_MAP_CONFIG } from '../src/lib/campus-map-config';

// 品質を上げるほど容量が増える。80 は cwebp の既定値で、地図タイル程度の情報量では
// 目視での劣化がほぼ気にならない一方、容量はほぼ半減する。変える場合はここ 1 箇所でよい
export const CWEBP_QUALITY = 80;

export type RunCwebp = (
  pngPath: string,
  webpPath: string,
  quality: number,
) => Promise<void>;

export type RemoveFile = (filePath: string) => Promise<void>;

const execFileAsync = promisify(execFile);

export function createCwebpRunner(): RunCwebp {
  return async (pngPath, webpPath, quality) => {
    await execFileAsync('cwebp', [
      '-q',
      String(quality),
      pngPath,
      '-o',
      webpPath,
    ]);
  };
}

export interface ConversionFailure extends TileCoord {
  readonly reason: string;
}

export interface ConvertMapTilesResult {
  readonly convertedCount: number;
  readonly failures: readonly ConversionFailure[];
}

export interface ConvertMapTilesOptions {
  readonly runCwebp: RunCwebp;
  readonly removeFile?: RemoveFile;
  readonly quality?: number;
}

export async function convertMapTilesToWebp(
  coords: readonly TileCoord[],
  tilesDir: string,
  options: ConvertMapTilesOptions,
): Promise<ConvertMapTilesResult> {
  const {
    runCwebp,
    removeFile = (filePath) => rm(filePath),
    quality = CWEBP_QUALITY,
  } = options;
  const failures: ConversionFailure[] = [];
  let convertedCount = 0;

  for (const coord of coords) {
    const pngPath = path.join(
      tilesDir,
      String(coord.zoom),
      String(coord.x),
      `${coord.y}.png`,
    );
    const webpPath = path.join(
      tilesDir,
      String(coord.zoom),
      String(coord.x),
      `${coord.y}.webp`,
    );

    try {
      await runCwebp(pngPath, webpPath, quality);
    } catch (error) {
      failures.push({
        ...coord,
        reason: `cwebp の実行に失敗しました: ${String(error)}`,
      });
      continue;
    }

    // 変換に成功したタイルだけ PNG を消す。失敗したタイルの PNG まで消すと、
    // そのタイルが webp にも PNG にも存在しない状態になり生成をやり直せなくなる
    await removeFile(pngPath);
    convertedCount++;
  }

  return { convertedCount, failures };
}

async function main(): Promise<void> {
  const tilesDir =
    process.env.MAP_TILES_DIR ?? path.join(__dirname, '..', 'rendered-tiles');
  const coords = tileCoordsFromBoundsResult(
    calculateMapTileBounds(CAMPUS_MAP_CONFIG),
  );

  const result = await convertMapTilesToWebp(coords, tilesDir, {
    runCwebp: createCwebpRunner(),
  });

  console.log(`変換成功: ${result.convertedCount} 枚`);

  if (result.failures.length > 0) {
    console.error(`${result.failures.length} 枚の変換に失敗しました:`);
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
