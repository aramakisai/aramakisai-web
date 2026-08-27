import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('出展者ロールの access control', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let owner: { id: number };
  let other: { id: number };
  let ownRecord: { id: number };
  let otherRecord: { id: number };
  let fresh: { id: number };
  let squatter: { id: number };
  let selfCreated: number | undefined;
  let squatAttempt: number | undefined;

  const ownerIdOf = (value: unknown) =>
    typeof value === 'object' && value !== null ? (value as { id: number }).id : value;

  const suffix = String(process.pid);

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    const createExhibitor = async (email: string) =>
      (await payload.create({
        collection: 'users',
        data: { email, password: 'test-password', role: 'student_exhibitor' },
        overrideAccess: true,
      })) as { id: number };

    owner = await createExhibitor(`owner-${suffix}@test.local`);
    other = await createExhibitor(`other-${suffix}@test.local`);
    fresh = await createExhibitor(`fresh-${suffix}@test.local`);
    squatter = await createExhibitor(`squatter-${suffix}@test.local`);

    const createExhibition = async (ownerId: number, name: string) =>
      (await payload.create({
        collection: 'student_exhibitions',
        data: {
          owner: ownerId,
          name,
          organization_name: name,
          category: ['other'],
          status: 'draft',
        },
        overrideAccess: true,
      })) as { id: number };

    ownRecord = await createExhibition(owner.id, `own-${suffix}`);
    otherRecord = await createExhibition(other.id, `other-${suffix}`);
  });

  afterAll(async () => {
    if (!payload) return;
    for (const id of [ownRecord?.id, otherRecord?.id, selfCreated, squatAttempt]) {
      if (id) {
        await payload
          .delete({ collection: 'student_exhibitions', id, overrideAccess: true })
          .catch(() => null);
      }
    }
    for (const id of [owner?.id, other?.id, fresh?.id, squatter?.id]) {
      if (id) {
        await payload
          .delete({ collection: 'users', id, overrideAccess: true })
          .catch(() => null);
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

  it('自分のレコードを更新できる', async () => {
    const updated = await payload.update({
      collection: 'student_exhibitions',
      id: ownRecord.id,
      data: { description: '更新後' },
      overrideAccess: false,
      user: await asOwner(),
    });
    expect(updated.description).toBe('更新後');
  });

  it('他者のレコードを更新しようとすると拒否される', async () => {
    await expect(
      payload.update({
        collection: 'student_exhibitions',
        id: otherRecord.id,
        data: { description: '侵入' },
        overrideAccess: false,
        user: await asOwner(),
      }),
    ).rejects.toThrow();
  });

  it('一覧取得には自分のレコードのみが含まれる', async () => {
    const result = await payload.find({
      collection: 'student_exhibitions',
      overrideAccess: false,
      user: await asOwner(),
      pagination: false,
      depth: 0,
    });
    const ids = result.docs.map((doc) => doc.id);
    expect(ids).toContain(ownRecord.id);
    expect(ids).not.toContain(otherRecord.id);
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
  it('owner を省略した作成では自分が所有者になる', async () => {
    const created = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        name: `self-${suffix}`,
        organization_name: `self-${suffix}`,
        category: ['other'],
        status: 'draft',
      } as never,
      overrideAccess: false,
      user: await asUser(fresh.id),
    })) as { id: number; owner: unknown };
    selfCreated = created.id;
    expect(ownerIdOf(created.owner)).toBe(fresh.id);
  });

  it('他者を owner に指定した作成でも自分が所有者になる', async () => {
    const created = (await payload.create({
      collection: 'student_exhibitions',
      data: {
        owner: owner.id,
        name: `squat-${suffix}`,
        organization_name: `squat-${suffix}`,
        category: ['other'],
        status: 'draft',
      } as never,
      overrideAccess: false,
      user: await asUser(squatter.id),
    })) as { id: number; owner: unknown };
    squatAttempt = created.id;
    expect(ownerIdOf(created.owner)).toBe(squatter.id);
  });
});
