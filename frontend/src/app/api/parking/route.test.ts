import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/parking-data', () => ({ getParkingResponse: vi.fn() }));

import { getParkingResponse } from '@/lib/parking-data';
import { GET } from './route';

const mocked = vi.mocked(getParkingResponse);

describe('GET /api/parking', () => {
  beforeEach(() => mocked.mockReset());

  it.each([true, false])(
    'isEventDay=%s でも 200 で本文をそのまま返す',
    async (isEventDay) => {
      const value = {
        isEventDay,
        lots: [],
        fetchedAt: '2026-10-02T00:00:00.000Z',
      };
      mocked.mockResolvedValue({ ok: true, value });
      const res = await GET();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(value);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
    },
  );

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
