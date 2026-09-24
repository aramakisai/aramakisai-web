import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('出展者ロールの access control', () => {
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

  const ownerIdOf = (value: unknown) =>
    typeof value === 'object' && value !== null ? (value as { id: number }).id : value;

  const suffix = String(process.pid);

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

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

    const createExhibition = async (ownerId: number, name: string, status: 'draft' | 'published') =>
      (await payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: ownerId,
          organization_name: name,
          categories: ['other'],
          other: { name },
          status,
        },
        overrideAccess: true,
      })) as { id: number };

    ownRecord = await createExhibition(owner.id, `own-${suffix}`, 'draft');
    otherRecord = await createExhibition(other.id, `other-${suffix}`, 'draft');
    publishedRecord = await createExhibition(publishedOwner.id, `published-${suffix}`, 'published');
  });

  afterAll(async () => {
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
          booth_number: 999,
          booth_label: '書き換え後',
          status: 'published',
        },
        overrideAccess: false,
        user: await asOwner(),
      });

      expect(updated.booth_number).toBe(before.booth_number);
      expect(updated.booth_label).toBe(before.booth_label);
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
          other: { name: `assign1-${suffix}` },
          status: 'draft',
          booth_number: 101,
          booth_label: `label1-${suffix}`,
        },
        overrideAccess: true,
      })) as { id: number; owner: unknown; booth_number: number; booth_label: string };
      assign1Record = created1.id;

      const created2 = (await payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: assignee2.id,
          organization_name: `assign2-${suffix}`,
          categories: ['other'],
          other: { name: `assign2-${suffix}` },
          status: 'draft',
          booth_number: 101,
          booth_label: `label1-${suffix}`,
        } as never,
        overrideAccess: false,
        user: executiveUser,
      })) as { id: number; owner: unknown; booth_number: number; booth_label: string };
      assign2Record = created2.id;

      // 同じ値で保存される (owner はそれぞれの指定どおり、他の指定値は経路によらず同じ)
      expect(ownerIdOf(created1.owner)).toBe(assignee1.id);
      expect(ownerIdOf(created2.owner)).toBe(assignee2.id);
      expect(created1.booth_number).toBe(created2.booth_number);
      expect(created1.booth_label).toBe(created2.booth_label);

      // 重複 owner はどちらの経路でも同じ M-E02 エラーになる
      const localDuplicate = await payload
        .create({
          collection: 'student_exhibitions',
          data: {
            owner: assignee1.id,
            organization_name: `assign1-dup-${suffix}`,
            categories: ['other'],
            other: { name: `assign1-dup-${suffix}` },
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
});
