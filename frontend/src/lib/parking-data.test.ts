import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CmsResult } from './cms';

const findMany = vi.fn();
const getParkingEnabled = vi.fn();

vi.mock('./cms', () => ({ cms: { findMany } }));
vi.mock('./festival-meta', () => ({ getParkingEnabled }));

const loadWith = async (override: boolean) => {
  vi.resetModules();
  vi.doMock('@/lib/phase', () => ({ DEV_OVERRIDE_ENABLED: override }));
  vi.doMock('./phase', () => ({ DEV_OVERRIDE_ENABLED: override }));
  return (await import('./parking-data')).getParkingResponse;
};

const statusDoc = (
  id: number,
  lot: { id: number; name: string; sort?: number | null } | number | null,
) => ({
  id,
  lot,
  status: 'available',
  updatedAt: '2026-10-02T00:00:00.000Z',
  createdAt: '2026-10-02T00:00:00.000Z',
});
const lot = statusDoc(1, { id: 10, name: '第1駐車場', sort: 0 });
const networkError: CmsResult<never> = {
  ok: false,
  error: { kind: 'network', status: 500 },
};

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue({
    ok: true,
    value: { docs: [lot], totalDocs: 1 },
  });
});

describe('getParkingResponse の公開判定', () => {
  it.each([
    { enabled: false, override: false, expected: false },
    { enabled: true, override: false, expected: true },
    { enabled: false, override: true, expected: true },
    { enabled: true, override: true, expected: true },
  ])(
    'parking_enabled=$enabled DEV_OVERRIDE=$override なら公開=$expected',
    async ({ enabled, override, expected }) => {
      getParkingEnabled.mockResolvedValue({ ok: true, value: enabled });
      const result = await (await loadWith(override))();
      expect(result.ok && result.value.enabled).toBe(expected);
    },
  );
});

describe('getParkingResponse', () => {
  it('非公開なら駐車場一覧を取得しない', async () => {
    getParkingEnabled.mockResolvedValue({ ok: true, value: false });
    const result = await (await loadWith(false))();
    expect(result).toEqual({ ok: true, value: { enabled: false } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('公開時は lot 展開・100件・TTL20秒で取得し、取得時刻を添える', async () => {
    getParkingEnabled.mockResolvedValue({ ok: true, value: true });
    const result = await (await loadWith(false))();
    expect(findMany).toHaveBeenCalledWith(
      'parking_statuses',
      { depth: 1, limit: 100 },
      { ttlSeconds: 20 },
    );
    expect(result.ok && result.value.enabled && result.value.lots).toEqual([
      {
        id: 1,
        name: '第1駐車場',
        status: 'available',
        updatedAt: '2026-10-02T00:00:00.000Z',
      },
    ]);
    expect(
      result.ok &&
        result.value.enabled &&
        Number.isNaN(Date.parse(result.value.fetchedAt)),
    ).toBe(false);
  });

  it('lot.sort 昇順 (null は末尾) に並べ、lot が null のものは除く', async () => {
    getParkingEnabled.mockResolvedValue({ ok: true, value: true });
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
    const result = await (await loadWith(false))();
    expect(
      result.ok &&
        result.value.enabled &&
        result.value.lots.map((l) => l.name),
    ).toEqual(['A', 'B', 'C']);
  });

  it('festival_meta の取得失敗は失敗として返す', async () => {
    getParkingEnabled.mockResolvedValue(networkError);
    expect(await (await loadWith(false))()).toEqual(networkError);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('DEV_OVERRIDE 有効でも festival_meta は読み、失敗なら失敗として返す', async () => {
    getParkingEnabled.mockResolvedValue(networkError);
    expect(await (await loadWith(true))()).toEqual(networkError);
  });

  it('parking_statuses の取得失敗は失敗として返す', async () => {
    getParkingEnabled.mockResolvedValue({ ok: true, value: true });
    findMany.mockResolvedValue(networkError);
    expect(await (await loadWith(false))()).toEqual(networkError);
  });
});
