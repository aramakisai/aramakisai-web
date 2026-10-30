'use client';

import { useRef, type ReactNode } from 'react';

/**
 * 横スクロールのコンテナ内では縦の sticky がページのスクロールに効かないため、
 * 見出しの行をコンテナの外に出して sticky にし、横位置だけを本体と同期させる。
 */
export function TimetableStickyScroller({
  heading,
  minWidth,
  children,
}: {
  readonly heading: ReactNode;
  readonly minWidth: number;
  readonly children: ReactNode;
}) {
  const headingRef = useRef<HTMLDivElement>(null);
  return (
    <div data-testid="timetable-grid">
      <div
        ref={headingRef}
        data-testid="timetable-sticky-heading"
        // z-20: 現在時刻の線 (z-10) とカードより上、サイトのヘッダー (z-50) より下。
        // top はヘッダーの高さ (lg: h-20 + border-b 1px)
        className="sticky top-[calc(81px+env(safe-area-inset-top))] z-20 overflow-hidden bg-background"
      >
        <div className="flex" style={{ minWidth }}>
          {heading}
        </div>
      </div>
      <div
        className="overflow-x-auto pb-5"
        onScroll={(e) => {
          if (headingRef.current) {
            headingRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
