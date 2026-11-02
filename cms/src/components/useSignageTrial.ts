'use client';

import { useEffect, useState } from 'react';

import type { TrialRunValue } from '../lib/signage-trial';
import { fetchTrial, saveTrial } from './signage-trial';

// パネル内の複数部品が同じ状態を見るため、useSignagePin と同じくモジュールで共有する
let trial: TrialRunValue | undefined; // undefined は読み込み前
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function reloadTrial() {
  try {
    trial = await fetchTrial();
  } catch {
    // 取得失敗時は直前の状態を保つ
  }
  emit();
}

export const getTrial = () => trial;

// 画面遷移ではモジュールが残るため、画面に入るたびに読み直して他の担当者の変更を拾う
export function subscribeTrial(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) void reloadTrial();
  return () => void listeners.delete(listener);
}

// 保存中は操作を止め、POST の並行による応答順の逆転を防ぐ
let saving = false;
let failed = false;

export const getTrialState = () => ({ saving, failed });

async function save(startAt: string | null) {
  if (saving) return;
  saving = true;
  failed = false;
  emit();
  try {
    trial = await saveTrial(startAt);
  } catch {
    failed = true;
  } finally {
    saving = false;
    emit();
  }
}

export const startTrial = (startAt: string) => save(startAt);
export const stopTrial = () => save(null);

export function useSignageTrial() {
  const [, rerender] = useState(0);
  useEffect(() => subscribeTrial(() => rerender((n) => n + 1)), []);
  return { trial, saving, failed, start: startTrial, stop: stopTrial };
}
