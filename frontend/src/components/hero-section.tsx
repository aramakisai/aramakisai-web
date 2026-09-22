'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { useMotionPreference } from '@/lib/use-motion-preference';
import { formatCountdownLabel } from '@/lib/event-day';
import type { FestivalPhase } from '@/lib/phase';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

const SLIDE_INTERVAL_MS = 6_000;

export interface HeroSectionProps {
  imageUrls: string[];
  /** 「11月14日 10:00〜17:30／11月15日 10:00〜16:30」形式。取得失敗時は null */
  eventDaysSummary: string | null;
  venueName: string | null;
  themeWord: string | null;
  /** 開催日までの残り日数。event_days が空/未取得のとき null */
  countdownDays: number | null;
  /**
   * 既定は 'pre_event'。'live' は開催中に残り日数が意味を持たないためカウントダウンを、
   * スライドショーが装飾に徹するため前後の矢印ボタンを持たず、高さも 50svh になる (要件 3.1, 3.9, 4.2)
   */
  phase?: FestivalPhase;
}

/** 固定文言 (CMS に依存しない)。SP/PC 両方の overlay から参照する */
function HeroTitle() {
  return (
    <h2 className="py-0 text-[44px] leading-[1.2] text-gray-50">
      <span className="block">群馬大学</span>
      <span className="block">荒牧祭</span>
    </h2>
  );
}

export function HeroSection({
  imageUrls,
  eventDaysSummary,
  venueName,
  themeWord,
  countdownDays,
  phase = 'pre_event',
}: HeroSectionProps) {
  const isLive = phase === 'live';
  const imageCount = imageUrls.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerResetKey, setTimerResetKey] = useState(0);
  const { reduced } = useMotionPreference();

  useEffect(() => {
    if (imageCount <= 1 || reduced) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % imageCount);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [timerResetKey, imageCount, reduced]);

  if (imageCount === 0) {
    return null;
  }

  const showSlide = (index: number) => {
    setActiveIndex(index);
    setTimerResetKey((key) => key + 1);
  };

  const showPreviousSlide = () => {
    showSlide((activeIndex - 1 + imageCount) % imageCount);
  };

  const showNextSlide = () => {
    showSlide((activeIndex + 1) % imageCount);
  };

  const countdownLabel =
    isLive || countdownDays === null
      ? null
      : formatCountdownLabel(countdownDays);

  return (
    <section
      aria-label="荒牧祭の写真スライドショー"
      className={`relative isolate w-full overflow-hidden bg-gray-200 ${
        isLive ? 'h-[50svh]' : 'h-[78svh] min-h-[28rem]'
      }`}
    >
      {imageUrls.map((src, index) => {
        const isActive = index === activeIndex;

        return (
          <div
            key={`${src}-${index}`}
            data-testid="hero-slide"
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
              isActive ? 'z-[1] opacity-100' : 'z-0 opacity-0'
            }`}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              className="h-full w-full object-cover object-center"
            />
          </div>
        );
      })}

      {/* 下端の文字を読ませるためのグラデーションスクリム */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-text/50 to-transparent"
      />

      <div
        data-testid="hero-content-mobile"
        className="absolute inset-0 z-20 flex flex-col items-start justify-end gap-2 px-4 pb-8 lg:hidden"
      >
        {isLive ? (
          <>
            <h2 className="py-0 text-[32px] leading-[1.2] text-gray-50">
              群馬大学 荒牧祭
            </h2>
            {eventDaysSummary && (
              <p className="text-[16px] leading-[1.7] text-gray-50">
                {eventDaysSummary}
              </p>
            )}
            {venueName && (
              <p className="text-[16px] leading-[1.7] text-gray-50">
                {venueName}
              </p>
            )}
            {themeWord && (
              <p className="font-mincho text-[64px] leading-[1.2] font-bold text-gray-50">
                {themeWord}
              </p>
            )}
          </>
        ) : (
          <>
            <HeroTitle />
            {eventDaysSummary && (
              <p className="text-[16px] leading-[1.7] text-gray-50">
                {eventDaysSummary}
              </p>
            )}
            {venueName && (
              <p className="text-[16px] leading-[1.7] text-gray-50">
                {venueName}
              </p>
            )}
            {themeWord && (
              <p className="font-mincho text-[44px] leading-[1.2] font-bold text-gray-50">
                {themeWord}
              </p>
            )}
            {countdownLabel && (
              <p className="font-mincho text-[20px] leading-[1.4] font-bold text-gray-50">
                {countdownLabel}
              </p>
            )}
          </>
        )}
      </div>

      <div
        data-testid="hero-content-desktop"
        className={
          isLive
            ? 'absolute inset-0 z-20 hidden flex-col items-start justify-end gap-2 px-20 pb-12 lg:flex'
            : 'absolute inset-0 z-20 hidden items-end justify-between px-20 pb-12 lg:flex'
        }
      >
        {isLive ? (
          <>
            <h2 className="py-0 text-[44px] leading-[1.2] text-gray-50">
              群馬大学 荒牧祭
            </h2>
            {themeWord && (
              <p className="font-mincho text-[88px] leading-[1.2] font-bold text-gray-50">
                {themeWord}
              </p>
            )}
            {(eventDaysSummary || venueName) && (
              <div className="flex items-center gap-3 text-[16px] leading-[1.7] text-gray-50">
                {eventDaysSummary && <span>{eventDaysSummary}</span>}
                {eventDaysSummary && venueName && <span>｜</span>}
                {venueName && <span>{venueName}</span>}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col items-start gap-2">
              <HeroTitle />
              {(eventDaysSummary || venueName) && (
                <div className="flex items-center gap-3 text-[16px] leading-[1.7] text-gray-50">
                  {eventDaysSummary && <span>{eventDaysSummary}</span>}
                  {eventDaysSummary && venueName && <span>｜</span>}
                  {venueName && <span>{venueName}</span>}
                </div>
              )}
            </div>

            {(themeWord || countdownLabel) && (
              <div className="flex flex-col items-end gap-1 text-right">
                {themeWord && (
                  <p className="font-mincho text-[44px] leading-[1.2] font-bold text-gray-50">
                    {themeWord}
                  </p>
                )}
                {countdownLabel && (
                  <p className="font-mincho text-[20px] leading-[1.4] font-bold text-gray-50">
                    {countdownLabel}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {imageCount > 1 && !isLive && (
        <>
          <button
            type="button"
            aria-label="前の画像を表示"
            onClick={showPreviousSlide}
            className="absolute top-1/2 left-4 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-gray-50 shadow-lg transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none lg:left-10 lg:h-12 lg:w-12"
          >
            <ChevronLeftIcon size={24} />
          </button>

          <button
            type="button"
            aria-label="次の画像を表示"
            onClick={showNextSlide}
            className="absolute top-1/2 right-4 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-gray-50 shadow-lg transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none lg:right-10 lg:h-12 lg:w-12"
          >
            <ChevronRightIcon size={24} />
          </button>
        </>
      )}

      {imageCount > 1 && (
        <div
          role="group"
          aria-label="表示する画像を選択"
          className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/20 px-2 py-1 backdrop-blur-sm lg:bottom-6"
        >
          {imageUrls.map((src, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={`${src}-${index}`}
                type="button"
                aria-label={`${index + 1}枚目の画像を表示`}
                aria-pressed={isActive}
                onClick={() => showSlide(index)}
                className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:h-8 lg:w-8"
              >
                <span
                  aria-hidden="true"
                  className={`block rounded-full transition-all duration-200 motion-reduce:transition-none ${
                    isActive
                      ? 'h-3 w-3 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]'
                      : 'h-2.5 w-2.5 bg-white/50 group-hover:bg-white/80'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
