'use client';

import { useEffect, useState } from 'react';

import { fetchGroups, fetchSlideCount, setGroupVisible, sortAllFirst, type SignageGroup } from './signage-groups';
import { reloadPin } from './useSignagePin';

// グループ切り替え・所属グループ列・固定の操作部品が同じ画面に並ぶため、状態はモジュールで共有する
let groups: SignageGroup[] | undefined; // undefined は読み込み前
let total = 0;
let saving = false;
let failedId: number | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getGroupsState = () => ({ groups, total, saving, failedId });

export async function reloadGroups() {
  try {
    const [g, n] = await Promise.all([fetchGroups(), fetchSlideCount()]);
    groups = sortAllFirst(g);
    total = n;
  } catch {
    // 取得失敗時は直前の状態を保つ
  }
  emit();
}

// 画面遷移ではモジュールが残るため、画面に入るたびに読み直して他の担当者の変更を拾う
export function subscribeGroups(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) void reloadGroups();
  return () => void listeners.delete(listener);
}

export async function toggleGroup(id: number, visible: boolean) {
  if (saving) return;
  saving = true;
  failedId = undefined;
  emit();
  try {
    const updated = await setGroupVisible(id, visible);
    groups = groups?.map((g) => (g.id === id ? updated : g));
    // グループの afterChange が固定を外し得る
    await reloadPin();
  } catch {
    failedId = id;
  } finally {
    saving = false;
    emit();
  }
}

export function useSignageGroups() {
  const [, rerender] = useState(0);
  useEffect(() => subscribeGroups(() => rerender((n) => n + 1)), []);
  return { groups, total, saving, failedId, toggle: toggleGroup };
}
