import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPinnedId, subscribePin } from './useSignagePin';

const respond = (pinned: number | null) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ pinned_slide: pinned }) } as Response);

afterEach(() => vi.unstubAllGlobals());

describe('subscribePin', () => {
  it('画面に入り直すたびに最新の固定状態を読み直す', async () => {
    vi.stubGlobal('fetch', respond(3));
    const off = subscribePin(() => {});
    await vi.waitFor(() => expect(getPinnedId()).toBe(3));
    off();

    vi.stubGlobal('fetch', respond(null));
    const off2 = subscribePin(() => {});
    await vi.waitFor(() => expect(getPinnedId()).toBeNull());
    off2();
  });

  it('同じ画面の2つ目以降の購読では読み直さない', async () => {
    const f = respond(1);
    vi.stubGlobal('fetch', f);
    const off = subscribePin(() => {});
    const off2 = subscribePin(() => {});
    await vi.waitFor(() => expect(getPinnedId()).toBe(1));
    expect(f).toHaveBeenCalledTimes(1);
    off();
    off2();
  });
});
