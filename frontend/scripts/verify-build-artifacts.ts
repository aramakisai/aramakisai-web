import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createFsStatTile,
  hasMapTileVerificationFailure,
  verifyMapTiles,
} from './verify-map-tiles';
import {
  getMapTileProfile,
  type MapTileProfile,
  type MapTileProfileId,
} from '../src/lib/map-tile-profile';

// phase-toggle.tsx にのみ現れる UI 文言。Cookie 名 (PHASE_OVERRIDE_COOKIE) は
// header.tsx / map-menu-button.tsx がナビ絞り込み (visibleNavItems) のために
// phase.ts を常時 import するため、開発用フラグ無効ビルドでも正当な理由で
// 成果物に残り、目印として使えない。
export const FORBIDDEN_STRINGS: readonly string[] = [
  'に切り替える',
  'オーバーライドを解除する',
];

export interface ForbiddenStringMatch {
  readonly file: string;
  readonly forbidden: string;
}

export interface DirectoryManifestEntry {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface DirectoryManifest {
  readonly entries: readonly DirectoryManifestEntry[];
  readonly fileCount: number;
  readonly totalSizeBytes: number;
  /** Sorted `path<TAB>size<TAB>file-sha256` entries hashed with SHA-256. */
  readonly sha256: string;
}

export interface MapTileArtifactVerification {
  readonly profileId: MapTileProfileId;
  readonly expectedCount: number;
  readonly source: DirectoryManifest;
  readonly built: DirectoryManifest;
}

export async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dirPath, entry.name);
      return entry.isDirectory() ? listFilesRecursive(fullPath) : [fullPath];
    }),
  );
  return nested.flat();
}

export async function createDirectoryManifest(
  dirPath: string,
): Promise<DirectoryManifest> {
  const files = (await listFilesRecursive(dirPath)).sort((left, right) =>
    path
      .relative(dirPath, left)
      .localeCompare(path.relative(dirPath, right), 'en'),
  );
  const entries: DirectoryManifestEntry[] = [];
  const manifestHash = createHash('sha256');
  let totalSizeBytes = 0;

  for (const file of files) {
    const body = await readFile(file);
    const relativePath = path.relative(dirPath, file).replaceAll('\\', '/');
    const sha256 = createHash('sha256').update(body).digest('hex');
    const entry = { path: relativePath, sizeBytes: body.length, sha256 };
    entries.push(entry);
    totalSizeBytes += body.length;
    manifestHash.update(
      `${entry.path}\t${entry.sizeBytes}\t${entry.sha256}\n`,
      'utf8',
    );
  }

  return {
    entries,
    fileCount: entries.length,
    totalSizeBytes,
    sha256: manifestHash.digest('hex'),
  };
}

function publicAssetPath(profile: MapTileProfile): string {
  const relativePath = path.relative('public', profile.publicDirectory);
  if (
    path.isAbsolute(relativePath) ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`${profile.id}: publicDirectoryがpublic配下ではありません`);
  }
  return relativePath;
}

export async function verifyMapTileArtifacts(
  frontendDir: string,
  openNextDir: string,
  profiles: readonly MapTileProfile[] = [
    getMapTileProfile('campus'),
    getMapTileProfile('regional'),
  ],
): Promise<readonly MapTileArtifactVerification[]> {
  const results: MapTileArtifactVerification[] = [];

  for (const profile of profiles) {
    const sourceDir = path.join(frontendDir, profile.publicDirectory);
    const builtDir = path.join(openNextDir, 'assets', publicAssetPath(profile));
    const sourceTiles = await verifyMapTiles(
      createFsStatTile(sourceDir),
      profile,
    );
    const builtTiles = await verifyMapTiles(
      createFsStatTile(builtDir),
      profile,
    );

    if (hasMapTileVerificationFailure(sourceTiles)) {
      throw new Error(`${profile.id}: publicのタイル検証に失敗しました`);
    }
    if (hasMapTileVerificationFailure(builtTiles)) {
      throw new Error(
        `${profile.id}: OpenNext成果物のタイル検証に失敗しました`,
      );
    }

    const source = await createDirectoryManifest(sourceDir);
    const built = await createDirectoryManifest(builtDir);
    if (source.fileCount !== sourceTiles.expectedCount) {
      throw new Error(
        `${profile.id}: publicの実ファイル数 ${source.fileCount} が期待枚数 ${sourceTiles.expectedCount} と一致しません`,
      );
    }
    if (built.fileCount !== builtTiles.expectedCount) {
      throw new Error(
        `${profile.id}: OpenNext成果物の実ファイル数 ${built.fileCount} が期待枚数 ${builtTiles.expectedCount} と一致しません`,
      );
    }
    if (
      source.sha256 !== built.sha256 ||
      source.totalSizeBytes !== built.totalSizeBytes
    ) {
      throw new Error(
        `${profile.id}: publicとOpenNext成果物のタイルmanifestが一致しません`,
      );
    }

    results.push({
      profileId: profile.id,
      expectedCount: sourceTiles.expectedCount,
      source,
      built,
    });
  }

  return results;
}

export function findForbiddenStringsInContent(
  content: string,
  forbiddenStrings: readonly string[],
): readonly string[] {
  return forbiddenStrings.filter((forbidden) => content.includes(forbidden));
}

export async function scanForForbiddenStrings(
  dirPath: string,
  forbiddenStrings: readonly string[] = FORBIDDEN_STRINGS,
): Promise<readonly ForbiddenStringMatch[]> {
  const files = await listFilesRecursive(dirPath);
  const matches: ForbiddenStringMatch[] = [];
  for (const file of files) {
    const content = await readFile(file, 'utf-8').catch(() => '');
    for (const forbidden of findForbiddenStringsInContent(
      content,
      forbiddenStrings,
    )) {
      matches.push({ file, forbidden });
    }
  }
  return matches;
}

// 本番で cookies() を呼ばず静的化 (ISR) されているべきルート。
export const REQUIRED_PRERENDERED_ROUTES: readonly string[] = [
  '/',
  '/faq',
  '/topics',
];

export function findMissingPrerenderedRoutes(
  manifest: { routes?: Record<string, unknown> },
  required: readonly string[] = REQUIRED_PRERENDERED_ROUTES,
): readonly string[] {
  const routes = manifest.routes ?? {};
  return required.filter((route) => !(route in routes));
}

async function main(): Promise<void> {
  // wrangler.toml の main = ".open-next/worker.js" と [assets] directory が
  // 示すとおり、実行基盤へ実際に配信されるのはこの出力全体である。.next/ のみを
  // 走査すると OpenNext による esbuild 再バンドルの結果を見落とす。
  const outputDir = path.join(__dirname, '..', '.open-next');
  const mapTilesOnly = process.argv.slice(2).includes('--map-tiles-only');
  const matches = mapTilesOnly ? [] : await scanForForbiddenStrings(outputDir);

  if (matches.length > 0) {
    console.error(
      '本番相当ビルドの成果物に開発用フェーズ切替 UI の痕跡が見つかりました:',
    );
    for (const match of matches) {
      console.error(`  ${match.file}: "${match.forbidden}"`);
    }
    process.exitCode = 1;
    return;
  }

  // フェーズ切替を有効にしたビルドは cookies() を読むため静的化しない
  if (
    !mapTilesOnly &&
    process.env.NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE !== 'true'
  ) {
    const manifest = JSON.parse(
      await readFile(
        path.join(__dirname, '..', '.next', 'prerender-manifest.json'),
        'utf-8',
      ),
    ) as { routes?: Record<string, unknown> };
    const missing = findMissingPrerenderedRoutes(manifest);
    if (missing.length > 0) {
      console.error(
        `本番相当ビルドで静的化されていないルート: ${missing.join(', ')}`,
      );
      process.exitCode = 1;
      return;
    }
  }

  try {
    const tileResults = await verifyMapTileArtifacts(
      path.join(__dirname, '..'),
      outputDir,
    );
    for (const result of tileResults) {
      console.log(
        `${result.profileId} tiles: ${result.built.fileCount} files, ${result.built.totalSizeBytes} bytes, manifest SHA-256 ${result.built.sha256}`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (!mapTilesOnly) {
    console.log(
      `開発用フェーズ切替 UI の痕跡は見つかりませんでした (${outputDir})`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
