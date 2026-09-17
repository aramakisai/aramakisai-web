import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IMAGE_SIZES } from './media';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('メディアのアップロード時最適化', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-int-'));
    filePath = path.join(workdir, 'sample.png');
    await sharp({
      create: { width: 2400, height: 1600, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toFile(filePath);
  });

  afterAll(() => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
  });

  it('WebP へ変換し、定義した用途別サイズをすべて生成する', async () => {
    const doc = await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'size check' },
      overrideAccess: true,
    });

    try {
      expect(doc.mimeType).toBe('image/webp');
      for (const { name, width } of IMAGE_SIZES) {
        const size = doc.sizes?.[name];
        expect(size?.width, `${name} が生成されていない`).toBe(width);
        expect(size?.mimeType).toBe('image/webp');
      }
    } finally {
      await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true });
    }
  });
});
