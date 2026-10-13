import { useSyncExternalStore } from 'react';
import {
  PHASE_OVERRIDE_COOKIE,
  resolvePhase,
  type ResolvedPhase,
} from '@/lib/phase';

const listeners = new Set<() => void>();

// ルートレイアウトで cookies() を呼ぶと ISR 対象ページが静的生成できず 500 になるため、
// フェーズ上書きはクライアントで Cookie から読む。サーバー描画と初回 hydration は
// 定数フェーズ (BUILD_PHASE) で、マウント後に上書きへ切り替わる
function readCookie(): string | undefined {
  const prefix = `${PHASE_OVERRIDE_COOKIE}=`;
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** document.cookie の変更は通知が来ないため、書き込み側がこれを呼ぶ。 */
export function notifyPhaseChanged(): void {
  listeners.forEach((listener) => listener());
}

export function usePhase(): ResolvedPhase {
  return resolvePhase(
    useSyncExternalStore(subscribe, readCookie, () => undefined),
  );
}
