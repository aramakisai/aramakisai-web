import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const ctx = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  throws: false,
}));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => {
    if (ctx.throws) throw new Error('no context');
    return { env: ctx.env };
  },
}));

import { signStamp } from '@/lib/stamp-signature';
import { openTestD1 } from '@/test-support/stamp-d1';
import { POST } from './route';

const SECRET = 'test-secret-0123456789-0123456789'; // gitleaks:allow
const V1 = '11111111-1111-4111-8111-111111111111';

let d1: Awaited<ReturnType<typeof openTestD1>>;
let points: { blobs?: string[]; doubles?: number[] }[];
let limitOk: boolean;

beforeAll(async () => {
  d1 = await openTestD1();
}, 60_000);
afterAll(async () => {
  await d1?.close();
});
beforeEach(async () => {
  await d1.reset();
  points = [];
  limitOk = true;
  ctx.throws = false;
  ctx.env = {
    STAMP_DB: d1.db,
    STAMP_METRICS: { writeDataPoint: (p: never) => points.push(p) },
    STAMP_RATE_LIMITER: { limit: async () => ({ success: limitOk }) },
    STAMP_SIGNING_SECRET: SECRET,
    STAMP_ENV: 'preview',
    STAFF_OIDC_ISSUER: 'https://idp.test',
  };
});

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/stamps/verify', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
const count = () => d1.count('stamps');
const body = async (extra: object = {}) => ({
  id: 5,
  category: 'exhibit',
  signature: await signStamp(SECRET, 5, 'exhibit'),
  visitorId: V1,
  ...extra,
});

describe('POST /api/stamps/verify', () => {
  it('1 回目は added、2 回目は exists で記録は 1 件', async () => {
    const r1 = await post(await body());
    expect(r1.headers.get('Cache-Control')).toBe('no-store');
    expect(await r1.json()).toEqual({ result: 'added' });
    expect(await (await post(await body())).json()).toEqual({
      result: 'exists',
    });
    expect(await count()).toBe(1);
  });

  it('署名不正・匿名ID欠落/不正・stage では記録されず invalid', async () => {
    for (const b of [
      await body({ signature: 'x'.repeat(43) }),
      await body({ id: 6 }),
      await body({ visitorId: undefined }),
      await body({ visitorId: 'not-a-uuid' }),
      await body({ category: 'stage' }),
      await body({ id: 0 }),
    ]) {
      expect(await (await post(b)).json()).toEqual({ result: 'invalid' });
    }
    expect(await count()).toBe(0);
  });

  it('D1 失敗で failed、計測に d1Failed が残る', async () => {
    await d1.db.prepare('DROP TABLE stamps').run();
    const res = await post(await body());
    expect(await res.json()).toEqual({ result: 'failed' });
    expect(points.at(-1)!.doubles![6]).toBe(1);
  });

  it('exists・failed でも企画 ID とカテゴリを計測する', async () => {
    await post(await body());
    await post(await body());
    expect(points[1]!.blobs).toEqual([
      'preview',
      'verify',
      'exists',
      '200',
      '5',
      'exhibit',
    ]);
    await d1.db.prepare('DROP TABLE stamps').run();
    await post(await body());
    expect(points[2]!.blobs).toEqual([
      'preview',
      'verify',
      'failed',
      '200',
      '5',
      'exhibit',
    ]);
  });

  it('invalid では企画 ID とカテゴリを計測しない', async () => {
    await post(await body({ signature: 'x'.repeat(43) }));
    await post('{bad');
    for (const p of points) expect(p.blobs!.slice(4)).toEqual(['', '']);
    expect(points).toHaveLength(2);
  });

  it('env 不備なら failed', async () => {
    ctx.env = {};
    expect(await (await post(await body())).json()).toEqual({
      result: 'failed',
    });
    ctx.throws = true;
    expect(await (await post(await body())).json()).toEqual({
      result: 'failed',
    });
  });

  it('JSON として読めなければ 400', async () => {
    const res = await post('{not json');
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('制限超過は 429 で記録しない', async () => {
    limitOk = false;
    const res = await post(await body());
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ result: 'rate_limited' });
    expect(await count()).toBe(0);
    expect(points.at(-1)!.blobs).toEqual([
      'preview',
      'verify',
      'rate_limited',
      '429',
      '',
      '',
    ]);
  });

  it('1 リクエストにつき計測 1 点、匿名IDは含めない', async () => {
    await post(await body());
    expect(points).toHaveLength(1);
    expect(points[0]!.blobs).toEqual([
      'preview',
      'verify',
      'added',
      '200',
      '5',
      'exhibit',
    ]);
    expect(JSON.stringify(points[0])).not.toContain(V1);
  });

  it('リクエスト内容をログに出さない', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    await post(await body());
    await post('{bad');
    spies.forEach((s) => expect(s).not.toHaveBeenCalled());
    vi.restoreAllMocks();
  });
});
