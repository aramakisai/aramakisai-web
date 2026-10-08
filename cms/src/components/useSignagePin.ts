'use client';

import { useEffect, useState } from 'react';

import { fetchPinnedId, setPinnedId } from './signage-pin';

// 帯・列・ボタンが同じ画面に並ぶため、状態はモジュールで共有して同時に更新する
let pinned: number | null | undefined; // undefined は読み込み前
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function reloadPin() {
  try {
    pinned = await fetchPinnedId();
  } catch {
    // 取得失敗時は直前の状態を保つ
  }
  emit();
}

export const getPinnedId = () => pinned;

// 画面遷移ではモジュールが残るため、画面に入るたびに読み直して他の担当者の変更を拾う
export function subscribePin(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) void reloadPin();
  return () => void listeners.delete(listener);
}

// 保存中は全操作部品を止め、POST の並行による応答順の逆転を防ぐ
let saving = false;
let failedId: number | null | undefined; // 直近の保存失敗の対象。成功・再試行で消える

export const getPinState = () => ({ saving, failedId });

export async function pinSlide(id: number | null) {
  if (saving) return;
  saving = true;
  failedId = undefined;
  emit();
  try {
    await setPinnedId(id);
    pinned = id;
  } catch {
    failedId = id;
  } finally {
    saving = false;
    emit();
  }
}

export function useSignagePin() {
  const [, rerender] = useState(0);
  useEffect(() => subscribePin(() => rerender((n) => n + 1)), []);
  return { pinnedId: pinned, saving, failedId, pin: pinSlide };
}
