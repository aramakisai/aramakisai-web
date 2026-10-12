// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clockOffsetMs, useCorrectedNow } from './signage-time';

describe('clockOffsetMs', () => {
  it('往復時間の半分だけ進んだサーバー時刻と受信時刻の差を返す', () => {
    // 送信1000・受信1400(往復400)・serverNow=5000 → 受信時のサーバー時刻は5200
    expect(clockOffsetMs(new Date(5000).toISOString(), 1000, 1400)).toBe(3800);
  });

  it('端末が遅れていれば正、進んでいれば負', () => {
    expect(clockOffsetMs(new Date(2000).toISOString(), 1000, 1000)).toBe(1000);
    expect(clockOffsetMs(new Date(500).toISOString(), 1000, 1000)).toBe(-500);
  });
});

describe('useCorrectedNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('offsetがnullの間は初期時刻のまま', () => {
    vi.setSystemTime(10_000);
    const { result } = renderHook(() =>
      useCorrectedNow(null, new Date(1234).toISOString()),
    );
    expect(result.current.getTime()).toBe(1234);
  });

  it('補正済み時刻の秒の境目で更新される', () => {
    vi.setSystemTime(10_300);
    const { result } = renderHook(() =>
      useCorrectedNow(200, new Date(0).toISOString()),
    );
    expect(result.current.getTime()).toBe(10_500);
    act(() => vi.advanceTimersByTime(499));
    expect(result.current.getTime()).toBe(10_500);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.getTime()).toBe(11_000);
  });
});
