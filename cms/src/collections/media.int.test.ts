import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IMAGE_SIZES, Media } from './media';

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

describe.skipIf(!hasDatabase)('配信エンドポイントの read access', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;
  let student: { id: number };
  let privateDoc: { id: number };
  let publicDoc: { id: number };

  const suffix = String(process.pid);
  const serve = async (id: number) => {
    const { createLocalReq } = await import('payload');
    const req = await createLocalReq({}, payload);
    Object.assign(req, { routeParams: { id: String(id), size: 'original' } });
    const endpoints = Media.endpoints;
    if (!endpoints) throw new Error('Media.endpoints is not defined');
    return endpoints[0].handler(req) as Promise<Response>;
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-serve-int-'));
    filePath = path.join(workdir, 'sample.png');
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toFile(filePath);

    student = (await payload.create({
      collection: 'users',
      data: { email: `serve-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };

    // 所有者ありで未使用 (公開企画で使っていない) の画像は、本人以外に read access が無い
    privateDoc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'private' },
      overrideAccess: true,
      user: student as never,
    })) as { id: number };

    // 所有者なしの画像は既存メディアと同じ扱いで未認証にも読める
    publicDoc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'public' },
      overrideAccess: true,
    })) as { id: number };
  });

  afterAll(async () => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    for (const id of [privateDoc?.id, publicDoc?.id]) {
      if (id) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null);
    }
    if (student?.id) {
      await payload.delete({ collection: 'users', id: student.id, overrideAccess: true }).catch(() => null);
    }
  });

  it('read access の外にあるメディアは 404 になる', async () => {
    const res = await serve(privateDoc.id);
    expect(res.status).toBe(404);
  });

  it('read access の範囲内のメディアはリダイレクトされる', async () => {
    const res = await serve(publicDoc.id);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBeTruthy();
  });
});

describe.skipIf(!hasDatabase)('メディアの所有者記録と使用中画像の保護', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;
  let student: { id: number };
  let usedDoc: { id: number };
  let unusedDoc: { id: number };

  const suffix = String(process.pid);
  const asStudent = async () =>
    (await payload.findByID({ collection: 'users', id: student.id, overrideAccess: true })) as never;

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-guard-int-'));
    filePath = path.join(workdir, 'sample.png');
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 8, g: 9, b: 10 } },
    })
      .png()
      .toFile(filePath);

    student = (await payload.create({
      collection: 'users',
      data: { email: `guard-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };

    usedDoc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'used' },
      overrideAccess: true,
      user: student as never,
    })) as { id: number };
    // used_in_published は media-publication の同期処理だけが書く値のため、テストでは overrideAccess で直接立てる
    await payload.update({
      collection: 'media',
      id: usedDoc.id,
      data: { used_in_published: true },
      overrideAccess: true,
    });

    unusedDoc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'unused' },
      overrideAccess: true,
      user: student as never,
    })) as { id: number };
  });

  afterAll(async () => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    for (const id of [usedDoc?.id, unusedDoc?.id]) {
      if (id) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null);
    }
    if (student?.id) {
      await payload.delete({ collection: 'users', id: student.id, overrideAccess: true }).catch(() => null);
    }
  });

  it('アップロード時にアップロードしたユーザーが所有者として記録される', async () => {
    const doc = await payload.findByID({ collection: 'media', id: unusedDoc.id, depth: 0, overrideAccess: true });
    expect(doc.owner).toBe(student.id);
    expect(doc.used_in_published).toBe(false);
  });

  it('使用中の自分の画像を ID 指定で更新すると M-E05 で拒否される', async () => {
    await expect(
      payload.update({
        collection: 'media',
        id: usedDoc.id,
        data: { alt: '差し替え' },
        overrideAccess: false,
        user: await asStudent(),
      }),
    ).rejects.toThrow('公開中の企画で使用中の画像は変更・削除できません。');
  });

  it('使用中の自分の画像を where 指定の一括更新で更新すると M-E05 で拒否される', async () => {
    await expect(
      payload.update({
        collection: 'media',
        where: { id: { equals: usedDoc.id } },
        data: { alt: '一括差し替え' },
        overrideAccess: false,
        user: await asStudent(),
      }),
    ).rejects.toThrow('公開中の企画で使用中の画像は変更・削除できません。');
  });

  it('使用中でない自分の画像は更新できる', async () => {
    const updated = await payload.update({
      collection: 'media',
      id: unusedDoc.id,
      data: { alt: '更新後' },
      overrideAccess: false,
      user: await asStudent(),
    });
    expect(updated.alt).toBe('更新後');
  });
});
