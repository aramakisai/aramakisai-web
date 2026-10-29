import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addBookmark, MYPAGE_STORAGE_KEY } from './mypage-storage';
import { useMypageData } from './use-mypage-data';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('useMypageData', () => {
  it('データなしでは空のデータを返す', () => {
    const { result } = renderHook(() => useMypageData());
    expect(result.current).toEqual({
      version: 1,
      lists: { bookmarks: [] },
    });
  });

  it('同一タブの変更イベントで再描画する', () => {
    const { result } = renderHook(() => useMypageData());
    act(() => {
      addBookmark(1, 'exhibit');
    });
    expect(result.current).not.toBe('unavailable');
    expect(
      result.current !== null &&
        result.current !== 'unavailable' &&
        result.current.lists.bookmarks.map((b) => b.id),
    ).toEqual([1]);
  });

  it('storage イベントで再描画する', () => {
    const { result } = renderHook(() => useMypageData());
    act(() => {
      localStorage.setItem(
        MYPAGE_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          lists: {
            stamps: [],
            bookmarks: [{ id: 2, category: 'stage', savedAt: 'x' }],
          },
        }),
      );
      window.dispatchEvent(
        new StorageEvent('storage', { key: MYPAGE_STORAGE_KEY }),
      );
    });
    expect(
      result.current !== null &&
        result.current !== 'unavailable' &&
        result.current.lists.bookmarks.length,
    ).toBe(1);
  });

  it('同じ生文字列からは同じオブジェクトを返す', () => {
    addBookmark(1, 'exhibit');
    const { result, rerender } = renderHook(() => useMypageData());
    const first = result.current;
    rerender();
    act(() => {
      window.dispatchEvent(new Event('aramakisai:mypage-change'));
    });
    expect(result.current).toBe(first);
  });

  it('読み出し例外では unavailable を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useMypageData());
    expect(result.current).toBe('unavailable');
  });
});
