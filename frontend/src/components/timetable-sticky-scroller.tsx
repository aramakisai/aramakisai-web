'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { stickyOffset } from '@/lib/sticky-offset';

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
  const rootRef = useRef<HTMLDivElement>(null);
  const updateRef = useRef<() => void>(() => {});

  // 本体は overflow-x-auto の中で CSS の sticky が縦スクロールに効かないため、カードの中身は JS で動かす
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = rootRef.current;
      const head = headingRef.current;
      if (!root || !head) return;
      const limitTop = head.getBoundingClientRect().bottom;
      for (const content of root.querySelectorAll<HTMLElement>(
        '[data-sticky-content]',
      )) {
        const card = content.parentElement;
        if (!card) continue;
        const offset = stickyOffset(
          card.getBoundingClientRect().top + card.clientTop,
          card.clientHeight,
          content.getBoundingClientRect().height,
          limitTop,
        );
        content.style.transform = offset ? `translateY(${offset}px)` : '';
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    updateRef.current = schedule;
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  // 日の切り替えなどでカードが入れ替わったとき
  useEffect(() => updateRef.current());

  return (
    <div ref={rootRef} data-testid="timetable-grid">
      <div
        ref={headingRef}
        data-testid="timetable-sticky-heading"
        // 塗り (bg-background) は時刻の列の上に出さないためステージ列側が持つ。
        // z-20: 現在時刻の線 (z-10) とカードより上、サイトのヘッダー (z-50) より下。
        // top はヘッダーの高さ (lg: h-20 + border-b 1px)
        className="sticky top-[calc(81px+env(safe-area-inset-top))] z-20 overflow-hidden"
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
