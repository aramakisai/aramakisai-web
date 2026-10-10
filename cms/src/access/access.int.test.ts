import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('学生団体ロールの access control', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let owner: { id: number };
  let other: { id: number };
  let fresh: { id: number };
  let publishedOwner: { id: number };
  let executive: { id: number };
  let assignee1: { id: number };
  let assignee2: { id: number };
  let ownRecord: { id: number };
  let otherRecord: { id: number };
  let publishedRecord: { id: number };
  let assign1Record: number | undefined;
  let assign2Record: number | undefined;
  let image: { id: number };
  let parkingLot: { id: number };
  let parkingStatus: { id: number };
  let workdir: string;

  const ownerIdOf = (value: unknown) =>
    typeof value === 'object' && value !== null ? (value as { id: number }).id : value;

  const suffix = String(process.pid);

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const sharp = (await import('sharp')).default;
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    workdir = mkdtempSync(path.join(tmpdir(), 'access-int-'));
    // 他の結合テストファイルと同じ worker (pid 共有) で並行実行されても、アップロード先の
    // filename が衝突しないよう他ファイルと異なる接頭辞にする
    const filePath = path.join(workdir, `access-int-${suffix}.png`);
    await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .png()
      .toFile(filePath);
    image = (await payload.create({
      collection: 'media',
      filePath,
      data: { alt: 'test' },
      overrideAccess: true,
    })) as { id: number };

    const createUser = async (email: string, role: 'student_exhibitor' | 'executive') =>
      (await payload.create({
        collection: 'users',
        data: { email, password: 'test-password', role },
        overrideAccess: true,
      })) as { id: number };

    owner = await createUser(`owner-${suffix}@test.local`, 'student_exhibitor');
    other = await createUser(`other-${suffix}@test.local`, 'student_exhibitor');
    fresh = await createUser(`fresh-${suffix}@test.local`, 'student_exhibitor');
    publishedOwner = await createUser(`published-${suffix}@test.local`, 'student_exhibitor');
    executive = await createUser(`executive-${suffix}@test.local`, 'executive');
    assignee1 = await createUser(`assignee1-${suffix}@test.local`, 'student_exhibitor');
    assignee2 = await createUser(`assignee2-${suffix}@test.local`, 'student_exhibitor');

    // 学生団体の必須項目チェック (M-E?) を満たす完全なデータで作成する。不完全な状態は
    // 各テストが個別に data で欠損させて検証するため、フィクスチャは常に完全にしておく。
    const createExhibition = async (ownerId: number, name: string, status: 'draft' | 'published') =>
      (await payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: ownerId,
          organization_name: name,
          categories: ['other'],
          other: { name, description: `${name}の紹介文`, images: [image.id], open_days: ['2026-11-01T12:00:00.000Z'] },
          status,
        },
        overrideAccess: true,
      })) as { id: number };

    ownRecord = await createExhibition(owner.id, `own-${suffix}`, 'draft');
    otherRecord = await createExhibition(other.id, `other-${suffix}`, 'draft');
    publishedRecord = await createExhibition(publishedOwner.id, `published-${suffix}`, 'published');
    parkingLot = (await payload.create({
      collection: 'parking_lots',
      data: { name: `parking-${suffix}` },
      overrideAccess: true,
    })) as { id: number };
    parkingStatus = (
      await payload.find({
        collection: 'parking_statuses',
        where: { lot: { equals: parkingLot.id } },
        overrideAccess: true,
      })
    ).docs[0] as { id: number };
    await payload.update({
      collection: 'parking_statuses',
      id: parkingStatus.id,
      data: { status: 'available' },
      overrideAccess: true,
    });
  });

  afterAll(async () => {
    if (workdir) rmSync(workdir, { recursive: true, force: true });
    if (!payload) return;
    for (const id of [ownRecord?.id, otherRecord?.id, publishedRecord?.id, assign1Record, assign2Record]) {
      if (id) {
        await payload
          .delete({ collection: 'student_exhibitions', id, overrideAccess: true })
          .catch(() => null);
      }
    }
    for (const id of [owner?.id, other?.id, fresh?.id, publishedOwner?.id, executive?.id, assignee1?.id, assignee2?.id]) {
      if (id) {
        await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => null);
      }
    }
    if (parkingLot?.id) {
      await payload
        .delete({ collection: 'parking_lots', id: parkingLot.id, overrideAccess: true })
        .catch(() => null);
    }
    if (image?.id) {
      await payload.delete({ collection: 'media', id: image.id, overrideAccess: true }).catch(() => null);
    }
  });

  async function asUser(id: number) {
    return (await payload.findByID({
      collection: 'users',
      id,
      overrideAccess: true,
    })) as never;
  }

  async function asOwner() {
    return asUser(owner.id);
  }

  describe('学生企画', () => {
    it('一覧・件数には自分のレコードだけが含まれる', async () => {
      const user = await asOwner();
      const result = await payload.find({
        collection: 'student_exhibitions',
        overrideAccess: false,
        user,
        pagination: false,
        depth: 0,
      });
      const ids = result.docs.map((doc) => doc.id);
      expect(ids).toContain(ownRecord.id);
      expect(ids).not.toContain(otherRecord.id);

      const { totalDocs } = await payload.count({
        collection: 'student_exhibitions',
        overrideAccess: false,
        user,
      });
      expect(totalDocs).toBe(1);
    });

    it('他団体のレコードを ID 指定で直接読み取れない', async () => {
      await expect(
        payload.findByID({
          collection: 'student_exhibitions',
          id: otherRecord.id,
          overrideAccess: false,
          user: await asOwner(),
        }),
      ).rejects.toThrow();
    });

    it('下書き状態の自分のレコードを更新できる', async () => {
      const updated = await payload.update({
        collection: 'student_exhibitions',
        id: ownRecord.id,
        data: { other: { description: '更新後' } },
        overrideAccess: false,
        user: await asOwner(),
      });
      expect((updated.other as { description: string }).description).toBe('更新後');
    });

    it('公開済みの自分のレコードを保存しようとすると M-E01 で拒否される', async () => {
      await expect(
        payload.update({
          collection: 'student_exhibitions',
          id: publishedRecord.id,
          data: { other: { description: '侵入' } },
          overrideAccess: false,
          user: await asUser(publishedOwner.id),
        }),
      ).rejects.toThrow('公開中の企画のため、修正は実行委員に依頼してください。');
    });

    it('他団体のレコードを更新しようとすると拒否される', async () => {
      await expect(
        payload.update({
          collection: 'student_exhibitions',
          id: otherRecord.id,
          data: { other: { description: '侵入' } },
          overrideAccess: false,
          user: await asOwner(),
        }),
      ).rejects.toThrow();
    });

    it('割当 (エリア・ブース番号・マップ表示ラベル) と公開状態を変える保存は反映されない', async () => {
      const before = await payload.findByID({
        collection: 'student_exhibitions',
        id: ownRecord.id,
        overrideAccess: true,
        depth: 0,
      });

      const updated = await payload.update({
        collection: 'student_exhibitions',
        id: ownRecord.id,
        data: {
          other: { booth_number: 999, booth_label: '書き換え後' },
          status: 'published',
        } as never,
        overrideAccess: false,
        user: await asOwner(),
      });

      expect(updated.other?.booth_number).toBe(before.other?.booth_number);
      expect(updated.other?.booth_label).toBe(before.other?.booth_label);
      expect(updated.status).toBe('draft');
    });

    it('学生団体による新規作成は拒否される', async () => {
      await expect(
        payload.create({
          collection: 'student_exhibitions',
          data: {
            organization_name: `self-${suffix}`,
            categories: ['other'],
            other: { name: `self-${suffix}` },
            status: 'draft',
          } as never,
          overrideAccess: false,
          user: await asUser(fresh.id),
        }),
      ).rejects.toThrow();
    });

    it('許可されていないコレクションへの書き込みは権限エラーになる', async () => {
      await expect(
        payload.create({
          collection: 'announcements',
          data: { title: '侵入' },
          overrideAccess: false,
          user: await asOwner(),
        }),
      ).rejects.toThrow();
    });

    it('実行委員の所有者指定作成は Local API・REST 相当のどちらも指定どおりの値で保存され、重複は同じエラーになる', async () => {
      const executiveUser = await asUser(executive.id);

      const created1 = (await payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: assignee1.id,
          organization_name: `assign1-${suffix}`,
          categories: ['other'],
          other: {
            name: `assign1-${suffix}`,
            open_days: ['2026-11-01T12:00:00.000Z'],
            booth_number: 101,
            booth_label: `label1-${suffix}`,
          },
          status: 'draft',
        },
        overrideAccess: true,
      })) as { id: number; owner: unknown; other: { booth_number: number; booth_label: string } };
      assign1Record = created1.id;

      const created2 = (await payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: assignee2.id,
          organization_name: `assign2-${suffix}`,
          categories: ['other'],
          other: {
            name: `assign2-${suffix}`,
            open_days: ['2026-11-01T12:00:00.000Z'],
            booth_number: 101,
            booth_label: `label1-${suffix}`,
          },
          status: 'draft',
        } as never,
        overrideAccess: false,
        user: executiveUser,
      })) as { id: number; owner: unknown; other: { booth_number: number; booth_label: string } };
      assign2Record = created2.id;

      // 同じ値で保存される (owner はそれぞれの指定どおり、他の指定値は経路によらず同じ)
      expect(ownerIdOf(created1.owner)).toBe(assignee1.id);
      expect(ownerIdOf(created2.owner)).toBe(assignee2.id);
      expect(created1.other.booth_number).toBe(created2.other.booth_number);
      expect(created1.other.booth_label).toBe(created2.other.booth_label);

      // 重複 owner はどちらの経路でも同じ M-E02 エラーになる
      const localDuplicate = await payload
        .create({
          collection: 'student_exhibitions',
          data: {
            owner: assignee1.id,
            organization_name: `assign1-dup-${suffix}`,
            categories: ['other'],
            other: { name: `assign1-dup-${suffix}`, open_days: ['2026-11-01T12:00:00.000Z'] },
            status: 'draft',
          },
          overrideAccess: true,
        })
        .catch((error: unknown) => error);

      const restDuplicate = await payload
        .create({
          collection: 'student_exhibitions',
          data: {
            owner: assignee2.id,
            organization_name: `assign2-dup-${suffix}`,
            categories: ['other'],
            other: { name: `assign2-dup-${suffix}` },
            status: 'draft',
          } as never,
          overrideAccess: false,
          user: executiveUser,
        })
        .catch((error: unknown) => error);

      for (const error of [localDuplicate, restDuplicate]) {
        expect(error).toBeInstanceOf(Error);
        const data = (error as { data?: { errors?: { path: string; message: string }[] } }).data;
        expect(data?.errors?.[0]?.path).toBe('owner');
        expect(data?.errors?.[0]?.message).toMatch(/^.+は既に.+の所有者です。$/);
      }
    });

    it('実行委員は owner・categories・出店日だけで作成できる (団体名・企画内容は必須にしない)', async () => {
      const minimalOwner = (await payload.create({
        collection: 'users',
        data: { email: `minimal-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
        overrideAccess: true,
      })) as { id: number };
      const created = (await payload.create({
        collection: 'student_exhibitions',
        data: { owner: minimalOwner.id, categories: ['other'], other: { open_days: ['2026-11-01T12:00:00.000Z'] } } as never,
        overrideAccess: false,
        user: await asUser(executive.id),
      })) as { id: number; owner: unknown };

      expect(ownerIdOf(created.owner)).toBe(minimalOwner.id);
      await payload.delete({ collection: 'student_exhibitions', id: created.id, overrideAccess: true });
      await payload.delete({ collection: 'users', id: minimalOwner.id, overrideAccess: true });
    });

    it('学生団体は団体名・企画名・紹介文・画像のいずれかが欠けていると保存できない', async () => {
      const self = await asOwner();
      const violationOf = async (data: Record<string, unknown>) => {
        const error = (await payload
          .update({ collection: 'student_exhibitions', id: ownRecord.id, data, overrideAccess: false, user: self })
          .catch((e: unknown) => e)) as {
          data?: { errors?: { path: string; message: string }[] };
        };
        return error.data?.errors ?? [];
      };

      expect(await violationOf({ organization_name: '' })).toContainEqual({
        path: 'organization_name',
        message: '団体名の入力が必要',
      });
      expect(await violationOf({ other: { name: '' } })).toContainEqual({
        path: 'other.name',
        message: 'その他を選択した場合は企画名の入力が必要',
      });
      expect(await violationOf({ other: { description: '' } })).toContainEqual({
        path: 'other.description',
        message: 'その他を選択した場合は紹介文の入力が必要',
      });
      expect(await violationOf({ other: { images: [] } })).toContainEqual({
        path: 'other.images',
        message: 'その他を選択した場合は画像が1枚以上必要',
      });
    });

    it('実行委員が内容空のまま published にすると保存できない', async () => {
      await expect(
        payload.update({
          collection: 'student_exhibitions',
          id: otherRecord.id,
          data: { organization_name: '', other: { description: '' }, status: 'published' },
          overrideAccess: false,
          user: await asUser(executive.id),
        }),
      ).rejects.toThrow();
    });

    it('学生団体は categories を変更できない (executiveOnlyField)', async () => {
      const updated = await payload.update({
        collection: 'student_exhibitions',
        id: ownRecord.id,
        data: { categories: ['stage'] },
        overrideAccess: false,
        user: await asOwner(),
      });
      expect(updated.categories).toEqual(['other']);
    });
  });

  describe('users', () => {
    it('本人のレコードを read/update できる', async () => {
      const self = await asOwner();
      const found = await payload.findByID({
        collection: 'users',
        id: owner.id,
        overrideAccess: false,
        user: self,
      });
      expect(found.id).toBe(owner.id);

      const updated = await payload.update({
        collection: 'users',
        id: owner.id,
        data: { password: 'updated-password' },
        overrideAccess: false,
        user: self,
      });
      expect(updated.id).toBe(owner.id);
    });

    it('自分の role・email を変更する保存は反映されない', async () => {
      const self = await asOwner();
      const updated = await payload.update({
        collection: 'users',
        id: owner.id,
        data: { role: 'executive', email: `hijacked-${suffix}@test.local` },
        overrideAccess: false,
        user: self,
      });
      expect(updated.role).toBe('student_exhibitor');
      expect(updated.email).toBe(`owner-${suffix}@test.local`);
    });

    it('他人のレコードを read/update できない', async () => {
      const self = await asOwner();
      await expect(
        payload.findByID({ collection: 'users', id: other.id, overrideAccess: false, user: self }),
      ).rejects.toThrow();
      await expect(
        payload.update({
          collection: 'users',
          id: other.id,
          data: { password: 'stolen-password' },
          overrideAccess: false,
          user: self,
        }),
      ).rejects.toThrow();
    });

    it('学生団体によるユーザー作成は拒否される', async () => {
      await expect(
        payload.create({
          collection: 'users',
          data: { email: `intruder-${suffix}@test.local`, password: 'test-password', role: 'student_exhibitor' },
          overrideAccess: false,
          user: await asOwner(),
        }),
      ).rejects.toThrow();
    });
  });

  describe('サイネージ', () => {
    it('サイネージ設定は未認証で読め、学生団体は更新できず、固定対象のスライド削除で参照が空になる', async () => {
      const slide = await payload.create({
        collection: 'signage_slides',
        data: { kind: 'parking', title: `pin-${suffix}`, enabled: true, duration_seconds: 10 },
        overrideAccess: true,
      });
      const disabled = await payload.create({
        collection: 'signage_slides',
        data: { kind: 'parking', title: `pin-off-${suffix}`, enabled: false, duration_seconds: 10 },
        overrideAccess: true,
      });
      try {
        await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: slide.id }, overrideAccess: true });
        const read = await payload.findGlobal({ slug: 'signage_settings', overrideAccess: false, depth: 0 });
        expect(read.pinned_slide).toBe(slide.id);
        await expect(
          payload.updateGlobal({
            slug: 'signage_settings',
            data: { pinned_slide: null },
            overrideAccess: false,
            user: await asOwner(),
          }),
        ).rejects.toThrow();
        // 無効なスライドは選択肢から外れる (filterOptions はバリデーションにも効く)
        await expect(
          payload.updateGlobal({
            slug: 'signage_settings',
            data: { pinned_slide: disabled.id },
            overrideAccess: false,
            user: await asUser(executive.id),
          }),
        ).rejects.toThrow();
        await payload.delete({ collection: 'signage_slides', id: slide.id, overrideAccess: true });
        const after = await payload.findGlobal({ slug: 'signage_settings', overrideAccess: true, depth: 0 });
        expect(after.pinned_slide ?? null).toBeNull();
      } finally {
        await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: null }, overrideAccess: true }).catch(() => null);
        await Promise.all([slide, disabled].map((x) => payload.delete({ collection: 'signage_slides', id: x.id, overrideAccess: true }).catch(() => null)));
      }
    });

    it('固定は null の更新で解除され、固定中のスライドを無効にしても解除される', async () => {
      const slide = await payload.create({
        collection: 'signage_slides',
        data: { kind: 'parking', title: `pin-unset-${suffix}`, enabled: true, duration_seconds: 10 },
        overrideAccess: true,
      });
      const other = await payload.create({
        collection: 'signage_slides',
        data: { kind: 'parking', title: `pin-other-${suffix}`, enabled: true, duration_seconds: 10 },
        overrideAccess: true,
      });
      const pinned = async () =>
        (await payload.findGlobal({ slug: 'signage_settings', overrideAccess: true, depth: 0 })).pinned_slide ?? null;
      const user = await asUser(executive.id);
      try {
        await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: slide.id }, overrideAccess: false, user });
        await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: null }, overrideAccess: false, user });
        expect(await pinned()).toBeNull();

        await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: slide.id }, overrideAccess: true });
        await payload.update({ collection: 'signage_slides', id: other.id, data: { enabled: false }, overrideAccess: true });
        expect(await pinned()).toBe(slide.id);
        await payload.update({ collection: 'signage_slides', id: slide.id, data: { enabled: false }, overrideAccess: true });
        expect(await pinned()).toBeNull();
      } finally {
        await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: null }, overrideAccess: true }).catch(() => null);
        await Promise.all([slide, other].map((x) => payload.delete({ collection: 'signage_slides', id: x.id, overrideAccess: true }).catch(() => null)));
      }
    });

    it('未認証は無効スライド・無効テロップ・返却済み落とし物を読めず、学生団体は作成できない', async () => {
      const slide = (enabled: boolean) =>
        payload.create({
          collection: 'signage_slides',
          data: { kind: 'parking', title: `sig-${suffix}-${enabled}`, enabled, duration_seconds: 10 },
          overrideAccess: true,
        });
      const telop = (enabled: boolean) =>
        payload.create({
          collection: 'telops',
          data: { audience: 'visitor', body: `sig-${suffix}-${enabled}`, enabled },
          overrideAccess: true,
        });
      const lost = (returned: boolean) =>
        payload.create({
          collection: 'lost_items',
          data: { name: `sig-${suffix}-${returned}`, found_place: 'x', found_at: new Date().toISOString(), returned },
          overrideAccess: true,
        });
      // _order は作成順に末尾へ採番されるため、順序の検証には逐次作成が要る
      const s1 = await slide(true);
      const s0 = await slide(false);
      const t1 = await telop(true);
      const t0 = await telop(false);
      const [l0, l1] = await Promise.all([lost(false), lost(true)]);
      try {
        const names = async (collection: 'signage_slides' | 'telops' | 'lost_items', sort?: string) =>
          (await payload.find({ collection, overrideAccess: false, pagination: false, sort })).docs.map((d) => d.id);
        const slides = await names('signage_slides');
        expect(slides).toContain(s1.id);
        expect(slides).not.toContain(s0.id);
        const orderOf = async (collection: 'signage_slides' | 'telops', ids: number[]) =>
          (await names(collection, '_order')).filter((id) => ids.includes(id));
        expect(await orderOf('signage_slides', [s1.id])).toEqual([s1.id]);
        const all = await Promise.all([s1, s0].map((x) => payload.findByID({ collection: 'signage_slides', id: x.id, overrideAccess: true })));
        expect((all[0] as { _order?: string })._order! < (all[1] as { _order?: string })._order!).toBe(true);
        const telops = await names('telops');
        expect(telops).toContain(t1.id);
        expect(telops).not.toContain(t0.id);
        const lostIds = await names('lost_items');
        expect(lostIds).toContain(l0.id);
        expect(lostIds).not.toContain(l1.id);

        const user = await asOwner();
        await expect(
          payload.create({
            collection: 'telops',
            data: { audience: 'visitor', body: 'x', enabled: true },
            overrideAccess: false,
            user,
          }),
        ).rejects.toThrow();
        await expect(
          payload.update({ collection: 'telops', id: t1.id, data: { body: 'y' }, overrideAccess: false, user }),
        ).rejects.toThrow();
      } finally {
        await Promise.all([
          payload.delete({ collection: 'signage_slides', id: s1.id, overrideAccess: true }),
          payload.delete({ collection: 'signage_slides', id: s0.id, overrideAccess: true }),
          payload.delete({ collection: 'telops', id: t1.id, overrideAccess: true }),
          payload.delete({ collection: 'telops', id: t0.id, overrideAccess: true }),
          payload.delete({ collection: 'lost_items', id: l0.id, overrideAccess: true }),
          payload.delete({ collection: 'lost_items', id: l1.id, overrideAccess: true }),
        ]).catch(() => null);
      }
    });
  });

  describe('サイネージ グループ', () => {
    const ov = { overrideAccess: true } as const;
    const slide = (title: string, enabled = true) =>
      payload.create({ collection: 'signage_slides', data: { kind: 'parking', title: `${title}-${suffix}`, enabled, duration_seconds: 10 }, ...ov });
    const group = (name: string, slides: number[], visible = true) =>
      payload.create({ collection: 'signage_groups', data: { name: `${name}-${suffix}`, visible, slides }, ...ov });
    const allGroup = async () =>
      (await payload.find({ collection: 'signage_groups', where: { is_all: { equals: true } }, depth: 0, ...ov })).docs;
    const setAllVisible = async (visible: boolean) => {
      const [a] = await allGroup();
      await payload.update({ collection: 'signage_groups', id: a.id, data: { visible }, ...ov });
    };
    const pinned = async () =>
      (await payload.findGlobal({ slug: 'signage_settings', depth: 0, ...ov })).pinned_slide ?? null;
    const pin = (id: number | null) => payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: id }, ...ov });
    const publicIds = async () =>
      (await payload.find({ collection: 'signage_slides', overrideAccess: false, pagination: false, depth: 0 })).docs.map((d) => d.id);
    const cleanup = async (slides: { id: number }[], groups: { id: number }[]) => {
      await setAllVisible(true).catch(() => null);
      await pin(null).catch(() => null);
      await Promise.all(groups.map((g) => payload.delete({ collection: 'signage_groups', id: g.id, ...ov }).catch(() => null)));
      await Promise.all(slides.map((s) => payload.delete({ collection: 'signage_slides', id: s.id, ...ov }).catch(() => null)));
    };

    it('「すべて」が1件あり、削除できず、is_all を付け外しできず、所属を書き込めず、名前と表示は変えられる', async () => {
      const user = await asUser(executive.id);
      const s = await slide('all-s');
      const normal = await group('all-normal', []);
      try {
        const alls = await allGroup();
        expect(alls).toHaveLength(1);
        const a = alls[0];
        await expect(payload.delete({ collection: 'signage_groups', id: a.id, overrideAccess: false, user })).rejects.toThrow('「すべて」は削除できません');
        await expect(payload.delete({ collection: 'signage_groups', id: a.id, ...ov })).rejects.toThrow();

        const created = await payload.create({
          collection: 'signage_groups',
          data: { name: `forged-${suffix}`, is_all: true },
          overrideAccess: false,
          user,
        });
        expect(created.is_all).toBe(false);
        await payload.delete({ collection: 'signage_groups', id: created.id, ...ov });

        const cleared = await payload.update({ collection: 'signage_groups', id: a.id, data: { is_all: false }, overrideAccess: false, user });
        expect(cleared.is_all).toBe(true);
        const forged = await payload.update({ collection: 'signage_groups', id: normal.id, data: { is_all: true }, overrideAccess: false, user });
        expect(forged.is_all).toBe(false);
        expect(await allGroup()).toHaveLength(1);

        const withSlides = await payload.update({ collection: 'signage_groups', id: a.id, data: { slides: [s.id] }, overrideAccess: false, user, depth: 0 });
        expect(withSlides.slides ?? []).toEqual([]);

        const renamed = await payload.update({
          collection: 'signage_groups',
          id: a.id,
          data: { name: `すべて-${suffix}`, visible: false },
          overrideAccess: false,
          user,
        });
        expect(renamed.name).toBe(`すべて-${suffix}`);
        expect(renamed.visible).toBe(false);
        await payload.update({ collection: 'signage_groups', id: a.id, data: { name: 'すべて', visible: true }, ...ov });
      } finally {
        await cleanup([s], [normal]);
      }
    });

    it('学生団体はグループを作成・更新できない', async () => {
      const g = await group('exhibitor', []);
      try {
        const user = await asOwner();
        await expect(
          payload.create({ collection: 'signage_groups', data: { name: 'x' }, overrideAccess: false, user }),
        ).rejects.toThrow();
        await expect(
          payload.update({ collection: 'signage_groups', id: g.id, data: { name: 'y' }, overrideAccess: false, user }),
        ).rejects.toThrow();
      } finally {
        await cleanup([], [g]);
      }
    });

    it('未認証のスライド読み取りは表示対象だけを返し、実行委員の読み取りは絞られない', async () => {
      const a = await slide('vis-a');
      const b = await slide('vis-b');
      const c = await slide('vis-c', false);
      const g = await group('vis', [a.id, c.id]);
      const h = await group('vis-hidden', [b.id], false);
      try {
        // 「すべて」が表示中なら有効なスライドは全部出る
        let ids = await publicIds();
        expect(ids).toEqual(expect.arrayContaining([a.id, b.id]));
        expect(ids).not.toContain(c.id);

        await setAllVisible(false);
        ids = await publicIds();
        expect(ids).toContain(a.id);
        expect(ids).not.toContain(b.id);
        expect(ids).not.toContain(c.id);

        // 表示中と非表示の両方に属するスライドは出続ける
        await payload.update({ collection: 'signage_groups', id: h.id, data: { slides: [a.id, b.id] }, ...ov });
        expect(await publicIds()).toContain(a.id);

        const exec = await asUser(executive.id);
        const all = await payload.find({ collection: 'signage_slides', overrideAccess: false, user: exec, pagination: false, depth: 0 });
        expect(all.docs.map((d) => d.id)).toEqual(expect.arrayContaining([a.id, b.id, c.id]));

        // 表示対象が無いときは 0 件 (403 ではない)
        await payload.update({ collection: 'signage_groups', id: g.id, data: { visible: false }, ...ov });
        expect(await publicIds()).toEqual([]);
      } finally {
        await cleanup([a, b, c], [g, h]);
      }
    });

    it('表示対象に無い固定スライドは未認証の設定の depth 2 でIDのまま返り、表示対象に無いスライドは固定に選べない', async () => {
      const a = await slide('pin-vis-a');
      const b = await slide('pin-vis-b');
      const g = await group('pin-vis', [a.id]);
      try {
        await setAllVisible(false);
        const exec = await asUser(executive.id);
        await expect(
          payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: b.id }, overrideAccess: false, user: exec }),
        ).rejects.toThrow();
        await payload.updateGlobal({ slug: 'signage_settings', data: { pinned_slide: a.id }, overrideAccess: false, user: exec });
        const shown = await payload.findGlobal({ slug: 'signage_settings', depth: 2, overrideAccess: false });
        expect(typeof shown.pinned_slide).toBe('object');
        expect((shown.pinned_slide as { id: number }).id).toBe(a.id);

        // フックを通さず所属だけを消し、固定が残ったまま表示対象から外れた状態を作る
        const { sql } = await import('@payloadcms/db-postgres');
        await payload.db.drizzle.execute(sql`DELETE FROM signage_groups_rels WHERE parent_id = ${g.id}`);
        const hidden = await payload.findGlobal({ slug: 'signage_settings', depth: 2, overrideAccess: false });
        expect(hidden.pinned_slide).toBe(a.id);
      } finally {
        await cleanup([a, b], [g]);
      }
    });

    it('表示対象から外れると固定が外れ、他の表示中のグループに属していれば外れない', async () => {
      const a = await slide('rel-a');
      const g1 = await group('rel-1', [a.id]);
      const g2 = await group('rel-2', [a.id]);
      try {
        await setAllVisible(false);
        await pin(a.id);

        await payload.update({ collection: 'signage_groups', id: g1.id, data: { visible: false }, ...ov });
        expect(await pinned()).toBe(a.id);
        await payload.update({ collection: 'signage_groups', id: g2.id, data: { slides: [] }, ...ov });
        expect(await pinned()).toBeNull();

        await payload.update({ collection: 'signage_groups', id: g2.id, data: { slides: [a.id] }, ...ov });
        await pin(a.id);
        await payload.delete({ collection: 'signage_groups', id: g2.id, ...ov });
        expect(await pinned()).toBeNull();
        const kept = await payload.findByID({ collection: 'signage_slides', id: a.id, depth: 0, ...ov });
        expect(kept.groups?.docs).toEqual([g1.id]);

        await setAllVisible(true);
        await pin(a.id);
        await setAllVisible(false);
        expect(await pinned()).toBeNull();
      } finally {
        await cleanup([a], [g1, g2]);
      }
    });

    it('グループを削除しても、所属スライドは残って「すべて」で出る', async () => {
      const a = await slide('del-a');
      const g = await group('del', [a.id]);
      try {
        await payload.delete({ collection: 'signage_groups', id: g.id, ...ov });
        expect((await payload.findByID({ collection: 'signage_slides', id: a.id, depth: 0, ...ov })).id).toBe(a.id);
        expect(await publicIds()).toContain(a.id);
      } finally {
        await cleanup([a], [g]);
      }
    });
  });

  describe('駐車場', () => {
    it('未認証でも読み取れる', async () => {
      const lots = await payload.find({ collection: 'parking_lots', overrideAccess: false, pagination: false });
      expect(lots.docs.map((doc) => doc.id)).toContain(parkingLot.id);
      const statuses = await payload.find({
        collection: 'parking_statuses',
        overrideAccess: false,
        pagination: false,
      });
      expect(statuses.docs.map((doc) => doc.id)).toContain(parkingStatus.id);
    });

    it('未認証は作成・更新・削除できない', async () => {
      await expect(
        payload.create({ collection: 'parking_lots', data: { name: `anon-${suffix}` }, overrideAccess: false }),
      ).rejects.toThrow();
      await expect(
        payload.update({ collection: 'parking_lots', id: parkingLot.id, data: { name: 'x' }, overrideAccess: false }),
      ).rejects.toThrow();
      await expect(
        payload.delete({ collection: 'parking_lots', id: parkingLot.id, overrideAccess: false }),
      ).rejects.toThrow();
      await expect(
        payload.create({
          collection: 'parking_statuses',
          data: { lot: parkingLot.id, status: 'full' },
          overrideAccess: false,
        }),
      ).rejects.toThrow();
      await expect(
        payload.update({
          collection: 'parking_statuses',
          id: parkingStatus.id,
          data: { status: 'full' },
          overrideAccess: false,
        }),
      ).rejects.toThrow();
      await expect(
        payload.delete({ collection: 'parking_statuses', id: parkingStatus.id, overrideAccess: false }),
      ).rejects.toThrow();
    });

    it('学生団体は作成・更新・削除できない', async () => {
      const user = await asOwner();
      await expect(
        payload.create({ collection: 'parking_lots', data: { name: `student-${suffix}` }, overrideAccess: false, user }),
      ).rejects.toThrow();
      await expect(
        payload.update({
          collection: 'parking_lots',
          id: parkingLot.id,
          data: { name: 'x' },
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow();
      await expect(
        payload.delete({ collection: 'parking_lots', id: parkingLot.id, overrideAccess: false, user }),
      ).rejects.toThrow();
      await expect(
        payload.create({
          collection: 'parking_statuses',
          data: { lot: parkingLot.id, status: 'full' },
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow();
      await expect(
        payload.update({
          collection: 'parking_statuses',
          id: parkingStatus.id,
          data: { status: 'full' },
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow();
      await expect(
        payload.delete({ collection: 'parking_statuses', id: parkingStatus.id, overrideAccess: false, user }),
      ).rejects.toThrow();
    });

    it('実行委員が空き状況を更新しても lot は変わらない', async () => {
      const user = await asUser(executive.id);
      const another = (await payload.create({
        collection: 'parking_lots',
        data: { name: `another-${suffix}` },
        overrideAccess: true,
      })) as { id: number };
      try {
        const updated = await payload.update({
          collection: 'parking_statuses',
          id: parkingStatus.id,
          data: { lot: another.id, status: 'crowded' },
          overrideAccess: false,
          user,
          depth: 0,
        });
        expect(updated.status).toBe('crowded');
        expect(updated.lot).toBe(parkingLot.id);
      } finally {
        await payload.delete({ collection: 'parking_lots', id: another.id, overrideAccess: true });
      }
    });

    it('駐車場を作ると空き状況が 1 件自動作成される', async () => {
      const lot = (await payload.create({
        collection: 'parking_lots',
        data: { name: `auto-${suffix}` },
        overrideAccess: false,
        user: await asUser(executive.id),
      })) as { id: number };
      try {
        const found = await payload.find({
          collection: 'parking_statuses',
          where: { lot: { equals: lot.id } },
          overrideAccess: true,
          depth: 0,
        });
        expect(found.totalDocs).toBe(1);
        expect(found.docs[0].status).toBeNull();
      } finally {
        await payload.delete({ collection: 'parking_lots', id: lot.id, overrideAccess: true });
      }
    });

    it('実行委員でも空き状況を直接作成・削除できない', async () => {
      const user = await asUser(executive.id);
      await expect(
        payload.create({
          collection: 'parking_statuses',
          data: { lot: parkingLot.id, status: 'full' },
          overrideAccess: false,
          user,
        }),
      ).rejects.toThrow();
      await expect(
        payload.delete({ collection: 'parking_statuses', id: parkingStatus.id, overrideAccess: false, user }),
      ).rejects.toThrow();
    });

    it('実行委員は status を null に戻せない', async () => {
      await expect(
        payload.update({
          collection: 'parking_statuses',
          id: parkingStatus.id,
          data: { status: null },
          overrideAccess: false,
          user: await asUser(executive.id),
        }),
      ).rejects.toThrow();
    });

    it('駐車場を削除すると空き状況も削除される', async () => {
      const lot = (await payload.create({
        collection: 'parking_lots',
        data: { name: `cascade-${suffix}` },
        overrideAccess: true,
      })) as { id: number };
      const status = (
        await payload.find({
          collection: 'parking_statuses',
          where: { lot: { equals: lot.id } },
          overrideAccess: true,
        })
      ).docs[0] as { id: number };
      await payload.delete({ collection: 'parking_lots', id: lot.id, overrideAccess: true });
      await expect(
        payload.findByID({ collection: 'parking_statuses', id: status.id, overrideAccess: true }),
      ).rejects.toThrow();
    });
  });
});
