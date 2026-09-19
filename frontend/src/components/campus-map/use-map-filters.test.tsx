import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CampusMapFilters } from '@/lib/campus-map';
import { useMapFilters } from './use-map-filters';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  },
}));

function baseFilters(
  overrides: Partial<CampusMapFilters> = {},
): CampusMapFilters {
  return { q: '', categories: [], selectedAreaId: null, ...overrides };
}

describe('useMapFilters', () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/map');
    pushStateSpy = vi.spyOn(window.history, 'pushState');
  });

  afterEach(() => {
    vi.useRealTimers();
    pushStateSpy.mockRestore();
  });

  test('エリア選択は即座に履歴 API で URL を更新する', () => {
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.selectArea(3));

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/map?area=3',
    );
    expect(result.current.filters.selectedAreaId).toBe(3);
  });

  test('カテゴリ変更は即座に履歴 API で URL を更新する', () => {
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.setCategories(['stage']));

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/map?category=stage',
    );
  });

  test('キーワード入力は状態へ即時反映するが URL 更新はデバウンスする', () => {
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.setKeywordInput('ロボット'));

    // 入力欄への応答性のため即時反映 (要件 4.5)
    expect(result.current.keywordInput).toBe('ロボット');
    // URL への反映と絞り込みの適用は遅らせる (要件 4.6)
    expect(result.current.filters.q).toBe('');
    expect(pushStateSpy).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith(
      expect.anything(),
      '',
      '/map?q=%E3%83%AD%E3%83%9C%E3%83%83%E3%83%88',
    );
    expect(result.current.filters.q).toBe('ロボット');
  });

  test('1 文字ごとに履歴を積まず、確定後の値のみ 1 エントリとして積む', () => {
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.setKeywordInput('ろ'));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.setKeywordInput('ろぼ'));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.setKeywordInput('ろぼっと'));
    act(() => vi.advanceTimersByTime(300));

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(result.current.filters.q).toBe('ろぼっと');
  });

  test('エリア選択の直後にキーワードのデバウンスが確定しても選択中エリアを保つ', () => {
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.selectArea(7));
    act(() => result.current.setKeywordInput('x'));
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.filters).toEqual(
      baseFilters({ selectedAreaId: 7, q: 'x' }),
    );
  });

  test('絞り込みの適用はネットワークリクエストを発生させない (History API のみを使う)', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.selectArea(1));
    act(() => result.current.setCategories(['stage']));
    act(() => result.current.setKeywordInput('a'));
    act(() => vi.advanceTimersByTime(300));

    // 履歴の書き換えは pushState のみで完結し、ページ遷移 (fetch) を伴わない
    expect(pushStateSpy).toHaveBeenCalledTimes(3);
    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  test('戻る操作 (popstate) で URL 側の変化を状態へ反映する', () => {
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.selectArea(1));
    act(() => result.current.selectArea(2));
    expect(result.current.filters.selectedAreaId).toBe(2);

    act(() => {
      // 戻る操作でブラウザが選択前の URL に遷移した状態を模す
      window.history.pushState(null, '', '/map?area=1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.filters.selectedAreaId).toBe(1);
    expect(result.current.keywordInput).toBe('');
  });

  test('popstate はデバウンス中のキーワード確定を上書きしない', () => {
    const { result } = renderHook(() => useMapFilters(baseFilters()));

    act(() => result.current.setKeywordInput('保留中'));

    act(() => {
      window.history.pushState(null, '', '/map');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    pushStateSpy.mockClear();

    // popstate 時点で保留中のデバウンスは破棄され、以後タイマーが進んでも URL は更新されない
    act(() => vi.advanceTimersByTime(300));
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(result.current.filters.q).toBe('');
  });
});
