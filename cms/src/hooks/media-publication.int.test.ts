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
    filePath = path.join(workdir, `sample-${process.pid}.png`);
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

// 8.1: 企画の保存・削除が自動で再計算を起こすことを、syncMediaPublication を直接呼ばずに確認する
describe.skipIf(!hasDatabase)('student_exhibitions の afterChange/afterDelete からの結線', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;
  let owner: { id: number };
  let media: { id: number };
  let exhibition: { id: number } | undefined;

  const suffix = `wire-${process.pid}`;

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-publication-wire-int-'));
    filePath = path.join(workdir, `sample-${process.pid}.png`);
    await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toFile(filePath);

    owner = (await payload.create({
      collection: 'users',
      data: { email: `${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };

    media = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: suffix },
      overrideAccess: true,
      user: owner as never,
    })) as { id: number };
  });

  afterAll(async () => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    if (exhibition?.id) {
      await payload
        .delete({ collection: 'student_exhibitions', id: exhibition.id, overrideAccess: true })
        .catch(() => null);
    }
    if (media?.id) {
      await payload.delete({ collection: 'media', id: media.id, overrideAccess: true }).catch(() => null);
    }
    if (owner?.id) {
      await payload.delete({ collection: 'users', id: owner.id, overrideAccess: true }).catch(() => null);
    }
  });

  it('公開すると参照される画像が使用中になり、下書きに戻すと使用していない状態に戻る', async () => {
    exhibition = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: owner.id,
        organization_name: suffix,
        status: 'draft',
        categories: ['exhibit'],
        exhibit: { name: suffix, images: [media.id] },
      },
      overrideAccess: true,
    })) as { id: number };

    // 下書きで作成した直後は使用中にならない
    let found = await payload.findByID({ collection: 'media', id: media.id, depth: 0, overrideAccess: true });
    expect(found.used_in_published).toBe(false);

    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition.id,
      data: { status: 'published' },
      overrideAccess: true,
    });
    found = await payload.findByID({ collection: 'media', id: media.id, depth: 0, overrideAccess: true });
    expect(found.used_in_published).toBe(true);

    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition.id,
      data: { status: 'draft' },
      overrideAccess: true,
    });
    found = await payload.findByID({ collection: 'media', id: media.id, depth: 0, overrideAccess: true });
    expect(found.used_in_published).toBe(false);

    // owner に 1 企画までの制約があるため、次のテストの前に片付ける
    await payload.delete({ collection: 'student_exhibitions', id: exhibition.id, overrideAccess: true });
    exhibition = undefined;
  });

  it('公開中の企画を削除すると、参照していた画像が使用していない状態に戻る', async () => {
    exhibition = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: owner.id,
        organization_name: suffix,
        status: 'published',
        categories: ['exhibit'],
        exhibit: { name: suffix, images: [media.id] },
      },
      overrideAccess: true,
    })) as { id: number };

    let found = await payload.findByID({ collection: 'media', id: media.id, depth: 0, overrideAccess: true });
    expect(found.used_in_published).toBe(true);

    await payload.delete({ collection: 'student_exhibitions', id: exhibition.id, overrideAccess: true });
    exhibition = undefined;

    found = await payload.findByID({ collection: 'media', id: media.id, depth: 0, overrideAccess: true });
    expect(found.used_in_published).toBe(false);
  });
});

// 8.3: used_in_published のフラグだけでなく、未認証リクエストの実際の read access が連動することを確認する
describe.skipIf(!hasDatabase)('公開状態と未認証の read access の連動', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;
  let owner: { id: number };
  let mediaA: { id: number };
  let mediaB: { id: number };
  let exhibition: { id: number } | undefined;

  const suffix = `readaccess-${process.pid}`;

  const canReadUnauthenticated = async (id: number) => {
    const found = await payload
      .findByID({ collection: 'media', id, depth: 0, overrideAccess: false })
      .catch(() => null);
    return found !== null;
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-publication-readaccess-int-'));
    // 他ファイルと並行実行されるとファイル名 'sample.png' の重複でユニーク制約に衝突するため、ファイル名を分ける
    filePath = path.join(workdir, `${suffix}.png`);
    await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 4, g: 5, b: 6 } },
    })
      .png()
      .toFile(filePath);

    owner = (await payload.create({
      collection: 'users',
      data: { email: `${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };

    const createMedia = async () =>
      (await payload.create({
        collection: 'media',
        filePath,
        data: { alt: suffix },
        overrideAccess: true,
        user: owner as never,
      })) as { id: number };

    mediaA = await createMedia();
    mediaB = await createMedia();
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

  it('企画の公開で学生団体の画像が未認証に読めるようになり、下書きに戻すと読めなくなる', async () => {
    exhibition = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: owner.id,
        organization_name: suffix,
        status: 'draft',
        categories: ['exhibit'],
        exhibit: { name: suffix, images: [mediaA.id] },
      },
      overrideAccess: true,
    })) as { id: number };

    expect(await canReadUnauthenticated(mediaA.id)).toBe(false);

    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition.id,
      data: { status: 'published' },
      overrideAccess: true,
    });
    expect(await canReadUnauthenticated(mediaA.id)).toBe(true);

    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition.id,
      data: { status: 'draft' },
      overrideAccess: true,
    });
    expect(await canReadUnauthenticated(mediaA.id)).toBe(false);
  });

  it('公開中の差し替えで、外れた画像は使用していない状態に戻り読めなくなる', async () => {
    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition!.id,
      data: { status: 'published', exhibit: { name: suffix, images: [mediaA.id] } },
      overrideAccess: true,
    });
    expect(await canReadUnauthenticated(mediaA.id)).toBe(true);
    expect(await canReadUnauthenticated(mediaB.id)).toBe(false);

    // 公開状態のまま参照先を mediaA → mediaB に差し替える
    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition!.id,
      data: { exhibit: { name: suffix, images: [mediaB.id] } },
      overrideAccess: true,
    });

    expect(await canReadUnauthenticated(mediaA.id)).toBe(false);
    expect(await canReadUnauthenticated(mediaB.id)).toBe(true);

    await payload.update({
      collection: 'student_exhibitions',
      id: exhibition!.id,
      data: { status: 'draft' },
      overrideAccess: true,
    });
  });
});

// 8.3: 学生団体が他人の画像 ID を自分の企画に保存すると M-E17 になることを確認する
describe.skipIf(!hasDatabase)('他人の画像を企画に指定すると拒否される (M-E17)', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;
  let studentA: { id: number };
  let studentB: { id: number };
  let mediaOfA: { id: number };
  let mediaOfB: { id: number };
  let exhibitionOfA: { id: number };

  const suffix = `ownership-${process.pid}`;

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-publication-ownership-int-'));
    // 他ファイルと並行実行されるとファイル名 'sample.png' の重複でユニーク制約に衝突するため、ファイル名を分ける
    filePath = path.join(workdir, `${suffix}.png`);
    await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 7, g: 8, b: 9 } },
    })
      .png()
      .toFile(filePath);

    studentA = (await payload.create({
      collection: 'users',
      data: { email: `a-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };
    studentB = (await payload.create({
      collection: 'users',
      data: { email: `b-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };

    const createMedia = async (user: { id: number }) =>
      (await payload.create({
        collection: 'media',
        filePath,
        data: { alt: suffix },
        overrideAccess: true,
        user: user as never,
      })) as { id: number };

    mediaOfA = await createMedia(studentA);
    mediaOfB = await createMedia(studentB);

    exhibitionOfA = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: studentA.id,
        organization_name: suffix,
        status: 'draft',
        categories: ['exhibit'],
        exhibit: { name: suffix, images: [mediaOfA.id] },
      },
      overrideAccess: true,
    })) as { id: number };
  });

  afterAll(async () => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    if (exhibitionOfA?.id) {
      await payload
        .delete({ collection: 'student_exhibitions', id: exhibitionOfA.id, overrideAccess: true })
        .catch(() => null);
    }
    for (const id of [mediaOfA?.id, mediaOfB?.id]) {
      if (id) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null);
    }
    for (const id of [studentA?.id, studentB?.id]) {
      if (id) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => null);
    }
  });

  it('他人の画像 ID を自分の企画に保存すると M-E17 になる', async () => {
    let error: unknown;
    try {
      await payload.update({
        collection: 'student_exhibitions',
        id: exhibitionOfA.id,
        data: { exhibit: { name: suffix, images: [mediaOfB.id] } },
        overrideAccess: false,
        user: studentA as never,
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(Error);
    const violations = (error as { data?: { errors?: { path: string; message: string }[] } }).data?.errors ?? [];
    expect(violations).toContainEqual({
      path: 'exhibit.images',
      message: '【仮】自分がアップロードした画像だけを選べます。',
    });
  });

  it('自分の画像 ID への差し替えは通る', async () => {
    const updated = await payload.update({
      collection: 'student_exhibitions',
      id: exhibitionOfA.id,
      data: { exhibit: { name: suffix, images: [mediaOfA.id] } },
      overrideAccess: false,
      user: studentA as never,
    });
    expect((updated.exhibit as { images: unknown[] }).images).toHaveLength(1);
  });
});
