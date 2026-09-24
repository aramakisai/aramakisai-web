import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getHomePage } from '@/lib/home-page';
import { HeroSection } from '@/components/hero-section';
import { AboutSection } from '@/components/about-section';
import { NoticesSection } from '@/components/notices-section';
import { TopicsList } from '@/components/topics-list';
import { SectionHeading } from '@/components/section-heading';
import { PrimaryNavGrid } from '@/components/primary-nav-card';
import { ExhibitionSearchForm } from '@/components/exhibition-search-form';
import { FeaturedExhibitions } from '@/components/featured-exhibitions';
import { SponsorsList } from '@/components/sponsors-list';
import { AccessSection } from '@/components/access-section';
import { toAssetUrl } from '@/lib/cms-asset-url';
import { HomePageContent } from '@/lib/home-page-types';
import { PHASE_OVERRIDE_COOKIE, resolvePhase } from '@/lib/phase';
import { formatEventDaysSummary, getDaysUntilEventDay } from '@/lib/event-day';
import {
  getExhibitionListData,
  parseExhibitionQuery,
  type ExhibitionCardSummary,
} from '@/lib/exhibitions';
import { getSponsors, mergeSponsorLogos } from '@/lib/sponsors';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import {
  buildEventJsonLd,
  buildOrganizationJsonLd,
} from '@/lib/structured-data';
import { JsonLd, type JsonLdObject } from '@/components/json-ld';
import { env } from '@/env';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();

  return buildPageMetadata({
    site,
    // ROUTE_METADATA['/'].title は null (サイトタイトルそのものを使う合図)
    title: ROUTE_METADATA['/'].title ?? site.siteTitle,
    description: null,
    path: '/',
    ogType: 'website',
    imageCandidates: [],
  });
}

const EMPTY_CONTENT: HomePageContent = {
  heroImages: [],
  heroMessageHtml: null,
  snsLinks: [],
  festival: null,
  theme: null,
  venueName: null,
  campusMapUrl: null,
  contactFormUrl: null,
  accessSummary: null,
  announcements: [],
  topics: [],
};

// トップページのセクション上下余白 (Figma 実測: PC py-12 / SP py-8、design.md Requirement 3)
const SECTION_CLASS =
  'mx-auto w-full max-w-[1440px] px-4 py-8 lg:px-20 lg:py-12';

// /exhibitions ページと同じ「取得失敗時は空扱い」の規約 (企画一覧は検索欄・導線だけ残す、要件3.2)
async function getFeaturedExhibitions(): Promise<
  readonly ExhibitionCardSummary[]
> {
  try {
    const result = await getExhibitionListData(parseExhibitionQuery({}));
    return result.items;
  } catch {
    return [];
  }
}

async function getSponsorLogos() {
  const result = await getSponsors();
  return result.ok ? mergeSponsorLogos(result.value) : [];
}

export default async function Page() {
  const cookieStore = await cookies();
  const { phase } = resolvePhase(cookieStore.get(PHASE_OVERRIDE_COOKIE)?.value);
  const site = await getSiteMetadata();

  // Event は開催日程が無ければ null (Organization は必ず出す、要件5.8)
  const eventJsonLd = buildEventJsonLd({
    site,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });
  const organizationJsonLd = buildOrganizationJsonLd({
    site,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  });
  const structuredData: JsonLdObject = {
    '@context': 'https://schema.org',
    '@graph': [eventJsonLd, organizationJsonLd].filter(
      (item): item is JsonLdObject => item !== null,
    ),
  };

  let content = EMPTY_CONTENT;
  try {
    content = await getHomePage(phase);
  } catch {
    // getHomePage は領域ごとに欠落を表現して返すため、ここに来るのは想定外の例外のみ
  }

  const festivalName = content.festival?.name || '荒牧祭';
  const eventDays = content.festival?.eventDays ?? [];
  const heroImageUrls = content.heroImages
    .map((image) => toAssetUrl(image.id, 1920))
    .filter((url): url is string => url !== null);
  const eventDaysSummary = formatEventDaysSummary(eventDays);
  const countdownDays =
    eventDays.length > 0 ? getDaysUntilEventDay(eventDays[0].startAt) : null;

  if (phase === 'live') {
    // 企画一覧・協賛はトップページ以外でも使う汎用の取得層のため、開催中フェーズでのみ
    // ここから呼ぶ (getHomePage には含めない、design.md Requirement 3)
    const [exhibitions, sponsors] = await Promise.all([
      getFeaturedExhibitions(),
      getSponsorLogos(),
    ]);

    return (
      <div>
        <JsonLd data={structuredData} />
        <h1 className="sr-only">{festivalName}</h1>

        {heroImageUrls.length > 0 && (
          <HeroSection
            imageUrls={heroImageUrls}
            eventDaysSummary={eventDaysSummary}
            venueName={content.venueName}
            themeWord={content.theme?.word ?? null}
            countdownDays={countdownDays}
            phase="live"
          />
        )}

        {content.topics.length > 0 && (
          <section className={SECTION_CLASS}>
            <SectionHeading level="h2">トピック</SectionHeading>
            <TopicsList
              topics={content.topics.map((t) => ({
                id: t.id,
                title: t.title,
                imageId: t.imageId,
              }))}
              variant="scroll"
            />
          </section>
        )}

        <section className={SECTION_CLASS}>
          <SectionHeading level="h2">会場で使う</SectionHeading>
          <PrimaryNavGrid />
        </section>

        <section className={SECTION_CLASS}>
          <SectionHeading level="h2">企画</SectionHeading>
          <div className="flex flex-col gap-4 lg:gap-6">
            <ExhibitionSearchForm />
            <FeaturedExhibitions exhibitions={exhibitions} />
          </div>
        </section>

        <NoticesSection announcements={content.announcements} />

        {content.festival && (
          <AboutSection overviewHtml={content.festival.overviewHtml} />
        )}

        <AccessSection
          venueName={content.venueName}
          accessSummary={content.accessSummary}
        />

        <SponsorsList sponsors={sponsors} />
      </div>
    );
  }

  return (
    <div>
      <JsonLd data={structuredData} />
      <h1 className="sr-only">{festivalName}</h1>

      {heroImageUrls.length > 0 && (
        <HeroSection
          imageUrls={heroImageUrls}
          eventDaysSummary={eventDaysSummary}
          venueName={content.venueName}
          themeWord={content.theme?.word ?? null}
          countdownDays={countdownDays}
        />
      )}

      {content.festival && (
        <AboutSection overviewHtml={content.festival.overviewHtml} />
      )}

      <NoticesSection announcements={content.announcements} />
    </div>
  );
}
