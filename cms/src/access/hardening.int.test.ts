import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 実 DB を要求するため、DATABASE_URL が無い環境ではスキップする
const hasDatabase = Boolean(process.env.DATABASE_URL && process.env.PAYLOAD_SECRET);

describe.skipIf(!hasDatabase)('低権限・匿名に対する access の締め付け', () => {
  let payload: Awaited<ReturnType<typeof import('payload').getPayload>>;
  let executive: { id: number; role: 'executive' };
  let student: { id: number; role: 'student_exhibitor' };
  const suffix = String(process.pid);

  const createUser = async (email: string, role: 'student_exhibitor' | 'executive') =>
    (await payload.create({
      collection: 'users',
      data: { email, password: 'test-password', role },
      overrideAccess: true,
    })) as never;

  const reqAs = async (user: unknown, query: Record<string, string> = {}) => {
    const { createLocalReq } = await import('payload');
    const req = await createLocalReq({ user: user as never }, payload);
    Object.assign(req, { query });
    return req;
  };

  beforeAll(async () => {
    const { getPayload } = await import('payload');
    const config = (await import('../payload.config')).default;
    payload = await getPayload({ config });
    executive = await createUser(`hardening-exec-${suffix}@test.local`, 'executive');
    student = await createUser(`hardening-student-${suffix}@test.local`, 'student_exhibitor');
  });

  afterAll(async () => {
    for (const u of [executive, student]) {
      await payload.delete({ collection: 'users', id: u.id, overrideAccess: true }).catch(() => null);
    }
  });

  describe('jobs の HTTP 実行エンドポイント', () => {
    const endpointFor = (path: string) => {
      const jobs = payload.config.collections.find((c) => c.slug === 'payload-jobs');
      const endpoints = (jobs?.endpoints || []) as { path: string; method: string; handler: (req: unknown) => unknown }[];
      const endpoint = endpoints.find((e) => `/payload-jobs${e.path}` === path && e.method === 'get');
      if (!endpoint) throw new Error(`endpoint ${path} not found`);
      return endpoint.handler;
    };

    for (const path of ['/payload-jobs/run', '/payload-jobs/handle-schedules']) {
      it.each([
        ['匿名', () => null],
        ['学生団体', () => student],
        ['実行委員', () => executive],
      ])(`${path} は %s を拒否する`, async (_label, user) => {
        const res = (await endpointFor(path)(await reqAs(user()))) as Response;
        expect(res.status).toBe(401);
      });
    }
  });

  describe('users の unlock', () => {
    it('学生団体は拒否され、実行委員は通る', async () => {
      await expect(
        payload.unlock({ collection: 'users', data: { email: `hardening-student-${suffix}@test.local` } as never, req: await reqAs(student), overrideAccess: false }),
      ).rejects.toThrow();
      await expect(
        payload.unlock({ collection: 'users', data: { email: `hardening-student-${suffix}@test.local` } as never, req: await reqAs(executive), overrideAccess: false }),
      ).resolves.toBeDefined();
    });
  });

  describe('関連先の非公開データを推測する where/sort', () => {
    const anon = () => null;
    const cases: [string, () => unknown][] = [
      ['匿名', anon],
      ['学生団体', () => student],
    ];

    const find = async (user: unknown, collection: string, query: { where?: unknown; sort?: string }) =>
      payload.find({
        collection: collection as never,
        where: query.where as never,
        sort: query.sort,
        overrideAccess: false,
        user: user as never,
      });

    it.each(cases)('%s: 条件付きの関連先を辿る where を拒否する', async (_l, user) => {
      await expect(
        find(user(), 'performance_slots', { where: { 'exhibition_id.organization_name': { like: 'a' } } }),
      ).rejects.toThrow(/許可されていません/);
      await expect(
        find(user(), 'signage_groups', { where: { and: [{ 'slides.title': { like: 'a' } }] } }),
      ).rejects.toThrow(/許可されていません/);
    });

    it.each(cases)('%s: 条件付きの関連先を辿る sort を拒否する', async (_l, user) => {
      await expect(find(user(), 'performance_slots', { sort: '-exhibition_id.organization_name' })).rejects.toThrow(
        /許可されていません/,
      );
    });

    it.each(cases)('%s: count と findDistinct も拒否する', async (_l, user) => {
      await expect(
        payload.count({
          collection: 'performance_slots',
          where: { 'exhibition_id.organization_name': { like: 'a' } },
          overrideAccess: false,
          user: user() as never,
        }),
      ).rejects.toThrow(/許可されていません/);
      await expect(
        payload.findDistinct({
          collection: 'performance_slots',
          field: 'exhibition_id.organization_name',
          overrideAccess: false,
          user: user() as never,
        }),
      ).rejects.toThrow(/許可されていません/);
    });

    it.each(cases)('%s: 関連先を辿らない条件・公開の関連先を辿る条件は通る', async (_l, user) => {
      await expect(find(user(), 'performance_slots', { where: { exhibition_id: { equals: 1 } } })).resolves.toBeDefined();
      await expect(find(user(), 'performance_slots', { where: { 'exhibition_id.id': { equals: 1 } } })).resolves.toBeDefined();
      await expect(find(user(), 'performance_slots', { where: { 'stage_id.name': { like: 'a' } } })).resolves.toBeDefined();
    });

    it('実行委員は拒否されない', async () => {
      await expect(
        find(executive, 'performance_slots', { where: { 'exhibition_id.organization_name': { like: 'a' } } }),
      ).resolves.toBeDefined();
    });
  });
});
