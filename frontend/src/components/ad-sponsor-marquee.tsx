'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { HoverLine } from './hover-line';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { buildMarqueeBlocks, type MarqueeTier } from '@/lib/sponsor-marquee';
import type { SponsorListItem } from '@/lib/sponsors';

// 90px/秒の等速。周期 = 1 セット幅 ÷ 速度
const SPEED_PX_PER_SEC = 90;

// SP は PC の 0.6 倍。社名文字サイズはロゴ無し時の代替表示用
const TIER_STYLE: Readonly<
  Record<Exclude<MarqueeTier, 'planD'>, { logo: string; text: string }>
> = {
  planA: { logo: 'h-[79.2px] lg:h-[132px]', text: 'text-[14.4px] lg:text-2xl' },
  planB: { logo: 'h-[62.4px] lg:h-[104px]', text: 'text-[14.4px] lg:text-2xl' },
  planC: { logo: 'h-[49.6px] lg:h-[82.667px]', text: 'text-xs lg:text-xl' },
};

// 社名の直下に下線を出す。truncate は線ごと切れないよう内側の span に掛ける
function NameText({
  name,
  className,
  linked,
}: {
  readonly name: string;
  readonly className: string;
  readonly linked: boolean;
}) {
  return (
    <span className={`relative inline-block max-w-full ${className}`}>
      <span className="block truncate">{name}</span>
      {linked && <HoverLine gap={4} />}
    </span>
  );
}

export function SponsorItem({
  sponsor: s,
  tier,
  hidden,
  grid,
}: {
  readonly sponsor: SponsorListItem;
  readonly tier: MarqueeTier;
  readonly hidden?: boolean;
  /** PC の A グリッド用。セルに内接させ、ロゴ無しは 1 行で省略する */
  readonly grid?: boolean;
}) {
  const linked = Boolean(s.url);
  let content: React.ReactNode;
  if (tier === 'planD') {
    content = (
      <NameText
        name={s.name}
        linked={linked}
        className="h-[17.28px] whitespace-nowrap text-xs leading-none text-text lg:h-[28.8px] lg:text-base"
      />
    );
  } else if (s.logoId === null) {
    const style = TIER_STYLE[tier];
    content = grid ? (
      <NameText
        name={s.name}
        linked={linked}
        className="text-2xl leading-none text-text"
      />
    ) : (
      <span
        className={`flex ${style.logo} items-center justify-center whitespace-nowrap leading-none text-text ${style.text}`}
      >
        <NameText name={s.name} linked={linked} className="" />
      </span>
    );
  } else {
    content = (
      <img
        src={toAssetUrl(s.logoId, 960) ?? ''}
        alt={hidden ? '' : s.name}
        className={`${
          grid
            ? 'max-h-[132px] max-w-full'
            : `${TIER_STYLE[tier].logo} w-auto max-w-none`
        } block bg-white ${linked ? 'hover-card-shadow' : ''}`}
      />
    );
  }
  if (!s.url) return content;
  return (
    <a
      href={s.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={hidden ? -1 : undefined}
      className={grid ? 'group flex max-w-full' : 'group block'}
    >
      {content}
    </a>
  );
}

/** PC 専用。広告協賛 A を固定の 3 列グリッドで並べる */
export function AdSponsorTopGrid({
  sponsors,
}: {
  readonly sponsors: readonly SponsorListItem[];
}) {
  const tops = sponsors.filter((s) => s.tier === 'planA');
  if (tops.length === 0) return null;
  return (
    <ul className="hidden grid-cols-3 gap-6 lg:grid">
      {tops.map((s) => (
        <li key={s.id} className="flex h-[132px] items-center justify-center">
          <SponsorItem sponsor={s} tier="planA" grid />
        </li>
      ))}
    </ul>
  );
}

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
          className={`flex h-[168px] items-center gap-6 lg:h-[280px] lg:gap-10 ${block.tier === 'planA' ? 'lg:hidden' : ''}`}
        >
          {block.columns.map((column) => (
            <li key={column[0]!.id}>
              <ul className="flex flex-col items-center gap-[9.6px] lg:gap-4">
                {column.map((s) => (
                  <li key={s.id}>
                    <SponsorItem
                      sponsor={s}
                      tier={block.tier}
                      hidden={hidden}
                    />
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

  const aOnly = sponsors.every((s) => s.tier === 'planA');

  // pb-10: shadow/card の下方向の広がり (offset 20 + blur 25 - spread 5) が overflow-hidden で切れないための余白
  return (
    <div
      className={`overflow-hidden pb-10 motion-reduce:overflow-x-auto ${aOnly ? 'lg:hidden' : ''}`}
    >
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
