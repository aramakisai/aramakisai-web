// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignageBroadcast } from './signage-channel';
import { useSignageChannel, useSignageFeature } from './use-signage-channel';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: { kind: string; id: number }[] = [];
  closed = false;
  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop() {
    this.onclose?.();
  }
}

const T0 = Date.parse('2026-10-24T00:00:00.000Z');
const last = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
const count = () => FakeWebSocket.instances.length;

function pinBroadcast(
  over: Partial<SignageBroadcast> = {},
  ids: number[] = [1],
): SignageBroadcast {
  return {
    kind: 'broadcast',
    feature: 'pin',
    payload: { slide: null, visibleSlideIds: ids },
    expiresAt: null,
    sentAt: new Date(T0).toISOString(),
    ...over,
  } as SignageBroadcast;
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

// 乱数を 0.5 に固定すると ±20% の揺らぎが 0 になり、待ちが基準値そのままになる
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSignageChannel', () => {
  it('同じホストの /api/signage/ws へ1本だけ接続し、開いた直後に ping を送る', () => {
    renderHook(() => useSignageChannel());
    expect(count()).toBe(1);
    expect(last().url).toBe(`ws://${location.host}/api/signage/ws`);
    act(() => last().open());
    expect(last().sent).toEqual([{ kind: 'ping', id: 1 }]);
  });

  it('5秒ごとに ping を送る', () => {
    renderHook(() => useSignageChannel());
    const ws = last();
    act(() => ws.open());
    act(() => {
      ws.receive({
        kind: 'pong',
        id: 1,
        serverNow: new Date(T0).toISOString(),
      });
      vi.advanceTimersByTime(5000);
    });
    expect(ws.sent.map((m) => m.id)).toEqual([1, 2]);
  });

  it('pong の serverNow と RTT/2 から時刻のずれを更新する', () => {
    const { result } = renderHook(() => useSignageChannel());
    const ws = last();
    act(() => ws.open());
    expect(result.current.offsetMs).toBeNull();
    act(() => {
      vi.advanceTimersByTime(200);
      // 端末時計 T0+200 で受信、サーバーは T0+1100 + RTT/2(100) → ずれ +1000
      ws.receive({
        kind: 'pong',
        id: 1,
        serverNow: new Date(T0 + 1000).toISOString(),
      });
    });
    expect(result.current.offsetMs).toBe(900);
  });

  it('pong が5秒以内に来なければ切断して接続し直す', () => {
    renderHook(() => useSignageChannel());
    const first = last();
    act(() => first.open());
    act(() => vi.advanceTimersByTime(4999));
    expect(first.closed).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(first.closed).toBe(true);
    expect(count()).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(count()).toBe(2);
  });

  it('再接続の待ちは倍々で最大30秒になり、pong で1秒に戻る', () => {
    renderHook(() => useSignageChannel());
    const waits = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    for (const [i, wait] of waits.entries()) {
      act(() => last().drop());
      act(() => vi.advanceTimersByTime(wait - 1));
      expect(count()).toBe(i + 1);
      act(() => vi.advanceTimersByTime(1));
      expect(count()).toBe(i + 2);
    }
    const ws = last();
    act(() => ws.open());
    act(() =>
      ws.receive({
        kind: 'pong',
        id: 1,
        serverNow: new Date(T0).toISOString(),
      }),
    );
    act(() => ws.drop());
    const before = count();
    act(() => vi.advanceTimersByTime(999));
    expect(count()).toBe(before);
    act(() => vi.advanceTimersByTime(1));
    expect(count()).toBe(before + 1);
  });

  it('再接続の待ちに±20%の乱数を掛ける', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderHook(() => useSignageChannel());
    act(() => last().drop());
    act(() => vi.advanceTimersByTime(799));
    expect(count()).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(count()).toBe(2);
  });

  it('online イベントで再接続の待ちを打ち切る', () => {
    renderHook(() => useSignageChannel());
    act(() => last().drop());
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(count()).toBe(2);
    act(() => vi.advanceTimersByTime(30000));
    expect(count()).toBe(2);
  });

  it('非表示で閉じ、表示に戻ったらすぐ接続する', () => {
    renderHook(() => useSignageChannel());
    const first = last();
    act(() => first.open());
    act(() => setVisibility('hidden'));
    expect(first.closed).toBe(true);
    act(() => vi.advanceTimersByTime(60000));
    expect(count()).toBe(1);
    act(() => setVisibility('visible'));
    expect(count()).toBe(2);
  });

  it('古い接続からの受信は捨てる', () => {
    const { result } = renderHook(() => useSignageChannel());
    const old = last();
    act(() => old.drop());
    act(() => vi.advanceTimersByTime(1000));
    act(() => old.receive(pinBroadcast()));
    expect(result.current.pin).toBeUndefined();
  });

  it('broadcast を機能ごとに保持し、pin と版を取り出す', () => {
    const { result } = renderHook(() => useSignageChannel());
    act(() => last().open());
    act(() => {
      last().receive(pinBroadcast({}, [3, 4]));
      last().receive({
        kind: 'broadcast',
        feature: 'snapshot',
        payload: { version: 42 },
        expiresAt: null,
        sentAt: new Date(T0).toISOString(),
      });
    });
    expect(result.current.pin?.visibleSlideIds).toEqual([3, 4]);
    expect(result.current.snapshotVersion).toBe(42);
  });

  it('形の合わない受信は捨てる', () => {
    const { result } = renderHook(() => useSignageChannel());
    act(() => {
      last().onmessage?.({ data: 'not json' });
      last().receive({ kind: 'nope' });
    });
    expect(result.current.latest).toEqual({});
  });

  it('期限切れの broadcast は受信時に捨てる', () => {
    const { result } = renderHook(() => useSignageChannel());
    act(() =>
      last().receive(
        pinBroadcast({ expiresAt: new Date(T0 - 1).toISOString() }),
      ),
    );
    expect(result.current.pin).toBeUndefined();
  });

  it('切断中も最後の固定・表示対象・ずれ・版を返し続ける', () => {
    const { result } = renderHook(() => useSignageChannel());
    act(() => last().open());
    act(() => {
      last().receive(pinBroadcast({}, [7]));
      last().receive({
        kind: 'pong',
        id: 1,
        serverNow: new Date(T0).toISOString(),
      });
    });
    const snapshot = result.current;
    act(() => last().drop());
    act(() => vi.advanceTimersByTime(60000));
    expect(result.current.pin).toEqual(snapshot.pin);
    expect(result.current.offsetMs).toBe(snapshot.offsetMs);
  });

  it('アンマウントで接続とタイマーを片付ける', () => {
    const { unmount } = renderHook(() => useSignageChannel());
    const ws = last();
    act(() => ws.open());
    unmount();
    expect(ws.closed).toBe(true);
    act(() => vi.advanceTimersByTime(60000));
    expect(count()).toBe(1);
  });
});

describe('useSignageFeature', () => {
  it('期限内ならその payload、期限後は undefined を返す', () => {
    const { result } = renderHook(() => useSignageChannel());
    act(() =>
      last().receive(
        pinBroadcast({ expiresAt: new Date(T0 + 1000).toISOString() }, [9]),
      ),
    );
    expect(
      useSignageFeature(result.current, 'pin', new Date(T0 + 999))
        ?.visibleSlideIds,
    ).toEqual([9]);
    expect(
      useSignageFeature(result.current, 'pin', new Date(T0 + 1000)),
    ).toBeUndefined();
    expect(
      useSignageFeature(result.current, 'snapshot', new Date(T0)),
    ).toBeUndefined();
  });
});
