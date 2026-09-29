import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './use-now';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T03:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('マウント直後に端末の現在時刻へ切り替わる', () => {
    const { result } = renderHook(() => useNow('2026-11-14T00:00:00.000Z'));
    expect(result.current.toISOString()).toBe('2026-11-14T03:00:00.000Z');
  });

  it('時刻を進めると1分以内に値が更新される', () => {
    const { result } = renderHook(() => useNow('2026-11-14T00:00:00.000Z'));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.toISOString()).toBe('2026-11-14T03:01:00.000Z');
  });

  it('アンマウント後は更新されない', () => {
    const { unmount } = renderHook(() => useNow('2026-11-14T00:00:00.000Z'));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
