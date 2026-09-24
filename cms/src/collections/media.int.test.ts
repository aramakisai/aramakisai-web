import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { IMAGE_SIZES, Media } from './media';

const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

/**
 * 所有者記録の導入前から存在する画像は、作成時のフック (assignMediaOwner) を経ていないため
 * used_in_published も NULL のままである。Local API 経由の create は常に false を入れてしまう
 * ため、この状態は直接 SQL で再現するしかない。
 */
async function forceLegacyUsedInPublished(
  payload: Awaited<ReturnType<typeof import('payload').getPayload>>,
  id: number,
): Promise<void> {
  const pool = (
    payload.db as unknown as { pool: { query: (sql: string, params?: unknown[]) => Promise<unknown> } }
  ).pool;
  await pool.query('update media set used_in_published = null where id = $1', [id]);
}

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

    // 所有者なしの画像は既存メディアと同じ扱いで未認証にも読める (移行前の行を模す)
    publicDoc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'public' },
      overrideAccess: true,
    })) as { id: number };
    await forceLegacyUsedInPublished(payload, publicDoc.id);
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

  it('使用中の自分の画像を ID 指定で削除すると M-E05 で拒否される', async () => {
    await expect(
      payload.delete({
        collection: 'media',
        id: usedDoc.id,
        overrideAccess: false,
        user: await asStudent(),
      }),
    ).rejects.toThrow('公開中の企画で使用中の画像は変更・削除できません。');
  });

  it('使用中の自分の画像を where 指定の一括削除で削除すると M-E05 で拒否される', async () => {
    await expect(
      payload.delete({
        collection: 'media',
        where: { id: { equals: usedDoc.id } },
        overrideAccess: false,
        user: await asStudent(),
      }),
    ).rejects.toThrow('公開中の企画で使用中の画像は変更・削除できません。');
  });
});

describe.skipIf(!hasDatabase)('他人の画像・所有者なしの画像・実行委員の全件アクセス', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;
  let studentA: { id: number };
  let studentB: { id: number };
  let executive: { id: number };
  let mediaOfA: { id: number };
  let ownerlessDoc: { id: number };

  const suffix = String(process.pid);
  const asUser = async (id: number) =>
    (await payload.findByID({ collection: 'users', id, overrideAccess: true })) as never;

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'media-others-int-'));
    // 他ファイルと並行実行されるとファイル名 'sample.png' の重複でユニーク制約に衝突するため、ファイル名を分ける
    filePath = path.join(workdir, `others-${suffix}.png`);
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 11, g: 12, b: 13 } },
    })
      .png()
      .toFile(filePath);

    studentA = (await payload.create({
      collection: 'users',
      data: { email: `others-a-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };
    studentB = (await payload.create({
      collection: 'users',
      data: { email: `others-b-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
      overrideAccess: true,
    })) as { id: number };
    executive = (await payload.create({
      collection: 'users',
      data: { email: `others-exec-${suffix}@test.local`, password: 'test-password', role: 'executive' },
      overrideAccess: true,
    })) as { id: number };

    mediaOfA = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'owned by A' },
      overrideAccess: true,
      user: studentA as never,
    })) as { id: number };

    // 所有者なしの画像は既存メディアと同じ扱い (owner が無い既存画像を模す)
    ownerlessDoc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'ownerless' },
      overrideAccess: true,
    })) as { id: number };
    await forceLegacyUsedInPublished(payload, ownerlessDoc.id);
  });

  afterAll(async () => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    for (const id of [mediaOfA?.id, ownerlessDoc?.id]) {
      if (id) await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null);
    }
    for (const id of [studentA?.id, studentB?.id, executive?.id]) {
      if (id) await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => null);
    }
  });

  it('他人の画像は一覧に出ず、直接の読み取り・更新・削除も拒否される', async () => {
    const list = await payload.find({
      collection: 'media',
      overrideAccess: false,
      user: await asUser(studentB.id),
      pagination: false,
      depth: 0,
    });
    expect(list.docs.map((doc) => doc.id)).not.toContain(mediaOfA.id);

    await expect(
      payload.findByID({
        collection: 'media',
        id: mediaOfA.id,
        overrideAccess: false,
        user: await asUser(studentB.id),
      }),
    ).rejects.toThrow();
    await expect(
      payload.update({
        collection: 'media',
        id: mediaOfA.id,
        data: { alt: '侵入' },
        overrideAccess: false,
        user: await asUser(studentB.id),
      }),
    ).rejects.toThrow();
    await expect(
      payload.delete({
        collection: 'media',
        id: mediaOfA.id,
        overrideAccess: false,
        user: await asUser(studentB.id),
      }),
    ).rejects.toThrow();
  });

  it('所有者なしの既存画像は学生団体の一覧に出ない', async () => {
    const list = await payload.find({
      collection: 'media',
      overrideAccess: false,
      user: await asUser(studentA.id),
      pagination: false,
      depth: 0,
    });
    expect(list.docs.map((doc) => doc.id)).not.toContain(ownerlessDoc.id);
  });

  it('実行委員は所有者を問わず全件を読み書き・削除できる', async () => {
    const list = await payload.find({
      collection: 'media',
      overrideAccess: false,
      user: await asUser(executive.id),
      pagination: false,
      depth: 0,
    });
    const ids = list.docs.map((doc) => doc.id);
    expect(ids).toContain(mediaOfA.id);
    expect(ids).toContain(ownerlessDoc.id);

    const updated = await payload.update({
      collection: 'media',
      id: mediaOfA.id,
      data: { alt: '実行委員による更新' },
      overrideAccess: false,
      user: await asUser(executive.id),
    });
    expect(updated.alt).toBe('実行委員による更新');

    const forDelete = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'for exec delete' },
      overrideAccess: true,
      user: studentB as never,
    })) as { id: number };
    await payload.delete({
      collection: 'media',
      id: forDelete.id,
      overrideAccess: false,
      user: await asUser(executive.id),
    });
    await expect(
      payload.findByID({ collection: 'media', id: forDelete.id, overrideAccess: true }),
    ).rejects.toThrow();
  });
});

describe.skipIf(!hasDatabase)('所有者の消滅・ロール変更後の read access', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let workdir: string;
  let filePath: string;

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

    workdir = mkdtempSync(path.join(tmpdir(), 'media-role-int-'));
    filePath = path.join(workdir, `role-${suffix}.png`);
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 20, g: 21, b: 22 } },
    })
      .png()
      .toFile(filePath);
  });

  afterAll(() => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
  });

  it('出展者ユーザーを削除しても、owner が NULL になった未使用の下書き画像は未認証に公開されない', async () => {
    const deleted = (await payload.create({
      collection: 'users',
      data: {
        email: `deleted-owner-${suffix}@test.local`,
        password: 'test-password',
        role: 'student_exhibitor',
      },
      overrideAccess: true,
    })) as { id: number };

    const doc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'orphaned' },
      overrideAccess: true,
      user: deleted as never,
    })) as { id: number };

    await payload.delete({ collection: 'users', id: deleted.id, overrideAccess: true });

    // FK の ON DELETE SET NULL で owner が外れていること (前提の確認)
    const after = await payload.findByID({
      collection: 'media',
      id: doc.id,
      depth: 0,
      overrideAccess: true,
    });
    expect(after.owner).toBeFalsy();
    expect(after.used_in_published).toBe(false);

    const res = await serve(doc.id);
    expect(res.status).toBe(404);

    await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true }).catch(() => null);
  });

  it('出展者が実行委員へ昇格しても、未使用の下書き画像は所有者を外され未認証に公開されない', async () => {
    const promoted = (await payload.create({
      collection: 'users',
      data: {
        email: `promoted-${suffix}@test.local`,
        password: 'test-password',
        role: 'student_exhibitor',
      },
      overrideAccess: true,
    })) as { id: number };

    const doc = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'was draft' },
      overrideAccess: true,
      user: promoted as never,
    })) as { id: number };

    await payload.update({
      collection: 'users',
      id: promoted.id,
      data: { role: 'executive' },
      overrideAccess: true,
    });

    const after = await payload.findByID({
      collection: 'media',
      id: doc.id,
      depth: 0,
      overrideAccess: true,
    });
    expect(after.owner).toBeFalsy();
    expect(after.used_in_published).toBe(false);

    const res = await serve(doc.id);
    expect(res.status).toBe(404);

    await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true }).catch(() => null);
    await payload.delete({ collection: 'users', id: promoted.id, overrideAccess: true }).catch(() => null);
  });
});
