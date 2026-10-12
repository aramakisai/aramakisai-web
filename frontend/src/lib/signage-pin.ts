import type { SignageSnapshot } from './signage';
import type { SignagePinPayload } from './signage-channel';

// slide: 有効な固定スライド(固定なし・無効・削除済みなら null)、visibleSlideIds: いま表示対象のスライドID(_order 順)
export interface SignagePinState extends SignagePinPayload {
  /** 応答を返す直前のサーバー時刻(ISO) */
  readonly serverNow: string;
}

// 配信経路で固定と表示対象を受けたら、古い可能性のあるスナップショットの pinnedSlideId と slides より優先する
export function withPin(
  snapshot: SignageSnapshot,
  pin: SignagePinPayload | undefined,
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
