import { appendFileSync } from 'node:fs';
import {
  CAMPUS_MAP_CONFIG,
  type CampusMapConfig,
} from '../src/lib/campus-map-config';

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

// 実測 (z16-19 合計 1454 枚、CAMPUS_MAP_CONFIG のドライラン結果)。1.5 倍超で生成前に停止する。
const EXPECTED_TOTAL_TILE_COUNT = 1454;
export const TILE_COUNT_THRESHOLD = EXPECTED_TOTAL_TILE_COUNT * 1.5;

function longitudeToTileX(longitude: number, zoom: number): number {
  return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

// Web Mercator の標準変換 (https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
function latitudeToTileY(latitude: number, zoom: number): number {
  const latRad = (latitude * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      2 ** zoom,
  );
}

export function calculateMapTileBounds(
  config: Pick<
    CampusMapConfig,
    'bounds' | 'minZoom' | 'maxZoom'
  > = CAMPUS_MAP_CONFIG,
): MapTileBoundsResult {
  const [[south, west], [north, east]] = config.bounds;
  const zoomRanges: ZoomTileRange[] = [];

  for (let zoom = config.minZoom; zoom <= config.maxZoom; zoom++) {
    const xMin = longitudeToTileX(west, zoom);
    const xMax = longitudeToTileX(east, zoom);
    // 緯度が下がるほどタイル Y は増えるため、北端が yMin になる
    const yMin = latitudeToTileY(north, zoom);
    const yMax = latitudeToTileY(south, zoom);
    const count = (xMax - xMin + 1) * (yMax - yMin + 1);
    zoomRanges.push({ zoom, xMin, xMax, yMin, yMax, count });
  }

  const totalCount = zoomRanges.reduce((sum, range) => sum + range.count, 0);
  return { zoomRanges, totalCount };
}

export function exceedsTileCountThreshold(
  result: MapTileBoundsResult,
): boolean {
  return result.totalCount > TILE_COUNT_THRESHOLD;
}

function formatBbox(config: CampusMapConfig): string {
  // osmium extract --bbox の順序 (west,south,east,north)
  const [[south, west], [north, east]] = config.bounds;
  return `${west},${south},${east},${north}`;
}

function printReport(result: MapTileBoundsResult): void {
  for (const range of result.zoomRanges) {
    console.log(
      `z${range.zoom}: ${range.count} 枚 (x: ${range.xMin}-${range.xMax}, y: ${range.yMin}-${range.yMax})`,
    );
  }
  console.log(`合計: ${result.totalCount} 枚`);
}

function writeGithubOutput(result: MapTileBoundsResult): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = [
    `total-count=${result.totalCount}`,
    `bbox=${formatBbox(CAMPUS_MAP_CONFIG)}`,
    `zoom-ranges=${JSON.stringify(result.zoomRanges)}`,
    '',
  ];
  appendFileSync(outputPath, lines.join('\n'));
}

function main(): void {
  const result = calculateMapTileBounds();
  printReport(result);
  writeGithubOutput(result);

  if (exceedsTileCountThreshold(result)) {
    console.error(
      `想定 (${EXPECTED_TOTAL_TILE_COUNT} 枚) の 1.5 倍 (${TILE_COUNT_THRESHOLD} 枚) を超えています。レンダリング前に停止します。`,
    );
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
