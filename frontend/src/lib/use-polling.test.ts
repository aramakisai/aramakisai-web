// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePolling } from './use-polling';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('usePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => vi.useRealTimers());

  it('間隔ごとに再取得して data を更新する', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(3);
    const { result } = renderHook(() =>
      usePolling({ fetcher, intervalMs: 1000, initial: 1 }),
    );
    expect(result.current).toEqual({ data: 1, error: false });
    await advance(1000);
    expect(result.current.data).toBe(2);
    await advance(1000);
    expect(result.current.data).toBe(3);
  });

  it('タブ非表示中は取得せず、表示に戻ると直ちに1回取得する', async () => {
    const fetcher = vi.fn().mockResolvedValue(9);
    renderHook(() => usePolling({ fetcher, intervalMs: 1000, initial: 1 }));
    setVisibility('hidden');
    await advance(5000);
    expect(fetcher).not.toHaveBeenCalled();
    setVisibility('visible');
    await advance(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('失敗時は直前の data を保持して error を立て、次の間隔で回復する', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce(5);
    const { result } = renderHook(() =>
      usePolling({ fetcher, intervalMs: 1000, initial: 1 }),
    );
    await advance(1000);
    expect(result.current).toEqual({ data: 1, error: true });
    await advance(1000);
    expect(result.current).toEqual({ data: 5, error: false });
  });

  it('initial が null のまま失敗しても null を保ち、成功で回復する', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce(7);
    const { result } = renderHook(() =>
      usePolling<number>({ fetcher, intervalMs: 1000, initial: null }),
    );
    await advance(1000);
    expect(result.current).toEqual({ data: null, error: true });
    await advance(1000);
    expect(result.current).toEqual({ data: 7, error: false });
  });

  it('shouldContinue が偽を返すと以降は再取得せず、表示復帰でも再開しない', async () => {
    const fetcher = vi.fn().mockResolvedValue({ enabled: false });
    const { result } = renderHook(() =>
      usePolling({
        fetcher,
        intervalMs: 1000,
        initial: { enabled: true },
        shouldContinue: (r) => r.enabled,
      }),
    );
    await advance(1000);
    expect(result.current.data).toEqual({ enabled: false });
    await advance(5000);
    setVisibility('hidden');
    setVisibility('visible');
    await advance(5000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('応答待ちの間は次を予約せず取得が重ならない', async () => {
    let resolve!: (v: number) => void;
    const fetcher = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    renderHook(() => usePolling({ fetcher, intervalMs: 1000, initial: 1 }));
    await advance(5000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    resolve(2);
    await advance(1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('非表示中に返った古い応答は捨てる', async () => {
    let resolve!: (v: number) => void;
    const fetcher = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const { result } = renderHook(() =>
      usePolling({ fetcher, intervalMs: 1000, initial: 1 }),
    );
    await advance(1000);
    setVisibility('hidden');
    resolve(99);
    await advance(0);
    expect(result.current.data).toBe(1);
  });

  it('アンマウントでタイマーを解除する', async () => {
    const fetcher = vi.fn().mockResolvedValue(2);
    const { unmount } = renderHook(() =>
      usePolling({ fetcher, intervalMs: 1000, initial: 1 }),
    );
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    setVisibility('hidden');
    setVisibility('visible');
    await advance(5000);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
