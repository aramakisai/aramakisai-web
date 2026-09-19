'use client';

import { useEffect, useState } from 'react';
import { AreaExhibitionList } from './area-exhibition-list';
import type { AreaExhibitionListState } from './area-exhibition-list';

export interface MapBottomSheetProps {
  readonly state: AreaExhibitionListState;
  readonly notice?: string | null;
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

export function MapBottomSheet({ state, notice }: MapBottomSheetProps) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();
  // 独立した開閉状態は持たず、リストの表示状態からそのまま導く (design.md 参照)
  const collapsed = state.kind === 'unselected';

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
        data-testid="map-bottom-sheet"
        className={`pointer-events-auto w-full max-w-2xl rounded-t-2xl bg-white p-4 shadow-xl ${
          collapsed ? '' : 'max-h-[55vh] overflow-y-auto'
        }`}
      >
        {/* ドラッグでの高さ変更は実装しない。視覚的な手掛かりとしてのみ置く (design.md 参照) */}
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300"
        />
        <AreaExhibitionList state={state} notice={notice} />
      </div>
    </div>
  );
}
