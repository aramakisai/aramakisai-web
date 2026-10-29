import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createStampRepository, type StampD1 } from './stamp-db';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const T0 = new Date('2026-11-01T01:00:00.000Z');
const T1 = new Date('2026-11-01T02:00:00.000Z');
const T2 = new Date('2026-11-01T03:00:00.000Z');

const migration = readFileSync(
  join(__dirname, '../../migrations/0001_stamp_rally.sql'),
  'utf8',
);

let dir: string;
let dispose: () => Promise<void>;
let db: StampD1;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'stamp-db-'));
  const config = join(dir, 'wrangler.toml');
  writeFileSync(
    config,
    `name = "t"\ncompatibility_date = "2026-01-01"\n[[d1_databases]]\nbinding = "STAMP_DB"\ndatabase_name = "t"\ndatabase_id = "00000000-0000-0000-0000-000000000000"\n`,
  );
  const proxy = await getPlatformProxy<{ STAMP_DB: StampD1 }>({
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

beforeEach(async () => {
  await db.prepare('DROP TABLE IF EXISTS stamps').run();
  await db.prepare('DROP TABLE IF EXISTS exchanges').run();
  for (const stmt of migration
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    await db.prepare(stmt).run();
  }
});

describe('migration', () => {
  it('同じ組の 2 回目の挿入と同じ匿名IDの有効な交換済み 2 件目を拒否する', async () => {
    const stamp = db.prepare(
      "INSERT INTO stamps VALUES (?, 1, 'exhibit', 'x')",
    );
    await stamp.bind(V1).run();
    await expect(stamp.bind(V1).run()).rejects.toThrow();
    const ex = db.prepare(
      "INSERT INTO exchanges (visitor_id, exchanged_at, exchanged_by) VALUES (?, 'x', 's')",
    );
    await ex.bind(V1).run();
    await expect(ex.bind(V1).run()).rejects.toThrow();
  });
});

describe('recordStamp', () => {
  it('新規は added、同じ組の再送は exists', async () => {
    const repo = createStampRepository(db);
    const a = await repo.recordStamp(V1, 1, 'exhibit', T0);
    expect(a).toMatchObject({ ok: true, value: 'added' });
    const b = await repo.recordStamp(V1, 1, 'exhibit', T1);
    expect(b).toMatchObject({ ok: true, value: 'exists' });
    expect(a.ok && a.usage.rowsWritten).toBeGreaterThan(0);
    expect(a.usage.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('D1 の失敗は例外にせず ok:false', async () => {
    await db.prepare('DROP TABLE stamps').run();
    const r = await createStampRepository(db).recordStamp(V1, 1, 'exhibit', T0);
    expect(r.ok).toBe(false);
  });
});

describe('listStamps / getVisitorRecord / loadAllRecords', () => {
  it('匿名IDごとの記録を返し、集計は全件を返す', async () => {
    const repo = createStampRepository(db);
    await repo.recordStamp(V1, 1, 'exhibit', T0);
    await repo.recordStamp(V1, 2, 'vendor', T1);
    await repo.recordStamp(V2, 1, 'exhibit', T1);
    await repo.registerExchange(V1, 'a', T2);

    const list = await repo.listStamps(V1);
    expect(list.ok && list.value).toEqual([
      { exhibitionId: 1, category: 'exhibit', acquiredAt: T0.toISOString() },
      { exhibitionId: 2, category: 'vendor', acquiredAt: T1.toISOString() },
    ]);

    const rec = await repo.getVisitorRecord(V1);
    expect(rec.ok && rec.value.stamps).toHaveLength(2);
    expect(rec.ok && rec.value.activeExchange?.exchangedBy).toBe('a');
    const none = await repo.getVisitorRecord(V2);
    expect(none.ok && none.value.activeExchange).toBeNull();

    const all = await repo.loadAllRecords();
    expect(all.ok && all.value.stamps).toHaveLength(3);
    expect(all.ok && all.value.activeExchangeCount).toBe(1);
  });
});

describe('exchanges', () => {
  it('同時 2 件の登録で 1 件だけ成立する', async () => {
    const repo = createStampRepository(db);
    const [a, b] = await Promise.all([
      repo.registerExchange(V1, 'a', T0),
      repo.registerExchange(V1, 'b', T0),
    ]);
    const kinds = [a, b].map((r) => (r.ok ? r.value.kind : 'fail')).sort();
    expect(kinds).toEqual(['already', 'registered']);
    const ids = [a, b].map((r) => r.ok && r.value.exchange.exchangeId);
    expect(ids[0]).toBe(ids[1]);
  });

  it('取り消し後の再登録は新しい行になる', async () => {
    const repo = createStampRepository(db);
    const first = await repo.registerExchange(V1, 'a', T0);
    if (!first.ok) throw new Error('x');
    const id = first.value.exchange.exchangeId;
    const c = await repo.cancelExchange(id, 'b', T1);
    expect(c.ok && c.value).toMatchObject({
      kind: 'cancelled',
      exchange: { cancelledAt: T1.toISOString(), cancelledBy: 'b' },
    });
    const second = await repo.registerExchange(V1, 'c', T2);
    expect(second.ok && second.value.kind).toBe('registered');
    expect(second.ok && second.value.exchange.exchangeId).not.toBe(id);
  });

  it('取り消し済みの再取り消しは既存の取り消し日時を返し、無い id は not_found', async () => {
    const repo = createStampRepository(db);
    const r = await repo.registerExchange(V1, 'a', T0);
    if (!r.ok) throw new Error('x');
    const id = r.value.exchange.exchangeId;
    await repo.cancelExchange(id, 'b', T1);
    const again = await repo.cancelExchange(id, 'z', T2);
    expect(again.ok && again.value).toMatchObject({
      kind: 'already',
      exchange: { cancelledAt: T1.toISOString(), cancelledBy: 'b' },
    });
    const nf = await repo.cancelExchange(9999, 'z', T2);
    expect(nf.ok && nf.value).toEqual({ kind: 'not_found' });
  });

  it('listExchanges は交換日時の新しい順', async () => {
    const repo = createStampRepository(db);
    await repo.registerExchange(V1, 'a', T0);
    await repo.registerExchange(V2, 'a', T2);
    const l = await repo.listExchanges();
    expect(l.ok && l.value.map((e) => e.visitorId)).toEqual([V2, V1]);
  });
});
