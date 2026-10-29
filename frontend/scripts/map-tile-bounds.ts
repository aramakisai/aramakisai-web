import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  getMapTileProfile,
  type MapTileProfile,
} from '../src/lib/map-tile-profile';

export interface ZoomTileRange {
  readonly zoom: number;
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly count: number;
}

export interface MapTileBoundsResult {
  readonly zoomRanges: readonly ZoomTileRange[];
  readonly totalCount: number;
}

export function longitudeToTileX(longitude: number, zoom: number): number {
  return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

// Web Mercator の標準変換 (https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
export function latitudeToTileY(latitude: number, zoom: number): number {
  const latRad = (latitude * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      2 ** zoom,
  );
}

export function calculateMapTileBounds(
  profile: MapTileProfile,
): MapTileBoundsResult {
  const [[south, west], [north, east]] = profile.bounds;
  const zoomRanges: ZoomTileRange[] = [];

  // 生成対象は表示上の電子zoomではなく、実ファイルが存在するnative zoomだけにする。
  for (
    let zoom = profile.minNativeZoom;
    zoom <= profile.maxNativeZoom;
    zoom++
  ) {
    const xMin = longitudeToTileX(west, zoom);
    const xMax = longitudeToTileX(east, zoom);
    // 緯度が下がるほどタイルYは増えるため、北端がyMinになる
    const yMin = latitudeToTileY(north, zoom);
    const yMax = latitudeToTileY(south, zoom);
    const count = (xMax - xMin + 1) * (yMax - yMin + 1);
    zoomRanges.push({ zoom, xMin, xMax, yMin, yMax, count });
  }

  const totalCount = zoomRanges.reduce((sum, range) => sum + range.count, 0);
  return { zoomRanges, totalCount };
}

export function exceedsTileCountLimit(
  result: MapTileBoundsResult,
  profile: MapTileProfile,
): boolean {
  return result.totalCount > profile.expectedMaxTileCount;
}

export function resolveMapTileProfileFromArgs(
  args: readonly string[],
): MapTileProfile {
  const profileFlagIndex = args.indexOf('--profile');
  const profileId = args[profileFlagIndex + 1];
  if (profileFlagIndex < 0 || !profileId || profileId.startsWith('--')) {
    throw new Error('--profile campus|regional を指定してください');
  }
  return getMapTileProfile(profileId);
}

function formatBbox(profile: MapTileProfile): string {
  // osmium extract --bbox の順序 (west,south,east,north)
  const [[south, west], [north, east]] = profile.bounds;
  return `${west},${south},${east},${north}`;
}

function printReport(
  profile: MapTileProfile,
  result: MapTileBoundsResult,
): void {
  console.log(`profile: ${profile.id}`);
  for (const range of result.zoomRanges) {
    console.log(
      `z${range.zoom}: ${range.count} 枚 (x: ${range.xMin}-${range.xMax}, y: ${range.yMin}-${range.yMax})`,
    );
  }
  console.log(`合計: ${result.totalCount} 枚`);
  console.log(`最大枚数: ${profile.expectedMaxTileCount} 枚`);
  console.log(`最大容量: ${profile.expectedMaxBytes} bytes`);
}

function writeGithubOutput(
  profile: MapTileProfile,
  result: MapTileBoundsResult,
): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = [
    `bbox=${formatBbox(profile)}`,
    `zoom-ranges=${JSON.stringify(result.zoomRanges)}`,
    '',
  ];
  appendFileSync(outputPath, lines.join('\n'));
}

function main(): void {
  const profile = resolveMapTileProfileFromArgs(process.argv.slice(2));
  const result = calculateMapTileBounds(profile);
  printReport(profile, result);
  writeGithubOutput(profile, result);

  if (exceedsTileCountLimit(result, profile)) {
    console.error(
      `profile ${profile.id} の最大枚数 (${profile.expectedMaxTileCount} 枚) を超えています。レンダリング前に停止します。`,
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
