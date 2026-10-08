import { useEffect, useRef, useState } from 'react';
import type { PlaylistEntry } from './signage';

export interface RotationState {
  readonly key: string | null;
  readonly index: number;
  readonly elapsed: number;
}

const EMPTY: RotationState = { key: null, index: 0, elapsed: 0 };

/** 再生リストの更新後も、現在の鍵が残っていればその項目を続けて表示する */
export function reconcile(
  state: RotationState,
  entries: readonly PlaylistEntry[],
): RotationState {
  if (entries.length === 0) return EMPTY;
  const found = entries.findIndex((e) => e.key === state.key);
  if (found >= 0) return { ...state, index: found };
  const index = state.index % entries.length;
  return { key: entries[index].key, index, elapsed: 0 };
}

/** 1秒進める。表示秒数に達したら次へ、末尾の次は先頭へ */
export function tick(
  state: RotationState,
  entries: readonly PlaylistEntry[],
): RotationState {
  const current = reconcile(state, entries);
  if (entries.length === 0) return current;
  const elapsed = current.elapsed + 1;
  if (elapsed < entries[current.index].slide.durationSec) {
    return { ...current, elapsed };
  }
  const index = (current.index + 1) % entries.length;
  return { key: entries[index].key, index, elapsed: 0 };
}

export function useSlideRotation(
  entries: readonly PlaylistEntry[],
): PlaylistEntry | null {
  const [state, setState] = useState<RotationState>(EMPTY);
  // 再生リストは分が変わるたびに作り直されるため、タイマーを張り直さず ref 経由で読む
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  });

  useEffect(() => {
    const id = setInterval(
      () => setState((s) => tick(s, entriesRef.current)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const view = reconcile(state, entries);
  return view.key === null ? null : entries[view.index];
}
