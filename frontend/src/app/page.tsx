import { getHomePage } from '@/lib/home-page';
import { toAssetUrl } from '@/lib/directus-asset-url';
import { HeroSection } from '@/components/hero-section';
import { NoticesList } from '@/components/notices-list';
import { TopicsList } from '@/components/topics-list';
import { SnsLinks } from '@/components/sns-links';
import { FestivalOverview } from '@/components/festival-overview';
import { SponsorsList } from '@/components/sponsors-list';
import { HomeActiveVariant } from '@/lib/home-page-types';
import { env } from '@/env';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function resolveVariantOverride(
  searchParams: Record<string, string | string[] | undefined>,
): HomeActiveVariant | undefined {
  if (env.NEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE !== 'true') {
    return undefined;
  }
  const value = searchParams.home_variant;
  const variant = Array.isArray(value) ? value[0] : value;
  return variant === 'pre_event' || variant === 'live' ? variant : undefined;
}

export default async function Page({ searchParams }: PageProps) {
  const overrideVariant = resolveVariantOverride(await searchParams);

  let result;
  try {
    result = await getHomePage(overrideVariant);
  } catch {
    // エラー時は最小限のフォールバック表示
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-xl font-bold">荒牧祭</h1>
      </main>
    );
  }

  const { variant, content } = result;
  const festivalName = content.festival.name || '荒牧祭';

  return (
    <main className="mx-auto max-w-4xl space-y-12 px-4 py-8 sm:py-12">
      <h1 className="sr-only">{festivalName}</h1>

      <HeroSection
        heroImageUrl={toAssetUrl(content.heroImageId)}
        heroMessageHtml={content.heroMessageHtml}
        embedUrl={content.embedUrl}
      />

      <FestivalOverview festival={content.festival} />

      {variant === 'pre_event' && (
        <>
          <section>
            <h2 className="mb-4 border-b border-gray-200 pb-2 text-2xl font-bold">
              お知らせ
            </h2>
            <NoticesList notices={content.notices} />
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
                imageUrl: toAssetUrl(t.imageId),
                linkUrl: t.linkUrl,
              }))}
            />
          </section>
        </>
      )}

      {content.sponsors.length > 0 && (
        <section>
          <h2 className="mb-4 border-b border-gray-200 pb-2 text-2xl font-bold">
            協賛
          </h2>
          <SponsorsList
            sponsors={content.sponsors.map((s) => ({
              id: s.id,
              name: s.name,
              logoUrl: toAssetUrl(s.logoId),
              url: s.url,
            }))}
          />
        </section>
      )}

      <section>
        <h2 className="mb-4 border-b border-gray-200 pb-2 text-xl font-bold">
          公式SNS
        </h2>
        <SnsLinks snsLinks={content.snsLinks} />
      </section>
    </main>
  );
}
