import { getHomePage } from '@/lib/home-page';
import { HeroSection } from '@/components/hero-section';
import { AboutSection } from '@/components/about-section';
import { AnnouncementsList } from '@/components/announcements-list';
import { TopicsList } from '@/components/topics-list';
import { RichText } from '@/components/rich-text';
import { toAssetUrl } from '@/lib/directus-asset-url';
import { HomePageContent } from '@/lib/home-page-types';

export default async function Page() {
  let content: HomePageContent | null = null;
  try {
    content = await getHomePage();
  } catch {
    // Directus由来の領域だけを非表示にし、静的なページ構造は維持する
  }

  const festivalName = content?.festival.name || '荒牧祭';

  return (
    <main>
      <h1 className="sr-only">{festivalName}</h1>

      {content && (
        <>
          <HeroSection
            imageUrls={content.heroImages
              .map((image) => toAssetUrl(image.id, 1920))
              .filter((url): url is string => url !== null)}
            heroMessageHtml={content.heroMessageHtml}
          />
          <AboutSection
            festival={content.festival}
            theme={content.theme}
            venueName={content.venueName}
            campusMapUrl={content.campusMapUrl}
          />

          <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
            <RichText html={content.heroMessageHtml} className="hero-message" />

            <section>
              <h2 className="mb-4 border-b border-gray-200 pb-2 text-2xl font-bold">
                お知らせ
              </h2>
              <AnnouncementsList announcements={content.announcements} />
            </section>

            {content.topics.length > 0 && (
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
        </>
      )}
    </main>
  );
}
