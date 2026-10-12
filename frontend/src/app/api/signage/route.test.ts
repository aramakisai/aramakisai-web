import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/signage-data', () => ({ getSignageSnapshot: vi.fn() }));

import { getSignageSnapshot } from '@/lib/signage-data';
import { GET } from './route';

const mocked = vi.mocked(getSignageSnapshot);

describe('GET /api/signage', () => {
  beforeEach(() => mocked.mockReset());

  it('200 でスナップショットをキャッシュ禁止で返す', async () => {
    const value = { fetchedAt: 'x' } as never;
    mocked.mockResolvedValue({ ok: true, value });
    const res = await GET(new Request('http://x/api/signage'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(value);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('取得失敗は 502 cms_unavailable', async () => {
    mocked.mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    });
    const res = await GET(new Request('http://x/api/signage'));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'cms_unavailable' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['', undefined],
    ['?v=1760000000000', 1760000000000],
    ['?v=0', undefined],
    ['?v=-5', undefined],
    ['?v=1.5', undefined],
    ['?v=abc', undefined],
    ['?v=99999999999999999999', undefined],
  ])('クエリ %s は版 %s として取得する', async (qs, version) => {
    mocked.mockResolvedValue({ ok: true, value: {} as never });
    await GET(new Request(`http://x/api/signage${qs}`));
    expect(mocked).toHaveBeenCalledWith({ version });
  });
});
