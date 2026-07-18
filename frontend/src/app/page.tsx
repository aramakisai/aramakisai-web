import { getHomePage } from '@/lib/home-page';
import { toAssetUrl } from '@/lib/directus-asset-url';
import { HeroSection } from '@/components/hero-section';
import { AnnouncementsList } from '@/components/announcements-list';
import { TopicsList } from '@/components/topics-list';
import { FestivalOverview } from '@/components/festival-overview';
import { FestivalSummary } from '@/components/festival-summary';
import { HomePageContent } from '@/lib/home-page-types';

export default async function Page() {
  let content: HomePageContent;
  try {
    content = await getHomePage();
  } catch {
    // エラー時は最小限のフォールバック表示
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-xl font-bold">荒牧祭</h1>
      </main>
    );
  }

  const festivalName = content.festival.name || '荒牧祭';
  const heroImageUrls = content.heroImages
    .map((image) => toAssetUrl(image.id))
    .filter((url): url is string => url !== null);

  return (
    <main className="space-y-12 px-4 pb-8 sm:py-12">
      <h1 className="sr-only">{festivalName}</h1>

      <HeroSection
        heroImageUrls={heroImageUrls}
        heroMessageHtml={content.heroMessageHtml}
      />
      <div className="mx-auto max-w-6xl">
        <FestivalOverview festival={content.festival} />

        <FestivalSummary overviewHtml={content.festival.overviewHtml} />

        <section>
          <h2 className="mb-4 border-b border-gray-200 pb-2 text-2xl font-bold">
            お知らせ
          </h2>
          <AnnouncementsList announcements={content.announcements} />
        </section>

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
      </div>
    </main>
  );
}
