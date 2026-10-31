'use client';

import { useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';

// Chromium の既定のダブルタップ判定時間 (double_tap_timeout_in_ms)。
// この間に 2 回目のタップが来なければ単発のタップとして扱う
export const DOUBLE_TAP_TIMEOUT_MS = 400;

export function MapEmptyTap({ onTap }: { readonly onTap: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useMapEvents({
    // preclick はポリゴンやピン上のクリックでも出る。直前の空き地点タップを取り消し、新しい選択を消さない
    preclick: cancel,
    dblclick: cancel,
    click: (e) => {
      cancel();
      if (e.originalEvent.detail !== 1) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        onTapRef.current();
      }, DOUBLE_TAP_TIMEOUT_MS);
    },
  });
  useEffect(() => cancel, []);
  return null;
}
