import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  checkOsmDownload,
  describeDownloadFailure,
  MIN_EXPECTED_BYTES,
} from './verify-osm-download';

let dir: string | undefined;

afterEach(async () => {
  if (dir) {
    await rm(dir, { recursive: true, force: true });
    dir = undefined;
  }
});

async function writeTempFile(content: Buffer): Promise<string> {
  dir = await mkdtemp(path.join(tmpdir(), 'osm-download-test-'));
  const filePath = path.join(dir, 'file.osm.pbf');
  await writeFile(filePath, content);
  return filePath;
}

describe('checkOsmDownload', () => {
  it('PBF ヘッダーを含む大きなファイルを正常と判定する', async () => {
    const body = Buffer.concat([
      Buffer.from('OSMHeader'),
      Buffer.alloc(MIN_EXPECTED_BYTES),
    ]);
    const filePath = await writeTempFile(body);

    const result = await checkOsmDownload(filePath);

    expect(result.hasPbfMagic).toBe(true);
    expect(result.sizeBytes).toBeGreaterThanOrEqual(MIN_EXPECTED_BYTES);
    expect(describeDownloadFailure(result)).toBeNull();
  });

  it('HTML エラーページ相当の小さいファイルを異常と判定する', async () => {
    const filePath = await writeTempFile(
      Buffer.from('<html><body>Not Found</body></html>'),
    );

    const result = await checkOsmDownload(filePath);

    expect(describeDownloadFailure(result)).toMatch(/小さすぎます/);
  });

  it('サイズは十分でも PBF ヘッダーがなければ異常と判定する', async () => {
    const filePath = await writeTempFile(Buffer.alloc(MIN_EXPECTED_BYTES, 'a'));

    const result = await checkOsmDownload(filePath);

    expect(result.hasPbfMagic).toBe(false);
    expect(describeDownloadFailure(result)).toMatch(/ヘッダーが見つかりません/);
  });
});
