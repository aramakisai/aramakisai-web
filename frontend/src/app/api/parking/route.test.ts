import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/parking-data', () => ({ getParkingResponse: vi.fn() }));

import { getParkingResponse } from '@/lib/parking-data';
import { GET } from './route';

const mocked = vi.mocked(getParkingResponse);

describe('GET /api/parking', () => {
  beforeEach(() => mocked.mockReset());

  it('公開時は lots を 200 で返す', async () => {
    const value = {
      enabled: true as const,
      lots: [],
      fetchedAt: '2026-10-02T00:00:00.000Z',
    };
    mocked.mockResolvedValue({ ok: true, value });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(value);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('非公開時も 200 で enabled:false を返す', async () => {
    mocked.mockResolvedValue({ ok: true, value: { enabled: false } });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ enabled: false });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('CMS 取得失敗(festival_meta 含む)は 502', async () => {
    mocked.mockResolvedValue({
      ok: false,
      error: { kind: 'network' } as never,
    });
    const res = await GET();
    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
