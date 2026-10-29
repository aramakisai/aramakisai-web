'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { buildMarqueeBlocks, type MarqueeTier } from '@/lib/sponsor-marquee';
import type { SponsorListItem } from '@/lib/sponsors';

// 90px/秒の等速。周期 = 1 セット幅 ÷ 速度
const SPEED_PX_PER_SEC = 90;

// SP は PC の 0.6 倍
const LOGO_HEIGHT: Readonly<Record<Exclude<MarqueeTier, 'planD'>, string>> = {
  planA: 'h-[57.6px] lg:h-24',
  planB: 'h-[35.2px] lg:h-[58.667px]',
  planC: 'h-6 lg:h-10',
};

function MarqueeSet({
  sponsors,
  hidden,
  setRef,
}: {
  readonly sponsors: readonly SponsorListItem[];
  readonly hidden?: boolean;
  readonly setRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={setRef}
      aria-hidden={hidden || undefined}
      className={`flex shrink-0 gap-[38.4px] pr-[38.4px] lg:gap-16 lg:pr-16 ${hidden ? 'motion-reduce:hidden' : ''}`}
    >
      {buildMarqueeBlocks(sponsors).map((block) => (
        <ul
          key={block.tier}
          className="flex h-[124.8px] items-center gap-6 lg:h-[208px] lg:gap-10"
        >
          {block.columns.map((column) => (
            <li key={column[0]!.id}>
              <ul className="flex flex-col items-center gap-[9.6px] lg:gap-4">
                {column.map((s) => (
                  <li key={s.id}>
                    {block.tier === 'planD' ? (
                      <span className="flex h-[17.28px] items-center whitespace-nowrap text-xs leading-none text-text lg:h-[28.8px] lg:text-base">
                        {s.name}
                      </span>
                    ) : (
                      <img
                        src={toAssetUrl(s.logoId, 960) ?? ''}
                        alt={hidden ? '' : s.name}
                        className={`${LOGO_HEIGHT[block.tier]} w-auto max-w-none`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export function AdSponsorMarquee({
  sponsors,
}: {
  readonly sponsors: readonly SponsorListItem[];
}) {
  const setRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // 画像の読み込み・画面幅の変化で 1 セット幅が変わるため、描画幅を観測して周期を求め直す
  useEffect(() => {
    const el = setRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sponsors]);

  return (
    <div className="overflow-hidden motion-reduce:overflow-x-auto">
      <div
        data-testid="ad-sponsor-marquee-track"
        className={`flex w-max ${width > 0 ? 'animate-[sponsor-marquee_var(--marquee-duration)_linear_infinite] motion-reduce:animate-none' : ''}`}
        style={
          {
            '--marquee-width': `${width}px`,
            '--marquee-duration': `${width / SPEED_PX_PER_SEC}s`,
          } as React.CSSProperties
        }
      >
        <MarqueeSet sponsors={sponsors} setRef={setRef} />
        <MarqueeSet sponsors={sponsors} hidden />
      </div>
    </div>
  );
}
