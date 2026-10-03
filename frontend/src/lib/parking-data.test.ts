import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CmsResult } from './cms';

const { findMany, findGlobal, getRequestPhase } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findGlobal: vi.fn(),
  getRequestPhase: vi.fn(),
}));

vi.mock('./cms', () => ({ cms: { findMany, findGlobal } }));
vi.mock('./request-phase', () => ({ getRequestPhase }));

import { getParkingResponse } from './parking-data';

const statusDoc = (
  id: number,
  lot: { id: number; name: string; sort?: number | null } | number | null,
  status: string | null = 'available',
) => ({
  id,
  lot,
  status: status as string | null,
  updatedAt: '2026-10-02T00:00:00.000Z',
  createdAt: '2026-10-02T00:00:00.000Z',
});
const lot = statusDoc(1, { id: 10, name: '第1駐車場', sort: 0 });
const networkError: CmsResult<never> = {
  ok: false,
  error: { kind: 'network', status: 500 },
};

const NOW = new Date('2026-11-14T03:00:00Z'); // JST 12:00
const meta = (day: string) => ({
  ok: true,
  value: {
    event_days: [
      { start_at: `${day}T10:00:00+09:00`, end_at: `${day}T17:00:00+09:00` },
    ],
  },
});
const onDay = meta('2026-11-14');
const otherDay = meta('2026-11-21');
const constant = { phase: 'pre_event', source: 'constant' };
const live = { phase: 'live', source: 'override' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  getRequestPhase.mockResolvedValue(constant);
  findGlobal.mockResolvedValue(onDay);
  findMany.mockResolvedValue({
    ok: true,
    value: { docs: [lot], totalDocs: 1 },
  });
});

describe('getParkingResponse', () => {
  it('当日は status と updatedAt を含め、lot 展開・100件・TTL20秒で取得する', async () => {
    const result = await getParkingResponse();
    expect(findMany).toHaveBeenCalledWith(
      'parking_statuses',
      { depth: 1, limit: 100 },
      { ttlSeconds: 20 },
    );
    expect(result).toEqual({
      ok: true,
      value: {
        isEventDay: true,
        lots: [
          {
            id: 1,
            name: '第1駐車場',
            status: 'available',
            updatedAt: '2026-10-02T00:00:00.000Z',
          },
        ],
        fetchedAt: NOW.toISOString(),
      },
    });
  });

  it('当日でなければ status と updatedAt を落として名称だけ返す', async () => {
    findGlobal.mockResolvedValue(otherDay);
    const result = await getParkingResponse();
    expect(result.ok && result.value).toEqual({
      isEventDay: false,
      lots: [{ id: 1, name: '第1駐車場', status: null, updatedAt: null }],
      fetchedAt: NOW.toISOString(),
    });
  });

  it('DEV_OVERRIDE の live Cookie なら当日でなくても当日扱いにする', async () => {
    findGlobal.mockResolvedValue(otherDay);
    getRequestPhase.mockResolvedValue(live);
    const result = await getParkingResponse();
    expect(result.ok && result.value.isEventDay).toBe(true);
    expect(result.ok && result.value.lots[0].status).toBe('available');
  });

  it('lot.sort 昇順 (null は末尾) に並べ、lot が null のものは除く', async () => {
    findMany.mockResolvedValue({
      ok: true,
      value: {
        docs: [
          statusDoc(1, { id: 10, name: 'C', sort: null }),
          statusDoc(2, { id: 11, name: 'B', sort: 2 }),
          statusDoc(3, null),
          statusDoc(4, { id: 12, name: 'A', sort: 1 }),
          statusDoc(5, 13),
        ],
        totalDocs: 5,
      },
    });
    const result = await getParkingResponse();
    expect(result.ok && result.value.lots.map((l) => l.name)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('status が未設定の行も含め、status と updatedAt は null にする', async () => {
    findMany.mockResolvedValue({
      ok: true,
      value: {
        docs: [lot, statusDoc(2, { id: 11, name: '第2駐車場', sort: 1 }, null)],
        totalDocs: 2,
      },
    });
    const result = await getParkingResponse();
    expect(result.ok && result.value.lots[1]).toEqual({
      id: 2,
      name: '第2駐車場',
      status: null,
      updatedAt: null,
    });
  });

  it('festival_meta の取得失敗は失敗として返す', async () => {
    findGlobal.mockResolvedValue(networkError);
    expect(await getParkingResponse()).toEqual(networkError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('parking_statuses の取得失敗は失敗として返す', async () => {
    findMany.mockResolvedValue(networkError);
    expect(await getParkingResponse()).toEqual(networkError);
  });
});
