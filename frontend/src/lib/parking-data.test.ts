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

const lot = {
  id: 1,
  name: '第1駐車場',
  status: 'available',
  sort: 0,
  updatedAt: '2026-10-02T00:00:00.000Z',
  createdAt: '2026-10-02T00:00:00.000Z',
};
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

  it('公開時は sort 昇順・100件・TTL20秒で取得し、取得時刻を添える', async () => {
    getParkingEnabled.mockResolvedValue({ ok: true, value: true });
    const result = await (await loadWith(false))();
    expect(findMany).toHaveBeenCalledWith(
      'parking_lots',
      { sort: ['sort'], limit: 100 },
      { ttlSeconds: 20 },
    );
    expect(result.ok && result.value.enabled && result.value.lots).toEqual([
      lot,
    ]);
    expect(
      result.ok &&
        result.value.enabled &&
        Number.isNaN(Date.parse(result.value.fetchedAt)),
    ).toBe(false);
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

  it('parking_lots の取得失敗は失敗として返す', async () => {
    getParkingEnabled.mockResolvedValue({ ok: true, value: true });
    findMany.mockResolvedValue(networkError);
    expect(await (await loadWith(false))()).toEqual(networkError);
  });
});
