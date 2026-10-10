import { useRef } from 'react';
import type { SignageSlide, SignageSnapshot } from './signage';
import { usePolling } from './use-polling';

export interface SignagePinState {
  /** 応答を返す直前のサーバー時刻(ISO) */
  readonly serverNow: string;
  /** 有効な固定スライド。固定なし・無効・削除済みなら null */
  readonly slide: SignageSlide | null;
  /** いま表示対象のスライドID。_order 順 */
  readonly visibleSlideIds: readonly number[];
}

export const PIN_POLL_INTERVAL_MS = 3000;

// 確認が一度でも成功したら、最大35秒古いスナップショットの pinnedSlideId と slides より確認結果を優先する
export function withPin(
  snapshot: SignageSnapshot,
  pin: SignagePinState | undefined,
): SignageSnapshot {
  if (!pin) return snapshot;
  const { slide } = pin;
  const visible = new Set(pin.visibleSlideIds);
  const slides = snapshot.slides.filter((s) => visible.has(s.id));
  if (!slide) return { ...snapshot, pinnedSlideId: null, slides };
  const exists = slides.some((s) => s.id === slide.id);
  return {
    ...snapshot,
    pinnedSlideId: slide.id,
    slides: exists
      ? slides.map((s) => (s.id === slide.id ? slide : s))
      : [...slides, slide],
  };
}

/** 表示対象なのにスナップショットに中身が無いスライドID。あれば取り直しが要る */
export function missingSlideIds(
  snapshot: SignageSnapshot,
  pin: SignagePinState | undefined,
): readonly number[] {
  if (!pin) return [];
  const have = new Set(snapshot.slides.map((s) => s.id));
  return pin.visibleSlideIds.filter((id) => !have.has(id));
}

export function usePinnedSlide(
  onSample: (serverNow: string, sentAtMs: number, receivedAtMs: number) => void,
): SignagePinState | undefined {
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;
  const { data } = usePolling<SignagePinState>({
    fetcher: async () => {
      const sentAt = Date.now();
      const res = await fetch('/api/signage/pin', { cache: 'no-store' });
      const receivedAt = Date.now();
      if (!res.ok) throw new Error(`signage pin ${res.status}`);
      const state = (await res.json()) as SignagePinState;
      onSampleRef.current(state.serverNow, sentAt, receivedAt);
      return state;
    },
    intervalMs: PIN_POLL_INTERVAL_MS,
    immediate: true,
    initial: null,
  });
  return data ?? undefined;
}
