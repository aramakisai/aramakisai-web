import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FORBIDDEN_STRINGS,
  createDirectoryManifest,
  findForbiddenStringsInContent,
  findMissingPrerenderedRoutes,
  scanForForbiddenStrings,
  verifyMapTileArtifacts,
} from './verify-build-artifacts';
import { calculateMapTileBounds } from './map-tile-bounds';
import type { MapTileProfile } from '../src/lib/map-tile-profile';

const tinyProfile: MapTileProfile = {
  id: 'regional',
  bounds: [
    [36.4318, 139.0464],
    [36.43181, 139.04641],
  ],
  minZoom: 10,
  maxZoom: 10,
  minNativeZoom: 10,
  maxNativeZoom: 10,
  publicDirectory: 'public/regional-map-tiles',
  urlTemplate: '/regional-map-tiles/{z}/{x}/{y}.webp',
  expectedMaxTileCount: 10,
  expectedMaxBytes: 1_000,
};

function validWebp(): Buffer {
  const body = Buffer.alloc(30);
  body.write('RIFF', 0, 'ascii');
  body.writeUInt32LE(body.length - 8, 4);
  body.write('WEBP', 8, 'ascii');
  body.write('VP8X', 12, 'ascii');
  body.writeUInt32LE(10, 16);
  body.writeUIntLE(255, 24, 3);
  body.writeUIntLE(255, 27, 3);
  return body;
}

async function writeProfileTiles(
  root: string,
  profile: MapTileProfile,
  body = validWebp(),
): Promise<void> {
  const { zoomRanges } = calculateMapTileBounds(profile);
  for (const range of zoomRanges) {
    for (let x = range.xMin; x <= range.xMax; x++) {
      for (let y = range.yMin; y <= range.yMax; y++) {
        const dir = path.join(root, String(range.zoom), String(x));
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, `${y}.webp`), body);
      }
    }
  }
}

describe('FORBIDDEN_STRINGS', () => {
  it('is non-empty', () => {
    expect(FORBIDDEN_STRINGS.length).toBeGreaterThan(0);
  });
});

describe('findForbiddenStringsInContent', () => {
  it('returns forbidden strings present in the content', () => {
    const result = findForbiddenStringsInContent('foo bar baz', ['bar', 'qux']);
    expect(result).toEqual(['bar']);
  });

  it('returns an empty array when nothing matches', () => {
    const result = findForbiddenStringsInContent('foo', ['bar']);
    expect(result).toEqual([]);
  });
});

describe('scanForForbiddenStrings', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('detects a forbidden string in a nested file', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'verify-build-artifacts-test-'));
    await mkdir(path.join(dir, 'chunks'), { recursive: true });
    await writeFile(
      path.join(dir, 'chunks', 'app.js'),
      'const cookieName = "aramakisai_phase_override";',
    );

    const matches = await scanForForbiddenStrings(dir, [
      'aramakisai_phase_override',
    ]);

    expect(matches).toEqual([
      {
        file: path.join(dir, 'chunks', 'app.js'),
        forbidden: 'aramakisai_phase_override',
      },
    ]);
  });

  it('returns no matches when the output is clean', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'verify-build-artifacts-test-'));
    await writeFile(path.join(dir, 'app.js'), 'const x = 1;');

    const matches = await scanForForbiddenStrings(dir, [
      'aramakisai_phase_override',
    ]);

    expect(matches).toEqual([]);
  });
});

describe('findMissingPrerenderedRoutes', () => {
  it('reports required routes absent from the manifest', () => {
    expect(
      findMissingPrerenderedRoutes({ routes: { '/': {}, '/faq': {} } }),
    ).toEqual(['/topics']);
  });

  it('returns empty when all required routes are present', () => {
    expect(
      findMissingPrerenderedRoutes({
        routes: { '/': {}, '/faq': {}, '/topics': {} },
      }),
    ).toEqual([]);
  });
});

describe('createDirectoryManifest', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('returns a deterministic SHA-256 manifest with count and bytes', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'tile-manifest-test-'));
    await mkdir(path.join(dir, 'z'), { recursive: true });
    await writeFile(path.join(dir, 'z', 'b.webp'), 'two');
    await writeFile(path.join(dir, 'a.webp'), 'one');

    const first = await createDirectoryManifest(dir);
    const second = await createDirectoryManifest(dir);

    expect(first).toEqual(second);
    expect(first.fileCount).toBe(2);
    expect(first.totalSizeBytes).toBe(6);
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('verifyMapTileArtifacts', () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it('accepts complete, byte-identical source and OpenNext tile assets', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'tile-assets-test-'));
    const sourceDir = path.join(dir, tinyProfile.publicDirectory);
    const builtDir = path.join(
      dir,
      '.open-next',
      'assets',
      'regional-map-tiles',
    );
    await writeProfileTiles(sourceDir, tinyProfile);
    await writeProfileTiles(builtDir, tinyProfile);

    const [result] = await verifyMapTileArtifacts(
      dir,
      path.join(dir, '.open-next'),
      [tinyProfile],
    );

    expect(result.profileId).toBe('regional');
    expect(result.source.fileCount).toBe(result.expectedCount);
    expect(result.built).toEqual(result.source);
  });

  it('rejects a missing or changed OpenNext tile before deployment', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'tile-assets-test-'));
    const sourceDir = path.join(dir, tinyProfile.publicDirectory);
    const builtDir = path.join(
      dir,
      '.open-next',
      'assets',
      'regional-map-tiles',
    );
    await writeProfileTiles(sourceDir, tinyProfile);
    await writeProfileTiles(builtDir, tinyProfile, Buffer.from('broken'));

    await expect(
      verifyMapTileArtifacts(dir, path.join(dir, '.open-next'), [tinyProfile]),
    ).rejects.toThrow(/regional/);
  });
});
