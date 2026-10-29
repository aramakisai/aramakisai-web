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

import { openTestD1 } from '@/test-support/stamp-d1';
import { GET } from './route';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

let d1: Awaited<ReturnType<typeof openTestD1>>;
let points: unknown[];
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
  ctx.env = {
    STAMP_DB: d1.db,
    STAMP_METRICS: { writeDataPoint: (p: unknown) => points.push(p) },
    STAMP_RATE_LIMITER: { limit: async () => ({ success: limitOk }) },
    STAMP_SIGNING_SECRET: 's'.repeat(32),
    STAMP_ENV: 'preview',
    STAFF_OIDC_ISSUER: 'https://idp.test',
  };
});

const get = (q: string) => GET(new Request(`http://localhost/api/stamps${q}`));

describe('GET /api/stamps', () => {
  it('記録済みの組を取得日時つきで返し、他の匿名IDは混ざらない', async () => {
    await d1.db
      .prepare(
        "INSERT INTO stamps VALUES (?, 1, 'exhibit', '2026-11-14T01:00:00.000Z')",
      )
      .bind(V1)
      .run();
    await d1.db
      .prepare(
        "INSERT INTO stamps VALUES (?, 2, 'exhibit', '2026-11-14T02:00:00.000Z')",
      )
      .bind(V2)
      .run();
    const res = await get(`?visitorId=${V1}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({
      stamps: [
        {
          exhibitionId: 1,
          category: 'exhibit',
          acquiredAt: '2026-11-14T01:00:00.000Z',
        },
      ],
    });
    expect(points).toHaveLength(1);
  });

  it('匿名IDの形式不正・欠落は 400', async () => {
    expect((await get('?visitorId=abc')).status).toBe(400);
    expect((await get('')).status).toBe(400);
  });

  it('D1 失敗は 503', async () => {
    await d1.db.prepare('DROP TABLE stamps').run();
    expect((await get(`?visitorId=${V1}`)).status).toBe(503);
  });

  it('env 不備は 503', async () => {
    ctx.env = {};
    expect((await get(`?visitorId=${V1}`)).status).toBe(503);
  });

  it('制限超過は 429', async () => {
    limitOk = false;
    expect((await get(`?visitorId=${V1}`)).status).toBe(429);
  });
});
