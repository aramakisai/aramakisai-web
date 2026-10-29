import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const h = vi.hoisted(() => ({
  env: null as Record<string, unknown> | null,
  forbidden: false,
  cards: [] as unknown[],
  catalogFails: false,
  points: [] as { blobs?: string[] }[],
}));
vi.mock('@/lib/cloudflare-env', () => ({
  readStampEnv: async () =>
    h.env ? { ok: true, env: h.env } : { ok: false, missing: ['STAMP_ENV'] },
}));
vi.mock('@/lib/exhibitions', () => ({
  getExhibitionCatalog: async () => {
    if (h.catalogFails) throw new Error('cms down');
    return { cards: h.cards, areas: [] };
  },
}));
vi.mock('@/lib/staff-auth', async (orig) => {
  const actual = await orig<typeof import('@/lib/staff-auth')>();
  return {
    ...actual,
    requireStaff: (...a: Parameters<typeof actual.requireStaff>) =>
      h.forbidden
        ? Promise.resolve({ kind: 'forbidden' as const })
        : actual.requireStaff(...a),
  };
});

import { issueStaffSession } from '@/lib/staff-session';
import { POST as cancel } from './[exchangeId]/cancel/route';
import { POST as register } from './route';

const SECRET = 'test-secret-0123456789-0123456789'; // gitleaks:allow
const V1 = '11111111-1111-4111-8111-111111111111';
const migration = readFileSync(
  join(__dirname, '../../../../../migrations/0001_stamp_rally.sql'),
  'utf8',
);

let dir: string;
let dispose: () => Promise<void>;
let db: {
  prepare(s: string): {
    bind(...v: unknown[]): { run(): Promise<unknown> };
    run(): Promise<unknown>;
  };
};

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'staff-api-'));
  const config = join(dir, 'wrangler.toml');
  writeFileSync(
    config,
    `name = "t"\ncompatibility_date = "2026-01-01"\n[[d1_databases]]\nbinding = "STAMP_DB"\ndatabase_name = "t"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\n`,
  );
  const proxy = await getPlatformProxy<{ STAMP_DB: typeof db }>({
    configPath: config,
    persist: false,
  });
  db = proxy.env.STAMP_DB;
  dispose = proxy.dispose;
}, 60_000);
afterAll(async () => {
  await dispose?.();
  rmSync(dir, { recursive: true, force: true });
});

const card = (id: number) => ({
  id,
  category: 'exhibit',
  displayName: `e${id}`,
  areaIds: [],
});

beforeEach(async () => {
  await db.prepare('DROP TABLE IF EXISTS stamps').run();
  await db.prepare('DROP TABLE IF EXISTS exchanges').run();
  for (const s of migration
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean))
    await db.prepare(s).run();
  h.points = [];
  h.forbidden = false;
  h.catalogFails = false;
  h.cards = [card(1), card(2)];
  h.env = {
    STAMP_DB: db,
    STAMP_METRICS: {
      writeDataPoint: (p: { blobs?: string[] }) => h.points.push(p),
    },
    STAMP_SIGNING_SECRET: SECRET,
    STAMP_ENV: 'preview',
  };
});

const addStamp = (id: number) =>
  db
    .prepare("INSERT INTO stamps VALUES (?, ?, 'exhibit', 'x')")
    .bind(V1, id)
    .run();
const completeVisitor = async () => {
  await addStamp(1);
  await addStamp(2);
};

const req = (
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(url, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { origin: 'http://localhost', ...headers },
  });
const reg = (
  body: unknown = { visitorId: V1 },
  headers?: Record<string, string>,
) => register(req('http://localhost/api/staff/exchanges', body, headers));
const can = (id: string) =>
  cancel(req(`http://localhost/api/staff/exchanges/${id}/cancel`), {
    params: Promise.resolve({ exchangeId: id }),
  });

describe('POST /api/staff/exchanges', () => {
  it('未ログインは 401、ロール不足は 403、記録は増えない', async () => {
    h.env!.STAMP_ENV = 'prod';
    await completeVisitor();
    expect((await reg()).status).toBe(401);
    h.forbidden = true;
    expect((await reg()).status).toBe(403);
    h.forbidden = false;
    h.env!.STAMP_ENV = 'preview';
    expect(((await (await reg()).json()) as { kind: string }).kind).toBe(
      'registered',
    );
  });

  it('ログイン済みなら担当者のメールを記録する', async () => {
    h.env!.STAMP_ENV = 'prod';
    await completeVisitor();
    const cookie = await issueStaffSession(
      SECRET,
      { subject: 's', email: 'a@example.com' },
      new Date(),
    );
    const res = await reg(
      { visitorId: V1 },
      { cookie: `aramakisai_staff=${cookie}` },
    );
    const j = (await res.json()) as { exchange: { exchangedBy: string } };
    expect(j.exchange.exchangedBy).toBe('a@example.com');
  });

  it('Origin が自サイトでなければ 403', async () => {
    await completeVisitor();
    expect(
      (await reg({ visitorId: V1 }, { origin: 'https://evil.example' })).status,
    ).toBe(403);
  });

  it('対象が揃っていなければ 409 で登録しない', async () => {
    await addStamp(1);
    const res = await reg();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ kind: 'not_eligible' });
    h.cards = [card(1)];
    expect(((await (await reg()).json()) as { kind: string }).kind).toBe(
      'registered',
    );
  });

  it('二重登録は既存を返し、取り消し後は新規登録になる', async () => {
    await completeVisitor();
    const a = (await (await reg()).json()) as {
      kind: string;
      exchange: { exchangeId: number };
    };
    expect(a.kind).toBe('registered');
    const b = (await (await reg()).json()) as typeof a;
    expect(b.kind).toBe('already');
    expect(b.exchange.exchangeId).toBe(a.exchange.exchangeId);

    const c = await can(String(a.exchange.exchangeId));
    expect(((await c.json()) as { kind: string }).kind).toBe('cancelled');
    const d = (await (await reg()).json()) as typeof a;
    expect(d.kind).toBe('registered');
    expect(d.exchange.exchangeId).not.toBe(a.exchange.exchangeId);
  });

  it('不正な匿名ID・JSON は 400、カタログ取得失敗は 503', async () => {
    expect((await reg({ visitorId: 'x' })).status).toBe(400);
    expect(
      (
        await register(
          new Request('http://localhost/api/staff/exchanges', {
            method: 'POST',
            body: '{',
            headers: { origin: 'http://localhost' },
          }),
        )
      ).status,
    ).toBe(400);
    await completeVisitor();
    h.catalogFails = true;
    expect((await reg()).status).toBe(503);
  });

  it('計測が 1 リクエストにつき 1 点書かれる', async () => {
    await completeVisitor();
    await reg();
    expect(h.points).toHaveLength(1);
    expect(h.points[0].blobs).toEqual([
      'preview',
      'staff_register',
      'registered',
      '200',
      '',
      '',
    ]);
  });
});

describe('POST /api/staff/exchanges/{id}/cancel', () => {
  it('未ログイン 401、存在しない・不正な ID は 404、取り消し済みは既存を返す', async () => {
    h.env!.STAMP_ENV = 'prod';
    expect((await can('1')).status).toBe(401);
    h.env!.STAMP_ENV = 'preview';
    expect((await can('999')).status).toBe(404);
    expect((await can('abc')).status).toBe(404);

    await completeVisitor();
    const a = (await (await reg()).json()) as {
      exchange: { exchangeId: number };
    };
    const id = String(a.exchange.exchangeId);
    await can(id);
    const again = (await (await can(id)).json()) as {
      kind: string;
      exchange: { cancelledBy: string };
    };
    expect(again.kind).toBe('already');
    expect(again.exchange.cancelledBy).toBe('preview');
  });
});
