'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchPinnedId, setPinnedId } from './signage-pin';

// 帯・列・ボタンが同じ画面に並ぶため、状態はモジュールで共有して同時に更新する
let pinned: number | null | undefined; // undefined は読み込み前
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function reload() {
  try {
    pinned = await fetchPinnedId();
  } catch {
    // 取得失敗時は直前の状態を保つ
  }
  emit();
}

export function useSignagePin() {
  const [, rerender] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    if (pinned === undefined) void reload();
    return () => void listeners.delete(l);
  }, []);

  const pin = useCallback(async (id: number | null) => {
    setSaving(true);
    setError(false);
    try {
      await setPinnedId(id);
      pinned = id;
      emit();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }, []);

  return { pinnedId: pinned, saving, error, pin };
}
