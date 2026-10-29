'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { SignageOrientation } from '@/lib/signage';
import {
  nextTouchState,
  type TouchDestination,
  type TouchState,
} from '@/lib/signage-touch';

const TICK_MS = 1_000;
// タッチのスクロールは pointercancel で pointer 系が途切れ、wheel・touchmove だけが流れ続ける
export const IFRAME_EVENTS = [
  'pointerdown',
  'pointermove',
  'wheel',
  'touchmove',
  'input',
  'keydown',
] as const;

// iframe 内のタップは上位文書のルートへ伝わらないため、全画面化もここから呼ぶ。拒否されても無視する
function requestFullscreenIfNeeded() {
  if (document.fullscreenElement) return;
  void document.documentElement.requestFullscreen?.()?.catch(() => {});
}

export function useTouchSession({
  quakeActive,
  pinned = false,
}: {
  readonly quakeActive: boolean;
  readonly pinned?: boolean;
}) {
  const [state, dispatch] = useReducer(nextTouchState, {
    kind: 'closed',
  } as TouchState);
  const quakeRef = useRef(quakeActive);
  quakeRef.current = quakeActive;
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const detach = useRef<(() => void) | null>(null);

  const kind = state.kind;
  useEffect(() => {
    if (kind !== 'open') return;
    const id = setInterval(
      () => dispatch({ type: 'tick', at: Date.now() }),
      TICK_MS,
    );
    return () => clearInterval(id);
  }, [kind]);

  useEffect(() => {
    dispatch({ type: 'quake', active: quakeActive });
  }, [quakeActive]);

  useEffect(() => {
    if (pinned) dispatch({ type: 'pin' });
  }, [pinned]);

  const activity = useCallback(
    () => dispatch({ type: 'activity', at: Date.now() }),
    [],
  );

  const attachIframe = useCallback(
    (iframe: HTMLIFrameElement | null) => {
      detach.current?.();
      detach.current = null;
      const win = iframe?.contentWindow;
      if (!win) return;
      const listener = (e: Event) => {
        if (e.type === 'pointerdown') requestFullscreenIfNeeded();
        activity();
      };
      for (const t of IFRAME_EVENTS) win.addEventListener(t, listener, true);
      detach.current = () => {
        for (const t of IFRAME_EVENTS)
          win.removeEventListener(t, listener, true);
      };
    },
    [activity],
  );

  useEffect(() => () => detach.current?.(), []);

  return {
    state,
    tap: useCallback((orientation: SignageOrientation) => {
      requestFullscreenIfNeeded();
      if (quakeRef.current || pinnedRef.current) return;
      dispatch({ type: 'tap', at: Date.now(), orientation });
    }, []),
    select: useCallback(
      (destination: TouchDestination | null) =>
        dispatch({ type: 'select', destination, at: Date.now() }),
      [],
    ),
    back: useCallback(() => dispatch({ type: 'back' }), []),
    fadeEnd: useCallback(() => dispatch({ type: 'fadeEnd' }), []),
    activity,
    attachIframe,
  };
}

export type TouchSession = ReturnType<typeof useTouchSession>;
