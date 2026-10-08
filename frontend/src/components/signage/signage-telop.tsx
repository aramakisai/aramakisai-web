'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SignageTelopItem } from '@/lib/signage';
import { telopAt, telopSchedule, type TelopSlot } from '@/lib/signage-telop';

export interface SignageTelopProps {
  readonly items: readonly SignageTelopItem[];
  /** 補正済み時刻 = Date.now() + offsetMs。マウント前は未確定 */
  readonly offsetMs: number | null;
}

interface Measured {
  readonly slots: readonly TelopSlot[];
  readonly boxWidth: number;
}

function chipLabel(item: SignageTelopItem): string {
  return item.audience === 'visitor'
    ? 'ご来場のみなさまへ'
    : (item.target ?? '参加団体へ');
}

export function SignageTelop({ items, offsetMs }: SignageTelopProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const [index, setIndex] = useState(0);
  const count = items.length;
  const itemsKey = items.map((i) => `${i.id}:${i.body}`).join('\n');

  // 全件を paint 前に測る。文面幅・枠幅は拡縮前の設計座標で、端末の画面サイズに依らない
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || count === 0) return;
    let disposed = false;
    const measure = () => {
      const widths = Array.from(
        { length: count },
        (_, i) => textRefs.current[i]?.offsetWidth ?? 0,
      );
      const boxWidth = box.clientWidth;
      setMeasured({ slots: telopSchedule(widths, boxWidth), boxWidth });
    };
    measure();
    // 縦横の切り替えで枠幅が変わる
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    // Web フォント読込前の幅で計測した場合に備え、読込完了後に測り直す
    if (document.fonts.status !== 'loaded') {
      void document.fonts.ready.then(() => {
        if (!disposed) measure();
      });
    }
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [itemsKey, count]);

  // 件の切り替えと流し位置は端末の経過時間ではなく時刻から決め、全端末で同じ表示にする。
  // 毎フレームの位置は React の状態を経由せず直接反映する
  useEffect(() => {
    if (!measured || offsetMs === null) return;
    let raf = 0;
    const frame = () => {
      const at = telopAt(
        measured.slots,
        measured.boxWidth,
        Date.now() + offsetMs,
      );
      if (at) {
        setIndex(at.index);
        textRefs.current.forEach((el, i) => {
          if (!el) return;
          el.style.visibility = i === at.index ? 'visible' : 'hidden';
          if (i === at.index) {
            el.style.transform = `translateX(${at.translateX}px)`;
          }
        });
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [measured, offsetMs]);

  const item = items[index < count ? index : 0];
  if (!item) return null;
  return (
    <div className="flex h-[144px] w-[816px] items-center gap-5 overflow-hidden rounded-[16px] bg-text px-6 portrait:h-[120px] portrait:w-[1032px]">
      <span
        className={`shrink-0 whitespace-nowrap rounded-[8px] px-4 py-2 font-display text-[28px] leading-none font-bold text-text ${item.audience === 'visitor' ? 'bg-primary' : 'bg-warning'}`}
      >
        {chipLabel(item)}
      </span>
      <div
        ref={boxRef}
        className="relative min-w-0 flex-1 self-stretch overflow-hidden"
      >
        {items.map((it, i) => (
          <p
            key={it.id}
            ref={(el) => {
              textRefs.current[i] = el;
            }}
            style={{ visibility: 'hidden' }}
            className="absolute inset-y-0 left-0 flex w-max items-center font-display text-[44px] leading-none font-bold whitespace-nowrap text-background"
          >
            {it.body}
          </p>
        ))}
      </div>
    </div>
  );
}
