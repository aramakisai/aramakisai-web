import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPinnedId, getPinState, pinSlide, reloadPin, subscribePin } from './useSignagePin';

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

describe('reloadPin', () => {
  it('購読者へ最新の固定状態を知らせる', async () => {
    vi.stubGlobal('fetch', respond(4));
    const listener = vi.fn();
    const off = subscribePin(listener);
    await vi.waitFor(() => expect(getPinnedId()).toBe(4));

    vi.stubGlobal('fetch', respond(null));
    listener.mockClear();
    await reloadPin();
    expect(getPinnedId()).toBeNull();
    expect(listener).toHaveBeenCalled();
    off();
  });
});

describe('pinSlide', () => {
  it('保存中は共有状態が保存中になり、失敗すると対象を覚える', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    const p = pinSlide(7);
    expect(getPinState().saving).toBe(true);
    await p;
    expect(getPinState()).toEqual({ saving: false, failedId: 7 });
  });

  it('保存中の再操作は無視する', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal('fetch', f);
    const p = pinSlide(1);
    await pinSlide(2);
    await p;
    expect(f).toHaveBeenCalledTimes(1);
    expect(getPinnedId()).toBe(1);
  });
});
