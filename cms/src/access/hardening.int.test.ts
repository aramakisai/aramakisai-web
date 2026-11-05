import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

    it('REST (overrideAccess を明示しない経路) でも拒否する', async () => {
      const { REST_GET } = await import('@payloadcms/next/routes');
      const config = (await import('../payload.config')).default;
      const get = REST_GET(config) as (req: Request, ctx: { params: Promise<{ slug: string[] }> }) => Promise<Response>;
      const call = (query: string) =>
        get(new Request(`http://localhost/api/performance_slots?${query}`), {
          params: Promise.resolve({ slug: ['performance_slots'] }),
        });
      expect((await call('where[exhibition_id.organization_name][like]=a')).status).toBe(403);
      expect((await call('sort=-exhibition_id.organization_name')).status).toBe(403);
      expect((await call('where[exhibition_id][equals]=1')).status).toBe(200);
    });

    it('実行委員は拒否されない', async () => {
      await expect(
        find(executive, 'performance_slots', { where: { 'exhibition_id.organization_name': { like: 'a' } } }),
      ).resolves.toBeDefined();
    });
  });

  describe('招待済み未有効化ユーザーの forgot-password', () => {
    const forgot = async (email: string) => {
      const users = payload.config.collections.find((c) => c.slug === 'users');
      const endpoints = (users?.endpoints || []) as { path: string; method: string; handler: (req: unknown) => unknown }[];
      const handler = endpoints.find((e) => e.path === '/forgot-password' && e.method === 'post')!.handler;
      const req = await reqAs(null);
      Object.assign(req, { data: { email } });
      return (await handler(req)) as Response;
    };
    const tokenOf = async (id: number) =>
      (await payload.db.findOne({ collection: 'users', where: { id: { equals: id } } }) as { resetPasswordToken?: string }).resetPasswordToken;

    it('トークンを上書きせずメールも送らず、通常と同じ応答を返す。有効化後は通常どおり発行する', async () => {
      const email = `hardening-invited-${suffix}@test.local`;
      const invited = (await payload.create({
        collection: 'users',
        data: {
          email,
          password: 'test-password',
          role: 'student_exhibitor',
          invite_status: 'sent',
          resetPasswordToken: 'invitation-token',
          resetPasswordExpiration: new Date(Date.now() + 3_600_000).toISOString(),
        } as never,
        overrideAccess: true,
      })) as { id: number };
      const send = vi.spyOn(payload.email, 'sendEmail').mockResolvedValue(undefined as never);
      try {
        const unknown = await forgot(`nobody-${suffix}@test.local`);
        const blocked = await forgot(email);
        expect(blocked.status).toBe(unknown.status);
        expect(await blocked.json()).toEqual(await unknown.json());
        expect(await tokenOf(invited.id)).toBe('invitation-token');
        expect(send).not.toHaveBeenCalled();

        await payload.update({
          collection: 'users',
          id: invited.id,
          data: { activated_at: new Date().toISOString() },
          overrideAccess: true,
        });
        await forgot(email);
        expect(await tokenOf(invited.id)).not.toBe('invitation-token');
        expect(send).toHaveBeenCalledTimes(1);
      } finally {
        send.mockRestore();
        await payload.delete({ collection: 'users', id: invited.id, overrideAccess: true }).catch(() => null);
      }
    });
  });

  describe('ファイル配信', () => {
    type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const created: { collection: 'media' | 'parking_snapshots' | 'parking_cameras' | 'parking_lots'; id: number }[] = [];
    let mediaDoc: Any;
    let snapshot: Any;

    const getFile = async (collection: string, filename: string, user: unknown) => {
      const handler = (payload.collections as Any)[collection].config.endpoints.find(
        (e: Any) => e.path === '/file/:filename' && e.method === 'get',
      ).handler;
      const req = await reqAs(user);
      Object.assign(req, { routeParams: { collection, filename } });
      return (await handler(req)) as Response;
    };
    const serve = async (id: number, user: unknown) => {
      const handler = (payload.collections as Any).media.config.endpoints.find((e: Any) => e.path === '/serve/:id/:size').handler;
      const req = await reqAs(user);
      Object.assign(req, { routeParams: { id: String(id), size: 'original' } });
      return (await handler(req)) as Response;
    };

    beforeAll(async () => {
      const sharp = (await import('sharp')).default;
      const jpeg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 9, g: 9, b: 9 } } })
        .jpeg()
        .toBuffer();
      const file = (name: string) => ({ data: jpeg, mimetype: 'image/jpeg', name, size: jpeg.length });
      mediaDoc = await payload.create({
        collection: 'media',
        data: { alt: 'x' },
        file: file(`hardening-${suffix}.jpg`),
        overrideAccess: true,
      });
      created.push({ collection: 'media', id: mediaDoc.id });
      const lot = (await payload.create({ collection: 'parking_lots', data: { name: `hardening-lot-${suffix}` }, overrideAccess: true })) as Any;
      const camera = (await payload.create({ collection: 'parking_cameras', data: { name: `hardening-cam-${suffix}`, lot: lot.id }, overrideAccess: true })) as Any;
      snapshot = await payload.create({
        collection: 'parking_snapshots',
        data: { camera: camera.id, lot: lot.id, captured_at: new Date().toISOString() },
        file: file(`hardening-snap-${suffix}.jpg`),
        overrideAccess: true,
      });
      created.push(
        { collection: 'parking_snapshots', id: snapshot.id },
        { collection: 'parking_cameras', id: camera.id },
        { collection: 'parking_lots', id: lot.id },
      );
    });

    afterAll(async () => {
      for (const { collection, id } of created) {
        await payload.delete({ collection, id, overrideAccess: true }).catch(() => null);
      }
    });

    it('media: 匿名の取得に nosniff を付け、認証済みの取得は共有キャッシュを禁じる', async () => {
      const anonymous = await getFile('media', mediaDoc.filename, null);
      expect(anonymous.status).toBe(200);
      expect(anonymous.headers.get('x-content-type-options')).toBe('nosniff');
      expect(anonymous.headers.get('cache-control')).toBeNull();

      const authenticated = await getFile('media', mediaDoc.filename, executive);
      expect(authenticated.headers.get('x-content-type-options')).toBe('nosniff');
      expect(authenticated.headers.get('cache-control')).toBe('private, no-store');
    });

    it('media: /serve の 302 は匿名なら公開キャッシュ、認証済みなら private, no-store', async () => {
      expect((await serve(mediaDoc.id, null)).headers.get('cache-control')).toBe('public, max-age=60');
      expect((await serve(mediaDoc.id, executive)).headers.get('cache-control')).toBe('private, no-store');
    });

    it('parking_snapshots: 匿名は原本を取得できず、縮小版だけ取得できる', async () => {
      await expect(getFile('parking_snapshots', snapshot.filename, null)).rejects.toThrow();
      await expect(getFile('parking_snapshots', snapshot.filename, student)).rejects.toThrow();

      const web = await getFile('parking_snapshots', snapshot.sizes.web.filename, null);
      expect(web.status).toBe(200);
      expect(web.headers.get('x-content-type-options')).toBe('nosniff');
      expect(web.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    });

    it('parking_snapshots: 認証済みは private, no-store で、実行委員は原本も取得できる', async () => {
      const original = await getFile('parking_snapshots', snapshot.filename, executive);
      expect(original.status).toBe(200);
      expect(original.headers.get('cache-control')).toBe('private, no-store');
      const web = await getFile('parking_snapshots', snapshot.sizes.web.filename, student);
      expect(web.headers.get('cache-control')).toBe('private, no-store');
    });
  });
});
