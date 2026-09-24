import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { StudentExhibition } from '../payload-types';
import { collectImageIds, syncMediaPublication } from './media-publication';

describe('collectImageIds', () => {
  it('4 カテゴリの images から画像 ID を重複無く集める', () => {
    const ids = collectImageIds({
      stage: { images: [1, 2] },
      exhibit: { images: [2, { id: 3 } as never] },
      vendor: { images: [{ id: 4 } as never] },
      other: {},
    } as Partial<StudentExhibition>);
    expect([...ids].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('doc が無ければ空配列を返す', () => {
    expect(collectImageIds(null)).toEqual([]);
    expect(collectImageIds(undefined)).toEqual([]);
  });
});

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('syncMediaPublication', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;
  let owner: { id: number };
  let mediaA: { id: number };
  let mediaB: { id: number };
  let exhibition: { id: number };

  const suffix = String(process.pid);

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-publication-int-'));
    filePath = path.join(workdir, 'sample.png');
    await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 5, g: 6, b: 7 } },
    })
      .png()
      .toFile(filePath);

    owner = (await payload.create({
      collection: 'users',
      data: { email: `sync-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };

    const createMedia = async () =>
      (await payload.create({
        collection: 'media',
        filePath,
        data: { alt: `sync-${suffix}` },
        overrideAccess: true,
        user: owner as never,
      })) as { id: number };

    mediaA = await createMedia();
    mediaB = await createMedia();

    // 公開中の企画から exhibit.images で mediaA だけを参照する
    exhibition = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: owner.id,
        organization_name: `sync-${suffix}`,
        status: 'published',
        categories: ['exhibit'],
        exhibit: { name: `sync-${suffix}`, images: [mediaA.id] },
      },
      overrideAccess: true,
    })) as { id: number };
  });

  afterAll(async () => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    if (exhibition?.id) {
      await payload
        .delete({ collection: 'student_exhibitions', id: exhibition.id, overrideAccess: true })
        .catch(() => null);
    }
    for (const id of [mediaA?.id, mediaB?.id]) {
      if (id) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null);
    }
    if (owner?.id) {
      await payload.delete({ collection: 'users', id: owner.id, overrideAccess: true }).catch(() => null);
    }
  });

  it('公開中の企画から参照される画像だけが使用中になる', async () => {
    const { createLocalReq } = await import('payload');
    const req = await createLocalReq({}, payload);

    await syncMediaPublication(req, [mediaA.id, mediaB.id]);

    const [a, b] = await Promise.all([
      payload.findByID({ collection: 'media', id: mediaA.id, depth: 0, overrideAccess: true }),
      payload.findByID({ collection: 'media', id: mediaB.id, depth: 0, overrideAccess: true }),
    ]);
    expect(a.used_in_published).toBe(true);
    expect(b.used_in_published).toBe(false);
  });

  it('下書きに戻すと使用していない状態に戻る (何度実行しても同じ結果になる)', async () => {
    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition.id,
      data: { status: 'draft' },
      overrideAccess: true,
    });

    const { createLocalReq } = await import('payload');
    const req = await createLocalReq({}, payload);
    await syncMediaPublication(req, [mediaA.id]);
    await syncMediaPublication(req, [mediaA.id]);

    const a = await payload.findByID({
      collection: 'media',
      id: mediaA.id,
      depth: 0,
      overrideAccess: true,
    });
    expect(a.used_in_published).toBe(false);
  });
});
