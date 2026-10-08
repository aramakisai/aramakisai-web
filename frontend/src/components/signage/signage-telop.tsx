'use client';

import { useEffect, useRef, useState } from 'react';
import type { SignageTelopItem } from '@/lib/signage';
import { nextTelopIndex, telopPlan } from '@/lib/signage-telop';

export interface SignageTelopProps {
  readonly items: readonly SignageTelopItem[];
}

function chipLabel(item: SignageTelopItem): string {
  return item.audience === 'visitor'
    ? 'ご来場のみなさまへ'
    : (item.target ?? '参加団体へ');
}

export function SignageTelop({ items }: SignageTelopProps) {
  const [{ index, tick }, setPos] = useState({ index: 0, tick: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const count = items.length;
  const item = items[index < count ? index : 0];
  const itemKey = item ? `${item.id}:${tick}` : null;

  useEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (itemKey === null || !box || !text) return;
    const boxWidth = box.clientWidth;
    const textWidth = text.scrollWidth;
    const plan = telopPlan(textWidth, boxWidth);
    const anim = plan.scroll
      ? text.animate(
          [
            { transform: `translateX(${boxWidth}px)` },
            { transform: `translateX(-${textWidth}px)` },
          ],
          { duration: plan.durationMs, easing: 'linear', fill: 'forwards' },
        )
      : null;
    const timer = setTimeout(
      () =>
        setPos((p) => ({
          index: nextTelopIndex(p.index, count),
          // 1件だけのときも再生を最初からやり直すため、indexとは別に進める
          tick: p.tick + 1,
        })),
      plan.durationMs,
    );
    return () => {
      clearTimeout(timer);
      anim?.cancel();
    };
  }, [itemKey, count]);

  if (!item) return null;
  return (
    <div className="flex h-[144px] w-[816px] items-center gap-5 overflow-hidden rounded-[16px] bg-text px-6 portrait:h-[120px] portrait:w-[1032px]">
      <span
        className={`shrink-0 whitespace-nowrap rounded-[8px] px-4 py-2 font-display text-[28px] leading-none font-bold text-text ${item.audience === 'visitor' ? 'bg-primary' : 'bg-warning'}`}
      >
        {chipLabel(item)}
      </span>
      <div ref={boxRef} className="min-w-0 flex-1 overflow-hidden">
        <p
          key={itemKey}
          ref={textRef}
          className="w-max font-display text-[44px] leading-none font-bold whitespace-nowrap text-background"
        >
          {item.body}
        </p>
      </div>
    </div>
  );
}
