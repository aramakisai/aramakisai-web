import { cookies } from 'next/headers';
import { getHomePage } from '@/lib/home-page';
import { HeroSection } from '@/components/hero-section';
import { AboutSection } from '@/components/about-section';
import { AnnouncementsList } from '@/components/announcements-list';
import { TopicsList } from '@/components/topics-list';
import { RichText } from '@/components/rich-text';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { HomePageContent } from '@/lib/home-page-types';
import { PHASE_OVERRIDE_COOKIE, resolvePhase } from '@/lib/phase';
import { formatEventDaysSummary, getDaysUntilEventDay } from '@/lib/event-day';

const EMPTY_CONTENT: HomePageContent = {
  heroImages: [],
  heroMessageHtml: null,
  snsLinks: [],
  festival: null,
  theme: null,
  venueName: null,
  campusMapUrl: null,
  contactFormUrl: null,
  announcements: [],
  topics: [],
};

export default async function Page() {
  const cookieStore = await cookies();
  const { phase } = resolvePhase(cookieStore.get(PHASE_OVERRIDE_COOKIE)?.value);

  let content = EMPTY_CONTENT;
  try {
    content = await getHomePage(phase);
  } catch {
    // getHomePage は領域ごとに欠落を表現して返すため、ここに来るのは想定外の例外のみ
  }

  const festivalName = content.festival?.name || '荒牧祭';
  const eventDays = content.festival?.eventDays ?? [];

  return (
    <div>
      <h1 className="sr-only">{festivalName}</h1>

      {content.heroImages.length > 0 && (
        <HeroSection
          imageUrls={content.heroImages
            .map((image) => toAssetUrl(image.id, 1920))
            .filter((url): url is string => url !== null)}
          eventDaysSummary={formatEventDaysSummary(eventDays)}
          venueName={content.venueName}
          themeWord={content.theme?.word ?? null}
          countdownDays={
            eventDays.length > 0
              ? getDaysUntilEventDay(eventDays[0].startAt)
              : null
          }
        />
      )}

      {content.festival && content.theme && (
        <AboutSection
          festival={content.festival}
          theme={content.theme}
          venueName={content.venueName}
          campusMapUrl={content.campusMapUrl}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        {content.heroMessageHtml && (
          <RichText html={content.heroMessageHtml} className="hero-message" />
        )}

        <section>
          <h2 className="mb-4 border-b border-gray-200 pb-2 text-2xl font-bold">
            お知らせ
          </h2>
          <AnnouncementsList announcements={content.announcements} limit={5} />
        </section>

        {phase === 'live' && content.topics.length > 0 && (
          <section>
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-2xl font-bold">
              トピックス
            </h2>
            <TopicsList
              topics={content.topics.map((t) => ({
                id: t.id,
                title: t.title,
                body: t.body,
                imageId: t.imageId,
                attachments: t.attachments,
              }))}
            />
          </section>
        )}
      </div>
    </div>
  );
}
