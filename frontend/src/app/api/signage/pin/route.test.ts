import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/signage-data', () => ({ getPinState: vi.fn() }));

import { getPinState } from '@/lib/signage-data';
import { GET } from './route';

const mocked = vi.mocked(getPinState);

describe('GET /api/signage/pin', () => {
  beforeEach(() => mocked.mockReset());

  it('200 で固定状態をキャッシュ禁止で返す', async () => {
    const value = { serverNow: 'x', slide: null, visibleSlideIds: [1] };
    mocked.mockResolvedValue({ ok: true, value });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(value);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('取得失敗は 502 cms_unavailable', async () => {
    mocked.mockResolvedValue({
      ok: false,
      error: { kind: 'network', status: 500 },
    });
    const res = await GET();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'cms_unavailable' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
