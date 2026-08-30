/* eslint-disable @next/next/no-img-element */
import { toAssetUrl } from '@/lib/cms-asset-url';
import type { FestivalOverview, FestivalTheme } from '@/lib/home-page-types';
import { RichText } from './rich-text';

export interface AboutSectionProps {
  festival: FestivalOverview;
  theme: FestivalTheme;
  venueName: string | null;
  campusMapUrl: string | null;
}

function isGoogleMapsEmbedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === 'https://www.google.com' &&
      parsed.pathname === '/maps/embed'
    );
  } catch {
    return false;
  }
}

export function AboutSection({
  festival,
  theme,
  venueName,
  campusMapUrl,
}: AboutSectionProps) {
  const hasTheme = Boolean(
    theme.word || theme.imageId || theme.descriptionHtml,
  );
  const themeImageUrl = toAssetUrl(theme.imageId, 960);
  const showMap = campusMapUrl !== null && isGoogleMapsEmbedUrl(campusMapUrl);

  return (
    <section
      id="about"
      aria-labelledby="about-title"
      className="scroll-mt-24 bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-32">
        <header className="mb-14 sm:mb-20 lg:mb-28">
          <h2
            id="about-title"
            aria-label="荒牧祭について"
            className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-none bg-clip-border p-0 text-slate-950"
          >
            <img
              src="/images/aramakisai.png"
              alt="荒牧祭"
              width={1500}
              height={606}
              className="h-16 w-auto shrink-0 object-contain sm:h-[4.5rem] lg:h-20"
            />
            <span className="text-3xl leading-none font-black tracking-tight sm:text-4xl lg:text-5xl">
              について
            </span>
          </h2>
          <span
            data-testid="section-divider"
            aria-hidden="true"
            className="mansai-spectrum-line mt-8 block h-px w-full opacity-60"
          />
        </header>

        <div className="space-y-20 sm:space-y-24 lg:space-y-36">
          <section
            id="about-overview"
            aria-labelledby="about-overview-title"
            className="grid grid-cols-1 scroll-mt-24 gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16"
          >
            <h3
              id="about-overview-title"
              className="flex items-baseline gap-5 bg-none bg-clip-border p-0 text-slate-950"
            >
              <span className="mansai-spectrum-text bg-clip-text text-6xl leading-none font-light tracking-tighter text-transparent opacity-65 lg:text-8xl">
                01
              </span>
              <span className="text-2xl tracking-wide lg:text-3xl">概要</span>
            </h3>

            <div className="min-w-0 max-w-4xl">
              {festival.overviewHtml && (
                <RichText
                  html={festival.overviewHtml}
                  className="max-w-3xl space-y-6 text-base leading-8 text-slate-700 lg:text-lg lg:leading-9"
                />
              )}
            </div>
          </section>

          <section
            id="about-schedule"
            aria-labelledby="about-schedule-title"
            className="relative grid grid-cols-1 scroll-mt-24 gap-10 pt-16 sm:pt-20 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16 lg:pt-28"
          >
            <span
              data-testid="section-divider"
              aria-hidden="true"
              className="mansai-spectrum-line absolute inset-x-0 top-0 h-px opacity-60"
            />
            <h3
              id="about-schedule-title"
              className="flex items-baseline gap-5 bg-none bg-clip-border p-0 text-slate-950 lg:flex-col lg:items-start lg:gap-4"
            >
              <span className="mansai-spectrum-text bg-clip-text text-6xl leading-none font-light tracking-tighter text-transparent opacity-65 lg:text-8xl">
                02
              </span>
              <span className="text-2xl tracking-wide lg:text-3xl">
                開催スケジュール
              </span>
            </h3>

            <div className="min-w-0 max-w-5xl space-y-8 text-base leading-8 text-slate-700 lg:text-lg lg:leading-9">
              {festival.eventDays.length > 0 && (
                <div
                  data-testid="schedule-days"
                  className="grid w-full grid-cols-1 gap-5 bg-slate-50/80 p-4 sm:p-6 md:grid-cols-2 lg:p-8"
                >
                  {festival.eventDays.map((day, index) => (
                    <article
                      key={`${day.label}-${index}`}
                      data-testid="schedule-card"
                      className="relative overflow-hidden border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_12px_36px_rgba(15,23,42,0.07)] sm:p-7 lg:p-9"
                    >
                      <span
                        data-testid="spectrum-line"
                        aria-hidden="true"
                        className="mansai-spectrum-line absolute inset-x-0 top-0 h-px"
                      />
                      <p className="mb-7 text-sm font-semibold tracking-[0.22em] text-slate-500">
                        DAY {index + 1}
                      </p>
                      <p className="block whitespace-nowrap text-[clamp(1.125rem,5.5vw,1.5rem)] leading-none font-bold tracking-wide text-slate-950 sm:text-2xl lg:text-3xl">
                        {day.label}
                      </p>
                      <p className="mt-5 whitespace-nowrap text-[clamp(1rem,5vw,1.25rem)] font-semibold tracking-wide text-slate-700 sm:text-xl lg:text-2xl">
                        {day.open}〜{day.close}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              {venueName && (
                <div
                  data-testid="venue-details"
                  className="border-l-2 border-info pl-5"
                >
                  <p className="text-sm font-semibold tracking-[0.18em] text-slate-500">
                    会場
                  </p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {venueName}
                  </p>
                </div>
              )}

              {showMap && campusMapUrl && (
                <iframe
                  data-testid="campus-map"
                  src={campusMapUrl}
                  title={`${venueName ?? '会場'} Google Maps`}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  className="block h-[18rem] w-full max-w-full rounded-sm border-0 sm:h-[20rem] lg:h-[25rem]"
                />
              )}
            </div>
          </section>

          {hasTheme && (
            <section
              id="about-theme"
              aria-labelledby="about-theme-title"
              className="relative grid grid-cols-1 scroll-mt-24 gap-10 pt-16 sm:pt-20 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16 lg:pt-28"
            >
              <span
                data-testid="section-divider"
                aria-hidden="true"
                className="mansai-spectrum-line absolute inset-x-0 top-0 h-px opacity-60"
              />
              <h3
                id="about-theme-title"
                className="flex items-baseline gap-5 bg-none bg-clip-border p-0 text-slate-950 lg:flex-col lg:items-start lg:gap-4"
              >
                <span className="mansai-spectrum-text bg-clip-text text-6xl leading-none font-light tracking-tighter text-transparent opacity-65 lg:text-8xl">
                  03
                </span>
                <span className="text-2xl tracking-wide lg:text-3xl">
                  今年のテーマ
                </span>
              </h3>

              <div className="min-w-0 max-w-5xl">
                {theme.imageId && themeImageUrl && (
                  <div className="mb-14">
                    <p
                      data-testid="theme-label"
                      className="mb-5 text-xs font-semibold tracking-[0.34em] text-slate-800 sm:text-sm"
                    >
                      THEME
                    </p>
                    <div
                      data-testid="theme-visual"
                      className="relative isolate aspect-[16/10] w-full max-w-full min-w-0 overflow-hidden bg-slate-100 sm:aspect-[40/21]"
                    >
                      <img
                        src={themeImageUrl}
                        alt={
                          theme.word
                            ? `荒牧祭「${theme.word}」メインビジュアル`
                            : '荒牧祭メインビジュアル'
                        }
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                      <span
                        data-testid="theme-image-overlay"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-10 bg-slate-950/10"
                      />
                      {theme.word && (
                        <p
                          data-testid="theme-word"
                          className="absolute inset-0 z-20 flex items-center justify-center font-serif text-[clamp(3.25rem,18vw,5.5rem)] leading-none font-black tracking-[0.08em] text-white drop-shadow-[0_4px_24px_rgba(15,23,42,0.38)] sm:text-8xl lg:text-[9rem]"
                        >
                          {theme.word}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {theme.descriptionHtml && (
                  <div data-testid="theme-description">
                    <RichText
                      html={theme.descriptionHtml}
                      className="max-w-3xl space-y-6 text-base leading-8 text-slate-700 lg:text-lg lg:leading-9"
                    />
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
