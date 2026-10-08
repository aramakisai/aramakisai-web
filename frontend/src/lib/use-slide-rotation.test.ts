// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistEntry } from './signage';
import { reconcile, tick, useSlideRotation } from './use-slide-rotation';

function entry(id: number, page = 0, durationSec = 3): PlaylistEntry {
  return {
    key: `${id}:${page}`,
    page,
    slide: { id, durationSec, pinned: false, kind: 'parking' },
  };
}

const start = { key: null, index: 0, elapsed: 0 };

describe('reconcile', () => {
  it('空のリストでは何も選ばない', () => {
    expect(reconcile({ key: '1:0', index: 1, elapsed: 2 }, [])).toEqual(start);
  });

  it('初回は先頭を選ぶ', () => {
    expect(reconcile(start, [entry(1), entry(2)]).key).toBe('1:0');
  });

  it('現在の鍵が新しいリストにあれば位置が変わっても表示し続け経過時間を保つ', () => {
    const next = reconcile({ key: '2:0', index: 1, elapsed: 2 }, [
      entry(3),
      entry(1),
      entry(2),
    ]);
    expect(next).toEqual({ key: '2:0', index: 2, elapsed: 2 });
  });

  it('鍵が無ければ同じ位置(リスト長で剰余)から再開する', () => {
    const next = reconcile({ key: '9:0', index: 4, elapsed: 2 }, [
      entry(1),
      entry(2),
      entry(3),
    ]);
    expect(next).toEqual({ key: '2:0', index: 1, elapsed: 0 });
  });

  it('固定表示への切り替え(リストが1枚に絞られる)と解除に追従する', () => {
    const all = [entry(1), entry(2), entry(3)];
    const pinned = reconcile({ key: '1:0', index: 0, elapsed: 1 }, [entry(3)]);
    expect(pinned.key).toBe('3:0');
    expect(reconcile(pinned, all).key).toBe('3:0');
  });
});

describe('tick', () => {
  it('表示秒数に達するまで進まず、達したら次へ進む', () => {
    const list = [entry(1), entry(2)];
    let s = reconcile(start, list);
    s = tick(s, list);
    s = tick(s, list);
    expect(s.key).toBe('1:0');
    s = tick(s, list);
    expect(s).toEqual({ key: '2:0', index: 1, elapsed: 0 });
  });

  it('末尾の次は先頭に戻る', () => {
    const list = [entry(1, 0, 1), entry(2, 0, 1)];
    let s = reconcile(start, list);
    s = tick(s, list);
    s = tick(s, list);
    expect(s.key).toBe('1:0');
  });
});

describe('useSlideRotation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('1秒ごとに経過し、表示秒数後に次の項目を返す', () => {
    const list = [entry(1, 0, 2), entry(2, 0, 2)];
    const { result } = renderHook(() => useSlideRotation(list));
    expect(result.current?.key).toBe('1:0');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current?.key).toBe('2:0');
  });

  it('リストが空なら null', () => {
    const { result } = renderHook(() => useSlideRotation([]));
    expect(result.current).toBeNull();
  });
});
