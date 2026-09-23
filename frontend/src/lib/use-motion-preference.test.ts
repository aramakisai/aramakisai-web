import { createElement, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

/** matchMedia を指定した一致結果でスタブする。テストごとに後始末する */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeEventListener: (
      _: string,
      cb: (event: MediaQueryListEvent) => void,
    ) => listeners.delete(cb),
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
  return {
    mql,
    fireChange(next: boolean) {
      mql.matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
  };
}

// 状態はモジュールレベルの共有ストアに乗っているため、モジュールを使い回すと
// テスト間で reduced 値が漏れる。phase.test.ts / middleware.test.ts と同じく
// vi.resetModules() + 動的 import でテストごとに新しいストアにする。
beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-motion');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useMotionPreference', () => {
  test('初期値は保存が無いときの OS 設定に従う (要件 21.7)', async () => {
    stubMatchMedia(true);
    const { useMotionPreference } = await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current.reduced).toBe(true);
  });

  test('OS 設定が reduce でも保存値が no-preference なら reduce のままにする (要件 21.4)', async () => {
    // 「無効化」の保存値は OS の reduce 要求を上書きしない (いずれか一方でも
    // 停止を求めていれば停止する)。
    stubMatchMedia(true);
    const { MOTION_STORAGE_KEY, useMotionPreference } =
      await import('./use-motion-preference');
    window.localStorage.setItem(MOTION_STORAGE_KEY, 'no-preference');
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current.reduced).toBe(true);
  });

  test('toggle で反転し、localStorage へ保存する (要件 21.6)', async () => {
    stubMatchMedia(false);
    const { MOTION_STORAGE_KEY, useMotionPreference } =
      await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference());

    act(() => result.current.toggle());

    expect(result.current.reduced).toBe(true);
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('reduce');

    act(() => result.current.toggle());

    expect(result.current.reduced).toBe(false);
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe(
      'no-preference',
    );
  });

  test('reduced の値をルート要素の data-motion へ反映する (要件 21.4, 21.8)', async () => {
    stubMatchMedia(false);
    const { useMotionPreference } = await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference());

    expect(document.documentElement.getAttribute('data-motion')).toBeNull();

    act(() => result.current.toggle());
    expect(document.documentElement.getAttribute('data-motion')).toBe('reduce');

    act(() => result.current.toggle());
    expect(document.documentElement.getAttribute('data-motion')).toBeNull();
  });

  test('保存済みの選択が無いとき、OS 設定の変更に追従する', async () => {
    const { fireChange } = stubMatchMedia(false);
    const { useMotionPreference } = await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current.reduced).toBe(false);

    act(() => fireChange(true));
    expect(result.current.reduced).toBe(true);
  });

  test('toggle で明示的に停止を選んだ後、OS 設定が変わっても値が変わらない', async () => {
    const { fireChange } = stubMatchMedia(false);
    const { useMotionPreference } = await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference());

    act(() => result.current.toggle());
    expect(result.current.reduced).toBe(true);

    act(() => fireChange(true));
    expect(result.current.reduced).toBe(true);
    act(() => fireChange(false));
    // OS が no-preference に戻っても、保存済みの reduce 選択がある限り true のまま
    expect(result.current.reduced).toBe(true);
  });

  test('localStorage.getItem が例外を投げても OS 設定にフォールバックする', async () => {
    stubMatchMedia(true);
    vi.spyOn(window.localStorage.__proto__, 'getItem').mockImplementation(
      () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    );
    const { useMotionPreference } = await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference());
    expect(result.current.reduced).toBe(true);
  });

  test('localStorage.setItem が例外を投げても toggle 自体は失敗しない', async () => {
    stubMatchMedia(false);
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(
      () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    );
    const { useMotionPreference } = await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference());

    expect(() => act(() => result.current.toggle())).not.toThrow();
    expect(result.current.reduced).toBe(true);
  });

  test('StrictMode の二重実行でも toggle 後の保存値は一貫する', async () => {
    stubMatchMedia(false);
    const { MOTION_STORAGE_KEY, useMotionPreference } =
      await import('./use-motion-preference');
    const { result } = renderHook(() => useMotionPreference(), {
      wrapper: StrictMode,
    });

    act(() => result.current.toggle());

    expect(result.current.reduced).toBe(true);
    expect(window.localStorage.getItem(MOTION_STORAGE_KEY)).toBe('reduce');
  });

  test('SSR の初回描画 (常に false) を hydration でも引き継ぎ、警告を出さない (要件 21.7)', async () => {
    // OS 設定が reduce でも、SSR の出力は常に false になる (window に触れられ
    // ないため)。hydration 時の最初のレンダーがこれと食い違うと React が
    // hydration mismatch を警告する。
    stubMatchMedia(true);
    const { useMotionPreference } = await import('./use-motion-preference');

    function Probe() {
      const { reduced } = useMotionPreference();
      return createElement('div', null, String(reduced));
    }

    const html = renderToString(createElement(Probe));
    expect(html).toContain('false');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      hydrateRoot(container, createElement(Probe));
    });

    const hydrationWarnings = errorSpy.mock.calls.filter((call) =>
      String(call[0]).match(/hydrat/i),
    );
    expect(hydrationWarnings).toHaveLength(0);
    // マウント後の effect で OS 設定 (reduce) に基づく値へ確定する
    expect(container.textContent).toBe('true');

    document.body.removeChild(container);
  });
});
