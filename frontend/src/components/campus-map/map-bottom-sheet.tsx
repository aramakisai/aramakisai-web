'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { AreaExhibitionList } from './area-exhibition-list';
import type { AreaExhibitionListState } from './area-exhibition-list';
import { useIsAboveMapBreakpoint } from './use-is-above-map-breakpoint';

export interface MapBottomSheetProps {
  readonly state: AreaExhibitionListState;
  readonly notice?: string | null;
  /** シートの実高さ (px) が変わるたびに呼ばれる。地図側コントロールの余白追従に使う */
  readonly onHeightChange?: (height: number) => void;
}

// 0: 内容の高さに合わせて縮んだ状態 (条件なしのときのみ到達可能)
// 1: Figma の SP「エリア選択時」「検索結果」フレームが指定する 380px
// 2: 従来の展開時の値 55vh
// 3: 全画面 (上端は safe-area を避ける)
type SnapIndex = 0 | 1 | 2 | 3;

const MID_SNAP_PX = 380;
const MAX_SNAP_VH = 55;
const SNAP_LABELS: Record<SnapIndex, string> = {
  0: '折りたたみ',
  1: '標準',
  2: '大',
  3: '全画面',
};
// 高さの遷移を成立させるため、スナップ先は常に数値を含む長さで持つ ('auto' のみ例外)
const SNAP_HEIGHTS: Record<SnapIndex, string> = {
  0: 'auto',
  1: `${MID_SNAP_PX}px`,
  2: `${MAX_SNAP_VH}vh`,
  3: 'calc(100dvh - env(safe-area-inset-top))',
};
// 離す直前にこの速さ (px/ms) 以上で動いていたらフリックとして扱う
const FLICK_VELOCITY = 0.5;
const FLICK_WINDOW_MS = 100;

function largeSnapPx(): number {
  return (window.innerHeight * MAX_SNAP_VH) / 100;
}
function fullSnapPx(): number {
  return window.innerHeight;
}

export function MapBottomSheet({
  state,
  notice,
  onHeightChange,
}: MapBottomSheetProps) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();
  // 独立した開閉状態は持たず、リストの表示状態からそのまま導く (design.md 参照)。
  // 実コンテンツを持つのは filtered のみで、それ以外 (unselected/no-area/error) は
  // 常に 1 行の案内だけなので折りたたんでよい
  const collapsed = state.kind !== 'filtered';
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
    samples: { t: number; y: number }[];
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
      maxPx: fullSnapPx(),
      samples: [{ t: performance.now(), y: event.clientY }],
    };
    // ドラッグ中は指に追従させるため遷移を切る
    el.style.transition = 'none';
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
    drag.samples.push({ t: performance.now(), y: event.clientY });
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = sheetRef.current;
    dragRef.current = null;
    if (!drag || !el) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const currentPx = el.getBoundingClientRect().height;

    const candidates: ReadonlyArray<readonly [SnapIndex, number]> = [
      ...(minSnapIndex === 0 ? [[0, drag.minPx] as const] : []),
      [1, MID_SNAP_PX],
      [2, largeSnapPx()],
      [3, fullSnapPx()],
    ];
    const now = performance.now();
    const recent = drag.samples.filter((p) => now - p.t <= FLICK_WINDOW_MS);
    const first = recent[0];
    const last = drag.samples[drag.samples.length - 1];
    const velocity =
      first && last && last.t > first.t
        ? (first.y - last.y) / (last.t - first.t) // 正: 上方向
        : 0;

    let target: SnapIndex | null = null;
    if (Math.abs(velocity) >= FLICK_VELOCITY) {
      const ahead = candidates
        .filter(([, px]) =>
          velocity > 0 ? px > currentPx + 1 : px < currentPx - 1,
        )
        .sort((a, b) => (velocity > 0 ? a[1] - b[1] : b[1] - a[1]));
      target = ahead[0]?.[0] ?? null;
    }
    if (target === null) {
      let nearestDistance = Infinity;
      target = minSnapIndex;
      for (const [index, px] of candidates) {
        const distance = Math.abs(currentPx - px);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          target = index;
        }
      }
    }

    // 遷移を戻した後に reflow を挟んでからスナップ先を与えないと、ドラッグ位置からの
    // アニメーションにならず即座にジャンプする
    el.style.transition = '';
    void el.offsetHeight;
    el.style.height = SNAP_HEIGHTS[target];
    setSnapIndex(target);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSnapIndex((current) =>
        current >= 3 ? current : ((current + 1) as SnapIndex),
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
          ? ((minSnapIndex + 1) as SnapIndex)
          : minSnapIndex,
      );
    }
  };

  return (
    // 高さが内容に応じて縮む (collapsed) 場合でも上限一杯 (expanded) の場合でも、
    // この外枠自体は下端に貼り付くだけで余白を持たないため地図を覆わない。
    // pointer-events-none はそれでも確実にするための保険
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 flex justify-center md:hidden ${snapIndex === 3 ? 'z-[1100]' : 'z-[1050]'}`}
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      <div
        ref={sheetRef}
        data-testid="map-bottom-sheet"
        // interpolate-size は 'auto' への/からの高さ遷移を許す (非対応ブラウザでは即時切替)
        className={`pointer-events-auto w-full max-w-2xl bg-white p-4 shadow-xl transition-[height] duration-300 ease-out [interpolate-size:allow-keywords] ${snapIndex === 3 ? '' : 'rounded-t-2xl'} ${snapIndex === 0 ? '' : 'overflow-y-auto'}`}
        style={{ height: SNAP_HEIGHTS[snapIndex] }}
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
