import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({ env: ctx.env }),
}));

const catalog = vi.hoisted(() => ({ fail: false }));
vi.mock('@/lib/exhibitions', () => ({
  getExhibitionCatalog: async () => {
    if (catalog.fail) throw new Error('cms down');
    return {
      cards: [
        { id: 1, category: 'exhibit', displayName: 'a', areaIds: [1] },
        { id: 2, category: 'vendor', displayName: 'b', areaIds: [] },
      ],
      areas: [],
    };
  },
}));

import { verifyExchangeToken } from '@/lib/exchange-token';
import { openTestD1 } from '@/test-support/stamp-d1';
import { POST } from './route';

const SECRET = 'test-secret-0123456789-0123456789'; // gitleaks:allow
const V1 = '11111111-1111-4111-8111-111111111111';

let d1: Awaited<ReturnType<typeof openTestD1>>;

beforeAll(async () => {
  d1 = await openTestD1();
}, 60_000);
afterAll(async () => {
  await d1?.close();
});
beforeEach(async () => {
  await d1.reset();
  catalog.fail = false;
  ctx.env = {
    STAMP_DB: d1.db,
    STAMP_METRICS: { writeDataPoint: () => {} },
    STAMP_RATE_LIMITER: { limit: async () => ({ success: true }) },
    STAMP_SIGNING_SECRET: SECRET,
    STAMP_ENV: 'preview',
    STAFF_OIDC_ISSUER: 'https://idp.test',
  };
});

const post = (body: unknown) =>
  POST(
    new Request('https://example.test/api/stamps/exchange-token', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );
const stamp = (id: number, category: string) =>
  d1.db
    .prepare('INSERT INTO stamps VALUES (?, ?, ?, ?)')
    .bind(V1, id, category, 'x')
    .run();

describe('POST /api/stamps/exchange-token', () => {
  it('全対象を取得した匿名IDにだけ URL を返す', async () => {
    await stamp(1, 'exhibit');
    let res = await post({ visitorId: V1 });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not_eligible' });

    await stamp(2, 'vendor');
    res = await post({ visitorId: V1 });
    expect(res.status).toBe(200);
    const { url, expiresAt } = (await res.json()) as {
      url: string;
      expiresAt: string;
    };
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(
      `https://example.test/staff/visitors/${V1}`,
    );
    expect(
      await verifyExchangeToken(
        SECRET,
        V1,
        u.searchParams.get('t')!,
        new Date(),
      ),
    ).toBe('valid');
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
  });

  it('スタンプが 0 件なら 403', async () => {
    expect((await post({ visitorId: V1 })).status).toBe(403);
  });

  it('匿名IDの形式不正は 400', async () => {
    expect((await post({ visitorId: 'x' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  it('カタログ取得失敗は 503', async () => {
    catalog.fail = true;
    expect((await post({ visitorId: V1 })).status).toBe(503);
  });
});
