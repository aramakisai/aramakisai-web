'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

type GestureHint = 'scroll' | 'touch';

// 再表示のたびにタイマーをリセットし、この時間操作が止まったら消す
const HINT_DURATION_MS = 1500;

const HINT_TEXT: Record<GestureHint, string> = {
  scroll: 'Ctrl キー (Mac は ⌘) を押しながらスクロールすると拡大縮小できます',
  touch: '2 本指で地図を操作できます',
};

/**
 * Google マップ風のジェスチャー制御。wheel 単体ではページスクロールを優先させ、
 * Ctrl/Cmd 併用時のみ地図側のズームを許可する (ズーム計算自体は Leaflet 本体に任せる)。
 *
 * wheel のリスナーは MapContainer のコンテナ要素ではなく、その親要素へ capture
 * 段階で付ける。DOM のイベント配送はディスパッチがそのノードに到達した時点で
 * リスナー一覧が確定する仕様のため、コンテナ自身に付けると、このイベント中に
 * enable した Leaflet 側のリスナーは同じイベントでは呼ばれず、最初の 1 ノッチが
 * 無視されてしまう。
 */
export function GestureHandling() {
  const map = useMap();
  const [hint, setHint] = useState<GestureHint | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = map.getContainer();
    const target = container.parentElement ?? container;

    const showHint = (next: GestureHint) => {
      setHint(next);
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        setHint(null);
      }, HINT_DURATION_MS);
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        map.scrollWheelZoom.enable();
        return;
      }
      map.scrollWheelZoom.disable();
      showHint('scroll');
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        showHint('touch');
      }
    };

    target.addEventListener('wheel', handleWheel, { capture: true });
    container.addEventListener('touchmove', handleTouchMove, {
      passive: true,
    });

    return () => {
      target.removeEventListener('wheel', handleWheel, { capture: true });
      container.removeEventListener('touchmove', handleTouchMove);
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [map]);

  return (
    <div
      role="status"
      hidden={hint === null}
      className={`pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center bg-black/50 px-4 text-center text-sm font-medium text-white transition-opacity ${
        hint === null ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {hint !== null ? HINT_TEXT[hint] : null}
    </div>
  );
}
