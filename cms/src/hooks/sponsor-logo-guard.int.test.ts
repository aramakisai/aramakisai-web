import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

function hasIsolatedDatabase(): boolean {
  if (process.env.AD_SPONSOR_ISOLATED_DB !== '1' || !process.env.PAYLOAD_SECRET) return false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && url.hostname === '127.0.0.1' && Boolean(url.port)
      && url.pathname === '/advertising_sponsors_test' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function removeTestDirectory(directory: string): void {
  const realDirectory = realpathSync(directory);
  const realTemp = realpathSync(tmpdir());
  const relative = path.relative(realTemp, realDirectory);
  if (lstatSync(directory).isSymbolicLink() || relative !== path.basename(directory)
    || relative.includes(path.sep) || !relative.startsWith('ad-sponsor-media-')
    || realpathSync(path.dirname(directory)) !== realTemp) {
    throw new Error('refusing to remove a directory outside the test temp root');
  }
  rmSync(realDirectory, { recursive: true, force: true });
}

describe.skipIf(!hasIsolatedDatabase())('協賛ロゴの削除保護', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let storageDir: string;
  let inputPath: string;
  let student: { id: number };
  const sponsorIds: number[] = [];
  const mediaIds: number[] = [];
  const suffix = randomUUID();

  beforeAll(async () => {
    for (const name of ['S3_BUCKET', 'DATABASE_REPLICA_URL', 'SMTP_HOST', 'SIGNAGE_NOTIFY_URL']) vi.stubEnv(name, '');
    storageDir = mkdtempSync(path.join(tmpdir(), 'ad-sponsor-media-'));
    inputPath = path.join(storageDir, `input-${suffix}.png`);
    const sharp = (await import('sharp')).default;
    await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#112233' } }).png().toFile(inputPath);
    const config = await (await import('../payload.config')).default;
    const media = config.collections.find((collection) => collection.slug === 'media');
    if (!media?.upload) throw new Error('media upload configuration missing');
    media.upload.staticDir = storageDir;
    payload = await (await import('payload')).getPayload({ config: Promise.resolve(config) });
    student = await payload.create({
      collection: 'users',
      data: { email: `logo-test-${suffix}@example.invalid`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    });
  });

  afterAll(async () => {
    const errors: unknown[] = [];
    async function remove(operation: () => Promise<unknown>) {
      try {
        await operation();
      } catch (error) {
        if (!(error && typeof error === 'object' && 'status' in error && error.status === 404)) errors.push(error);
      }
    }
    try {
      if (payload) {
        for (const id of sponsorIds) await remove(() => payload.delete({ collection: 'sponsors', id, overrideAccess: true }));
        for (const id of mediaIds) await remove(() => payload.delete({ collection: 'media', id, overrideAccess: true }));
        if (student) await remove(() => payload.delete({ collection: 'users', id: student.id, overrideAccess: true }));
      }
    } finally {
      try {
        if (storageDir) removeTestDirectory(storageDir);
      } catch (error) {
        errors.push(error);
      } finally {
        vi.unstubAllEnvs();
      }
    }
    if (errors.length) throw new AggregateError(errors, 'test fixture cleanup failed');
  });

  async function createMedia() {
    const doc = await payload.create({
      collection: 'media', filePath: inputPath, data: { alt: suffix },
      overrideAccess: true, user: student as never,
    });
    mediaIds.push(doc.id);
    return doc;
  }

  async function sponsor(mediaId: number, type: 'ad' | 'other') {
    const doc = await payload.create({
      collection: 'sponsors',
      data: { name: `logo-test-${suffix}`, type: [type], logo: mediaId, ...(type === 'ad' ? { tier: 'planA' as const } : {}) },
      overrideAccess: true,
    });
    sponsorIds.push(doc.id);
  }

  function files(doc: Awaited<ReturnType<typeof createMedia>>) {
    const names = [doc.filename, doc.sizes?.hero?.filename, doc.sizes?.card?.filename];
    expect(names.every(Boolean)).toBe(true);
    return names.map((name) => path.join(storageDir, name!));
  }

  it.each(['ad', 'other'] as const)('%s の参照中画像を Local API の単体削除で拒否し、元画像・派生画像を保持する', async (type) => {
    const doc = await createMedia();
    await sponsor(doc.id, type);
    const paths = files(doc);
    expect(paths.every(existsSync)).toBe(true);
    await expect(payload.delete({ collection: 'media', id: doc.id, overrideAccess: true })).rejects.toMatchObject({ status: 400 });
    expect(paths.every(existsSync)).toBe(true);
    expect((await payload.findByID({ collection: 'media', id: doc.id, overrideAccess: true })).id).toBe(doc.id);
  });

  it('未参照画像は単体削除でき、元画像・派生画像も削除される', async () => {
    const doc = await createMedia();
    const paths = files(doc);
    await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true });
    expect(paths.every((file) => !existsSync(file))).toBe(true);
    await expect(payload.findByID({ collection: 'media', id: doc.id, overrideAccess: true })).rejects.toMatchObject({ status: 404 });
  });

  it('一括削除では参照中だけ失敗し、未参照画像とそのファイルは削除する', async () => {
    const used = await createMedia();
    const unused = await createMedia();
    await sponsor(used.id, 'ad');
    const usedFiles = files(used);
    const unusedFiles = files(unused);
    const result = await payload.delete({
      collection: 'media', where: { id: { in: [used.id, unused.id] } }, overrideAccess: true,
    });
    expect(result.docs.map((doc) => doc.id)).toEqual([unused.id]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].id).toBe(used.id);
    expect(usedFiles.every(existsSync)).toBe(true);
    expect(unusedFiles.every((file) => !existsSync(file))).toBe(true);
  });

  it('スポンサーの書込権限がない画像所有者でも参照中画像を削除できない', async () => {
    const doc = await createMedia();
    await sponsor(doc.id, 'other');
    const user = await payload.findByID({ collection: 'users', id: student.id, overrideAccess: true });
    await expect(payload.delete({
      collection: 'media', id: doc.id, overrideAccess: false, user: user as never,
    })).rejects.toMatchObject({ status: 400 });
    expect(files(doc).every(existsSync)).toBe(true);
  });
});
