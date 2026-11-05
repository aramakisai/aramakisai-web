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
      const endpoint = jobs?.endpoints?.find((e) => `/payload-jobs${e.path}` === path && e.method === 'get');
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
});
