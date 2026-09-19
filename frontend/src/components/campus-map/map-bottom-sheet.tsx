'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { AreaExhibitionList } from './area-exhibition-list';
import type { AreaExhibitionListState } from './area-exhibition-list';

export interface MapBottomSheetProps {
  readonly state: AreaExhibitionListState;
  readonly notice?: string | null;
  /** シートの実高さ (px) が変わるたびに呼ばれる。地図側コントロールの余白追従に使う */
  readonly onHeightChange?: (height: number) => void;
}

// 0: 内容の高さに合わせて縮んだ状態 (条件なしのときのみ到達可能)
// 1: Figma の SP「エリア選択時」「検索結果」フレームが指定する 380px
// 2: 従来の展開時の値 55vh
type SnapIndex = 0 | 1 | 2;

const MID_SNAP_PX = 380;
const MAX_SNAP_VH = 55;
const SNAP_LABELS: Record<SnapIndex, string> = {
  0: '折りたたみ',
  1: '標準',
  2: '最大',
};

function maxSnapPx(): number {
  return (window.innerHeight * MAX_SNAP_VH) / 100;
}

// CSS の md: プレフィックスと aria-hidden / inert (CSS では表現できない) を同じ条件で
// 切り替えるため、Tailwind の既定ブレークポイントと同じクエリを JS 側でも評価する
function useIsAboveMapBreakpoint(): boolean {
  const [isAbove, setIsAbove] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsAbove(mql.matches);
    const handleChange = (event: MediaQueryListEvent) =>
      setIsAbove(event.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);
  return isAbove;
}

export function MapBottomSheet({
  state,
  notice,
  onHeightChange,
}: MapBottomSheetProps) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();
  // 独立した開閉状態は持たず、リストの表示状態からそのまま導く (design.md 参照)
  const collapsed = state.kind === 'unselected';
  // 企画リストを内容の高さまで縮めると意味のある「折りたたみ」にならないため、
  // 条件なし (collapsed) のときだけ 0 (折りたたみ) まで下げられるようにする
  const minSnapIndex: SnapIndex = collapsed ? 0 : 1;

  const [snapIndex, setSnapIndex] = useState<SnapIndex>(collapsed ? 0 : 1);
  const prevCollapsedRef = useRef(collapsed);
  useEffect(() => {
    if (prevCollapsedRef.current !== collapsed) {
      prevCollapsedRef.current = collapsed;
      setSnapIndex(collapsed ? 0 : 1);
    }
  }, [collapsed]);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startY: number;
    startHeight: number;
    minPx: number;
    maxPx: number;
  } | null>(null);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !onHeightChange || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      // contentRect は padding を含まないため、getBoundingClientRect (border-box) と
      // 初回呼び出し (下の el.getBoundingClientRect() 呼び出し) の基準を揃える
      const target = entries[0]?.target;
      if (target instanceof HTMLElement) {
        onHeightChange(target.getBoundingClientRect().height);
      }
    });
    observer.observe(el);
    onHeightChange(el.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = sheetRef.current;
    if (!el) return;
    // 折りたたみが無効な状態では scrollHeight を測っても無意味なので、その場合の
    // 下限は常に MID_SNAP_PX に固定する
    const minPx = minSnapIndex === 0 ? el.scrollHeight : MID_SNAP_PX;
    dragRef.current = {
      startY: event.clientY,
      startHeight: el.getBoundingClientRect().height,
      minPx,
      maxPx: maxSnapPx(),
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = sheetRef.current;
    if (!drag || !el) return;
    const draggedUpBy = drag.startY - event.clientY;
    const next = Math.min(
      drag.maxPx,
      Math.max(drag.minPx, drag.startHeight + draggedUpBy),
    );
    el.style.height = `${next}px`;
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = sheetRef.current;
    dragRef.current = null;
    if (!drag || !el) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const currentPx = el.getBoundingClientRect().height;
    // 以降の高さは snapIndex に応じた Tailwind クラスへ戻す
    el.style.height = '';

    const candidates: ReadonlyArray<readonly [SnapIndex, number]> =
      minSnapIndex === 0
        ? [
            [0, drag.minPx],
            [1, MID_SNAP_PX],
            [2, drag.maxPx],
          ]
        : [
            [1, MID_SNAP_PX],
            [2, drag.maxPx],
          ];
    let nearest: SnapIndex = minSnapIndex;
    let nearestDistance = Infinity;
    for (const [index, px] of candidates) {
      const distance = Math.abs(currentPx - px);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    }
    setSnapIndex(nearest);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSnapIndex((current) =>
        current >= 2 ? current : ((current + 1) as SnapIndex),
      );
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSnapIndex((current) =>
        current <= minSnapIndex ? current : ((current - 1) as SnapIndex),
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSnapIndex((current) =>
        current === minSnapIndex
          ? (Math.min(2, minSnapIndex + 1) as SnapIndex)
          : minSnapIndex,
      );
    }
  };

  const heightClassName =
    snapIndex === 0
      ? ''
      : snapIndex === 1
        ? 'h-[380px] overflow-y-auto'
        : 'h-[55vh] overflow-y-auto';

  return (
    // 高さが内容に応じて縮む (collapsed) 場合でも上限一杯 (expanded) の場合でも、
    // この外枠自体は下端に貼り付くだけで余白を持たないため地図を覆わない。
    // pointer-events-none はそれでも確実にするための保険
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1050] flex justify-center md:hidden"
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      <div
        ref={sheetRef}
        data-testid="map-bottom-sheet"
        className={`pointer-events-auto w-full max-w-2xl rounded-t-2xl bg-white p-4 shadow-xl ${heightClassName}`}
      >
        <div
          role="button"
          tabIndex={0}
          aria-expanded={snapIndex !== minSnapIndex}
          aria-label={`シートの高さを変更 (現在: ${SNAP_LABELS[snapIndex]})`}
          className="mb-3 flex touch-none cursor-grab items-center justify-center py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-gray-300"
          />
        </div>
        <AreaExhibitionList state={state} notice={notice} />
      </div>
    </div>
  );
}
