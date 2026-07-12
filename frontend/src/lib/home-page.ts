import { readSingleton, readItems } from '@directus/sdk';
import { directus } from './directus';
import {
  HomeActiveVariant,
  HomePageResult,
  PreEventHomeContent,
  HomePageContent,
  AnnouncementSummary,
  TopicSummary,
  FestivalOverview,
  SponsorSummary,
} from './home-page-types';

/**
 * overrideVariant: dev環境専用。festival_meta.home_active_variantより優先する。
 * 呼び出し側(page.tsx)がNEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE有効時に
 * URLクエリパラメータから渡す。本番では常に渡されない。
 */
export async function getHomePage(
  overrideVariant?: HomeActiveVariant,
): Promise<HomePageResult> {
  let activeVariant: 'pre_event' | 'live' = 'pre_event';

  const meta = await directus.request(readSingleton('festival_meta'));

  if (overrideVariant === 'pre_event' || overrideVariant === 'live') {
    activeVariant = overrideVariant;
  } else {
    const variant = meta.home_active_variant;
    if (variant === 'pre_event' || variant === 'live') {
      activeVariant = variant;
    }
  }

  const snsLinks = meta.sns_links || [];

  const festival: FestivalOverview = {
    name: meta.name || '',
    eventDays: meta.event_days || [],
    admissionFee: meta.admission_fee,
    paymentNote: meta.payment_note,
  };

  const sponsorsData = await directus.request(
    readItems('sponsors', {
      sort: ['sort'],
    }),
  );

  const sponsors: SponsorSummary[] = (sponsorsData || []).map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    logoId: s.logo,
    url: s.url,
    tier: s.tier,
  }));

  const announcementsData = await directus.request(
    readItems('announcements', {
      filter: { published_at: { _lte: '$NOW', _nnull: true } },
      sort: ['-published_at'],
      limit: 10,
    }),
  );

  const announcements: AnnouncementSummary[] = announcementsData.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body || '',
    publishedAt: a.published_at as string,
  }));

  if (activeVariant === 'live') {
    const pageHomeLive = await directus.request(
      readSingleton('page_home_live'),
    );

    const content: HomePageContent = {
      heroImageId: pageHomeLive.hero_image,
      heroMessageHtml: pageHomeLive.hero_message || '',
      embedUrl: pageHomeLive.embed_url,
      snsLinks,
      festival,
      sponsors,
      announcements,
    };

    return { variant: 'live', content };
  } else {
    const pageHome = await directus.request(readSingleton('page_home'));

    const topicsData = await directus.request(
      readItems('topics', {
        sort: ['sort'],
      }),
    );

    const topics: TopicSummary[] = topicsData.map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      imageId: t.image,
      linkUrl: t.link_url,
    }));

    const content: PreEventHomeContent = {
      heroImageId: pageHome.hero_image,
      heroMessageHtml: pageHome.hero_message || '',
      embedUrl: pageHome.embed_url,
      snsLinks,
      festival,
      sponsors,
      announcements,
      topics,
    };

    return { variant: 'pre_event', content };
  }
}
