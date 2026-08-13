'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';

const SLIDE_INTERVAL_MS = 6_000;

export interface HeroSectionProps {
  imageUrls: string[];
  heroMessageHtml?: string;
}

export function HeroSection({ imageUrls }: HeroSectionProps) {
  const imageCount = imageUrls.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerResetKey, setTimerResetKey] = useState(0);

  useEffect(() => {
    if (imageCount <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % imageCount);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [timerResetKey, imageCount]);

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

  return (
    <section
      aria-label="荒牧祭の写真スライドショー"
      className="relative isolate h-[78svh] min-h-[28rem] w-full overflow-hidden bg-slate-900 lg:h-[calc(100vh-5rem)] lg:min-h-[30rem]"
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
              key={isActive ? `${src}-active` : src}
              src={src}
              alt=""
              draggable={false}
              fetchPriority={index === 0 ? 'high' : 'auto'}
              className={`aramakisai-hero-image h-full w-full object-cover object-center ${
                isActive ? 'aramakisai-hero-image--active' : ''
              }`}
            />
          </div>
        );
      })}

      <div aria-hidden="true" className="absolute inset-0 z-10 bg-black/10" />

      {imageCount > 1 && (
        <>
          <button
            type="button"
            aria-label="前の画像を表示"
            onClick={showPreviousSlide}
            className="absolute top-1/2 left-4 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white shadow-lg backdrop-blur-sm transition-colors duration-200 hover:bg-black/45 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none lg:left-10 lg:h-12 lg:w-12"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="次の画像を表示"
            onClick={showNextSlide}
            className="absolute top-1/2 right-4 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white shadow-lg backdrop-blur-sm transition-colors duration-200 hover:bg-black/45 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none lg:right-10 lg:h-12 lg:w-12"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          <div
            role="group"
            aria-label="表示する画像を選択"
            className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/20 px-2 py-1 backdrop-blur-sm"
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
        </>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center text-white/75"
      >
        <span className="pl-[0.32em] text-[11px] leading-none font-medium tracking-[0.32em]">
          SCROLL
        </span>
        <span className="aramakisai-scroll-line mt-2 block h-12 w-px bg-white/70" />
      </div>

      <style>{`
        @keyframes aramakisai-hero-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.04); }
        }

        @keyframes aramakisai-scroll-line {
          0% {
            transform: scaleY(0);
            transform-origin: top;
          }
          50% {
            transform: scaleY(1);
            transform-origin: top;
          }
          50.1% {
            transform: scaleY(1);
            transform-origin: bottom;
          }
          100% {
            transform: scaleY(0);
            transform-origin: bottom;
          }
        }

        .aramakisai-hero-image {
          transform: scale(1);
          transition: transform 1s ease-out;
        }

        .aramakisai-hero-image--active {
          animation: aramakisai-hero-zoom 6s ease-out forwards;
        }

        .aramakisai-scroll-line {
          animation: aramakisai-scroll-line 1.8s ease-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .aramakisai-hero-image,
          .aramakisai-hero-image--active {
            animation: none;
            transform: scale(1);
            transition: none;
          }

          .aramakisai-scroll-line {
            animation: none;
            transform: scaleY(1);
          }
        }
      `}</style>
    </section>
  );
}
