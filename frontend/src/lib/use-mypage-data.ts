'use client';

import { useMemo, useSyncExternalStore } from 'react';
import {
  MYPAGE_CHANGE_EVENT,
  MYPAGE_STORAGE_KEY,
  parseMypageData,
  readMypageRaw,
  type MypageData,
} from './mypage-storage';

/** null はサーバー描画・ハイドレーション中で未確定 */
export type MypageSnapshot = MypageData | 'unavailable' | null;

// 'unavailable' / null(データなし) と衝突しない、サーバー側専用の未確定値
const PENDING = Symbol('pending');
type RawSnapshot = ReturnType<typeof readMypageRaw> | typeof PENDING;

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === MYPAGE_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(MYPAGE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(MYPAGE_CHANGE_EVENT, onChange);
  };
}

export function useMypageData(): MypageSnapshot {
  const raw = useSyncExternalStore<RawSnapshot>(
    subscribe,
    readMypageRaw,
    () => PENDING,
  );
  // 毎回新しい MypageData を返すと参照比較する利用側の再描画が止まらない
  return useMemo(() => {
    if (raw === PENDING) return null;
    if (raw === 'unavailable') return 'unavailable';
    return parseMypageData(raw);
  }, [raw]);
}
