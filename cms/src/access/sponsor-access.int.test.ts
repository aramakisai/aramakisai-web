import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// 明示指定した専用の隔離 DB 以外には接続しない。
function hasIsolatedDatabase(): boolean {
  if (process.env.AD_SPONSOR_ISOLATED_DB !== '1' || !process.env.PAYLOAD_SECRET) return false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && url.hostname === '127.0.0.1'
      && Boolean(url.port)
      && url.pathname === '/advertising_sponsors_test'
      && !url.search && !url.hash;
  } catch {
    return false;
  }
}

describe.skipIf(!hasIsolatedDatabase())('協賛データの access control', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let executive: { id: number };
  let student: { id: number };
  let personal: { id: number };
  let sponsor: { id: number };
  const personalIds: number[] = [];
  const sponsorIds: number[] = [];
  const userIds: number[] = [];
  const suffix = randomUUID();

  beforeAll(async () => {
    // 設定の継承による外部ストレージ、レプリカ、メール、通知への接続を防ぐ。
    for (const name of ['S3_BUCKET', 'DATABASE_REPLICA_URL', 'SMTP_HOST', 'SIGNAGE_NOTIFY_URL']) vi.stubEnv(name, '');
    const { getPayload } = await import('payload');
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });

    for (const role of ['executive', 'student_exhibitor'] as const) {
      const user = await payload.create({
        collection: 'users',
        data: { email: `${role}-${suffix}@example.invalid`, password: 'test-password', role },
        overrideAccess: true,
      });
      userIds.push(user.id);
      if (role === 'executive') executive = user;
      else student = user;
    }
    personal = await payload.create({
      collection: 'personal_sponsors', data: { name: `personal-${suffix}` }, overrideAccess: true,
    });
    personalIds.push(personal.id);
    sponsor = await payload.create({
      collection: 'sponsors', data: { name: `sponsor-${suffix}`, type: ['other'] }, overrideAccess: true,
    });
    sponsorIds.push(sponsor.id);
  });

  afterAll(async () => {
    try {
      if (payload) {
        const results = await Promise.allSettled([
          ...personalIds.map((id) => payload.delete({ collection: 'personal_sponsors', id, overrideAccess: true })),
          ...sponsorIds.map((id) => payload.delete({ collection: 'sponsors', id, overrideAccess: true })),
          ...userIds.map((id) => payload.delete({ collection: 'users', id, overrideAccess: true })),
        ]);
        const failed = results.filter((result) => result.status === 'rejected');
        expect(failed).toEqual([]);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  const asUser = async (id: number) =>
    (await payload.findByID({ collection: 'users', id, overrideAccess: true })) as never;

  it('未認証で登録済みの個人協賛を読める', async () => {
    const result = await payload.find({
      collection: 'personal_sponsors',
      where: { id: { equals: personal.id } },
      overrideAccess: false,
    });
    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]).toMatchObject({ id: personal.id, name: `personal-${suffix}` });
  });

  it('実行委員は個人協賛を作成・変更・削除できる', async () => {
    const user = await asUser(executive.id);
    const created = await payload.create({
      collection: 'personal_sponsors', data: { name: `created-${suffix}` }, overrideAccess: false, user,
    });
    personalIds.push(created.id);
    const updated = await payload.update({
      collection: 'personal_sponsors', id: created.id, data: { name: `updated-${suffix}` }, overrideAccess: false, user,
    });
    expect(updated.name).toBe(`updated-${suffix}`);
    const deleted = await payload.delete({ collection: 'personal_sponsors', id: created.id, overrideAccess: false, user });
    expect(deleted.id).toBe(created.id);
    personalIds.splice(personalIds.indexOf(created.id), 1);
  });

  it('学生団体と未認証は個人協賛を作成・変更・削除できない', async () => {
    for (const user of [undefined, await asUser(student.id)]) {
      await expect(payload.create({
        collection: 'personal_sponsors', data: { name: `denied-${suffix}` }, overrideAccess: false, user,
      }).then((created) => { personalIds.push(created.id); return created; })).rejects.toMatchObject({ status: 403 });
      await expect(payload.update({
        collection: 'personal_sponsors', id: personal.id, data: { name: 'denied' }, overrideAccess: false, user,
      })).rejects.toMatchObject({ status: 403 });
      await expect(payload.delete({
        collection: 'personal_sponsors', id: personal.id, overrideAccess: false, user,
      })).rejects.toMatchObject({ status: 403 });
    }
    const unchanged = await payload.findByID({ collection: 'personal_sponsors', id: personal.id, overrideAccess: true });
    expect(unchanged.name).toBe(`personal-${suffix}`);
  });

  it('学生団体は既存の企業協賛を作成・変更・削除できない', async () => {
    const user = await asUser(student.id);
    await expect(payload.create({
      collection: 'sponsors', data: { name: `denied-${suffix}`, type: ['other'] }, overrideAccess: false, user,
    }).then((created) => { sponsorIds.push(created.id); return created; })).rejects.toMatchObject({ status: 403 });
    await expect(payload.update({
      collection: 'sponsors', id: sponsor.id, data: { name: 'denied' }, overrideAccess: false, user,
    })).rejects.toMatchObject({ status: 403 });
    await expect(payload.delete({
      collection: 'sponsors', id: sponsor.id, overrideAccess: false, user,
    })).rejects.toMatchObject({ status: 403 });
    const unchanged = await payload.findByID({ collection: 'sponsors', id: sponsor.id, overrideAccess: true });
    expect(unchanged.name).toBe(`sponsor-${suffix}`);
  });
});
