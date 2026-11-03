// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTouchClockShift } from './use-touch-clock-shift';

const parent = {} as Window;
function send(init: { origin?: string; source?: unknown; data: unknown }) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: init.data,
        origin: init.origin ?? window.location.origin,
        source: (init.source ?? parent) as MessageEventSource,
      }),
    );
  });
}
const msg = (trialShiftMs: number | null) => ({
  type: 'signage-touch-clock',
  trialShiftMs,
});

afterEach(() => vi.restoreAllMocks());

it('親からのずれ量を受け、null で戻る', () => {
  vi.spyOn(window, 'parent', 'get').mockReturnValue(parent);
  const { result } = renderHook(() => useTouchClockShift());
  expect(result.current).toBeNull();
  send({ data: msg(5000) });
  expect(result.current).toBe(5000);
  send({ data: msg(null) });
  expect(result.current).toBeNull();
});

it('別オリジン・別ウィンドウ・不正な形の知らせを捨てる', () => {
  vi.spyOn(window, 'parent', 'get').mockReturnValue(parent);
  const { result } = renderHook(() => useTouchClockShift());
  send({ origin: 'https://evil.example', data: msg(1) });
  send({ source: {} as Window, data: msg(2) });
  send({ data: { type: 'signage-touch-clock', trialShiftMs: '3' } });
  expect(result.current).toBeNull();
});

it('iframe でなければ自分宛ての知らせも捨てる', () => {
  const { result } = renderHook(() => useTouchClockShift());
  send({ source: window, data: msg(1) });
  expect(result.current).toBeNull();
});
