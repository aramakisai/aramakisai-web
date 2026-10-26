// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IFRAME_EVENTS, useTouchSession } from './use-touch-session';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const setup = (quakeActive = false) =>
  renderHook(({ q }) => useTouchSession({ quakeActive: q }), {
    initialProps: { q: quakeActive },
  });

function fakeFrame() {
  const listeners: Record<string, EventListener> = {};
  const win = {
    addEventListener: vi.fn((t: string, l: EventListener) => {
      listeners[t] = l;
    }),
    removeEventListener: vi.fn(),
  };
  const iframe = { contentWindow: win } as unknown as HTMLIFrameElement;
  return { iframe, win, listeners };
}

it('閉じている間はタイマーを持たない', () => {
  setup();
  expect(vi.getTimerCount()).toBe(0);
});

it('タップで開き、無操作60秒で閉じるフェードに入る', () => {
  const { result } = setup();
  act(() => result.current.tap('landscape'));
  expect(result.current.state.kind).toBe('open');
  act(() => vi.advanceTimersByTime(59_000));
  expect(result.current.state.kind).toBe('open');
  act(() => vi.advanceTimersByTime(1_000));
  expect(result.current.state.kind).toBe('closing');
  act(() => result.current.fadeEnd());
  expect(result.current.state.kind).toBe('closed');
  expect(vi.getTimerCount()).toBe(0);
});

it('縦置きのタップでは開かない', () => {
  const { result } = setup();
  act(() => result.current.tap('portrait'));
  expect(result.current.state.kind).toBe('closed');
});

it('操作で計測が0に戻る', () => {
  const { result } = setup();
  act(() => result.current.tap('landscape'));
  act(() => vi.advanceTimersByTime(50_000));
  act(() => result.current.activity());
  act(() => vi.advanceTimersByTime(50_000));
  expect(result.current.state.kind).toBe('open');
  act(() => vi.advanceTimersByTime(10_000));
  expect(result.current.state.kind).toBe('closing');
});

it('iframe内の操作で計測が0に戻る', () => {
  const { result } = setup();
  const f = fakeFrame();
  act(() => result.current.tap('landscape'));
  act(() => result.current.attachIframe(f.iframe));
  expect(f.win.addEventListener).toHaveBeenCalledWith(
    'pointerdown',
    expect.any(Function),
    true,
  );
  act(() => vi.advanceTimersByTime(50_000));
  for (const t of ['input', 'keydown']) {
    act(() => f.listeners[t]!(new Event(t)));
    act(() => vi.advanceTimersByTime(50_000));
    expect(result.current.state.kind).toBe('open');
  }
});

it('iframe内のスクロール・ドラッグ(ホイール・touchmove・pointermove)でも計測が0に戻る', () => {
  const { result } = setup();
  const f = fakeFrame();
  act(() => result.current.tap('landscape'));
  act(() => result.current.attachIframe(f.iframe));
  for (const t of ['wheel', 'touchmove', 'pointermove']) {
    act(() => vi.advanceTimersByTime(50_000));
    act(() => f.listeners[t]!(new Event(t)));
    expect(result.current.state.kind).toBe('open');
  }
});

it('iframeの再読み込みで前のリスナーを外して付け直す', () => {
  const { result } = setup();
  const a = fakeFrame();
  const b = fakeFrame();
  act(() => result.current.attachIframe(a.iframe));
  act(() => result.current.attachIframe(b.iframe));
  expect(a.win.removeEventListener).toHaveBeenCalledTimes(IFRAME_EVENTS.length);
  expect(b.win.addEventListener).toHaveBeenCalledTimes(IFRAME_EVENTS.length);
});

it('iframe内のタップは全画面でなければ全画面化を呼ぶ', () => {
  const request = vi.fn(() => Promise.reject(new Error('denied')));
  document.documentElement.requestFullscreen = request;
  const { result } = setup();
  const f = fakeFrame();
  act(() => result.current.attachIframe(f.iframe));
  act(() => f.listeners.pointerdown!(new Event('pointerdown')));
  expect(request).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: document.documentElement,
  });
  act(() => f.listeners.pointerdown!(new Event('pointerdown')));
  expect(request).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    value: null,
  });
});

it('速報中は時計が止まり、解除で閉じるフェードに入る', () => {
  const { result, rerender } = setup();
  act(() => result.current.tap('landscape'));
  rerender({ q: true });
  expect(result.current.state.kind).toBe('quakeHeld');
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(300_000));
  expect(result.current.state.kind).toBe('quakeHeld');
  rerender({ q: false });
  expect(result.current.state.kind).toBe('closing');
});

it('速報中のタップでは開かない', () => {
  const { result } = setup(true);
  act(() => result.current.tap('landscape'));
  expect(result.current.state.kind).toBe('closed');
});

it('行き先選択と戻る', () => {
  const { result } = setup();
  act(() => result.current.tap('landscape'));
  act(() => result.current.select('map'));
  expect(result.current.state).toMatchObject({ destination: 'map' });
  act(() => result.current.select(null));
  expect(result.current.state).toMatchObject({ destination: null });
  act(() => result.current.back());
  expect(result.current.state.kind).toBe('closing');
});
