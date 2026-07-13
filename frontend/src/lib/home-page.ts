import { readSingleton, readItems } from '@directus/sdk';
import { directus, type AnnouncementFile, type TopicFile } from './directus';
import {
  HomeActiveVariant,
  HomePageResult,
  PreEventHomeContent,
  HomePageContent,
  AnnouncementSummary,
  TopicSummary,
  FestivalOverview,
  SponsorSummary,
  Attachment,
} from './home-page-types';

// Directus SDKの型付きfieldsはドット区切りのdeep-fields文字列を表現できないため、
// このリテラル配列のみ許容してキャストする。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ATTACHMENT_DEEP_FIELDS: any = [
  'attachments.sort',
  'attachments.directus_files_id.id',
  'attachments.directus_files_id.filename_download',
  'attachments.directus_files_id.type',
];

function formatAttachments(
  raw: (AnnouncementFile | TopicFile)[] | undefined,
): Attachment[] {
  return [...(raw || [])]
    .sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0))
    .map((att) => {
      const file = att.directus_files_id;
      if (typeof file === 'string') {
        return { id: file, filenameDownload: '', type: null };
      }
      return {
        id: file.id,
        filenameDownload: file.filename_download,
        type: file.type,
      };
    });
}

/**
 * overrideVariant: dev環境専用。festival_meta.home_active_variantより優先する。
 * 呼び出し側(page.tsx)がNEXT_PUBLIC_ENABLE_HOME_VARIANT_QUERY_OVERRIDE有効時に
 * URLクエリパラメータから渡す。本番では常に渡されない。
 */
export async function getHomePage(
  overrideVariant?: HomeActiveVariant,
): Promise<HomePageResult> {
  let activeVariant: 'pre_event' | 'live' = 'pre_event';

  const meta = await directus.request(
    readSingleton('festival_meta', {
      fields: ['*', 'overview', 'hero_image'],
    }),
  );

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
    overviewHtml: meta.overview || null,
    heroImageId: meta.hero_image || null,
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
      fields: ['*', ...ATTACHMENT_DEEP_FIELDS],
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
    attachments: formatAttachments(a.attachments),
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
        fields: ['*', ...ATTACHMENT_DEEP_FIELDS],
        sort: ['sort'],
      }),
    );

    const topics: TopicSummary[] = topicsData.map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      imageId: t.image,
      linkUrl: t.link_url,
      attachments: formatAttachments(t.attachments),
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
