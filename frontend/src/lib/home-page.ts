import { readSingleton, readItems } from '@directus/sdk';
import {
  directus,
  type AnnouncementFile,
  type TopicFile,
  type PageHomeFile,
} from './directus';
import {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HERO_IMAGES_DEEP_FIELDS: any = [
  'hero_images.sort',
  'hero_images.directus_files_id.id',
  'hero_images.directus_files_id.filename_download',
  'hero_images.directus_files_id.type',
];

function formatAttachments(
  raw: (AnnouncementFile | TopicFile | PageHomeFile)[] | undefined,
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

export async function getHomePage(): Promise<HomePageContent> {
  const meta = await directus.request(
    readSingleton('festival_meta', {
      fields: ['*', 'overview', 'hero_image'],
    }),
  );

  const snsLinks = meta.sns_links || [];

  const festival: FestivalOverview = {
    name: meta.name || '',
    eventDays: meta.event_days || [],
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
    attachments: formatAttachments(t.attachments),
  }));

  const pageHome = await directus.request(
    readSingleton('page_home', {
      fields: ['*', ...HERO_IMAGES_DEEP_FIELDS],
    }),
  );

  return {
    heroImages: formatAttachments(pageHome.hero_images),
    heroMessageHtml: pageHome.hero_message || '',
    snsLinks,
    festival,
    sponsors,
    announcements,
    topics,
  };
}
