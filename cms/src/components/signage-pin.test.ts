import { describe, expect, it, vi } from 'vitest';

import { fetchPinnedId, setPinnedId } from './signage-pin';

const res = (ok: boolean, body: unknown) => ({ ok, json: async () => body }) as Response;

describe('fetchPinnedId', () => {
  it('固定中ならそのID、解除済みなら null', async () => {
    expect(await fetchPinnedId(vi.fn().mockResolvedValue(res(true, { pinned_slide: 5 })))).toBe(5);
    expect(await fetchPinnedId(vi.fn().mockResolvedValue(res(true, { pinned_slide: null })))).toBeNull();
  });
  it('取得に失敗したら例外', async () => {
    await expect(fetchPinnedId(vi.fn().mockResolvedValue(res(false, {})))).rejects.toThrow();
  });
});

describe('setPinnedId', () => {
  it('固定は ID、解除は null を設定のグローバルへ書く', async () => {
    const f = vi.fn().mockResolvedValue(res(true, {}));
    await setPinnedId(7, f);
    await setPinnedId(null, f);
    expect(f.mock.calls[0][0]).toContain('/api/globals/signage_settings');
    expect(f.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ pinned_slide: 7 });
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ pinned_slide: null });
  });
  it('保存に失敗したら例外', async () => {
    await expect(setPinnedId(null, vi.fn().mockResolvedValue(res(false, {})))).rejects.toThrow();
  });
});
