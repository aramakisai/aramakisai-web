import { getHomePage } from '@/lib/home-page';
import { toAssetUrl } from '@/lib/directus-asset-url';
import { HeroSection } from '@/components/hero-section';
import { NoticesList } from '@/components/notices-list';
import { TopicsList } from '@/components/topics-list';
import { SnsLinks } from '@/components/sns-links';
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

  return (
    <main className="container mx-auto px-4 py-8 space-y-8">
      <h1 className="sr-only">荒牧祭</h1>

      <HeroSection
        heroImageUrl={toAssetUrl(content.heroImageId)}
        heroMessageHtml={content.heroMessageHtml}
        embedUrl={content.embedUrl}
      />

      {variant === 'pre_event' && (
        <>
          <section>
            <h2 className="text-2xl font-bold mb-4">お知らせ</h2>
            <NoticesList notices={content.notices} />
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">トピックス</h2>
            <TopicsList topics={content.topics.map(t => ({
              id: t.id,
              title: t.title,
              body: t.body,
              imageUrl: toAssetUrl(t.imageId),
              linkUrl: t.linkUrl
            }))} />
          </section>
        </>
      )}

      <section>
        <h2 className="text-xl font-bold mb-4">公式SNS</h2>
        <SnsLinks snsLinks={content.snsLinks} />
      </section>
    </main>
  );
}
