import { publishedFilter } from './announcements';
import { cms } from './cms';
import { toAttachments, toMediaId } from './cms-media';
import { toEventDays } from './event-day';
import {
  HomePageContent,
  AnnouncementSummary,
  TopicSummary,
  FestivalOverview,
  FestivalTheme,
  SnsLink,
} from './home-page-types';

export async function getHomePage(): Promise<HomePageContent> {
  const [metaResult, announcementsResult, topicsResult] = await Promise.all([
    // ヒーロー画像を Attachment にするため depth 1 で 1 回だけ取る
    cms.findGlobal('site_settings', { depth: 1 }),
    cms.findMany('announcements', {
      where: publishedFilter(),
      sort: ['-published_at'],
      limit: 10,
      depth: 1,
    }),
    cms.findMany('topics', {
      where: publishedFilter(),
      sort: ['-published_at'],
      limit: 0,
      // トップでは一覧カードにしか使わないため本文 HTML を取らない。
      // image は depth 0 で id のまま返り、toMediaId がそのまま扱える
      select: { title: true, image: true },
      depth: 0,
    }),
  ]);
  const meta = metaResult.ok ? metaResult.value : null;

  const festival: FestivalOverview | null = meta && {
    name: meta.name || '',
    eventDays: toEventDays(meta.event_days),
    overviewHtml: meta.overview_html || null,
  };

  const theme: FestivalTheme | null = meta && {
    word: meta.theme_word || null,
    descriptionHtml: meta.theme_description_html || null,
  };

  const announcements: AnnouncementSummary[] = (
    announcementsResult.ok ? announcementsResult.value.docs : []
  ).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body_html || '',
    publishedAt: a.published_at as string,
    attachments: toAttachments(a.attachments),
  }));

  const topics: TopicSummary[] = (
    topicsResult.ok ? topicsResult.value.docs : []
  ).map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body_html ?? null,
    imageId: toMediaId(t.image),
  }));

  return {
    heroImages: meta ? toAttachments(meta.hero_images) : [],
    snsLinks: (meta?.sns_links as SnsLink[] | undefined) || [],
    festival,
    theme,
    contactFormUrl: meta?.contact_form_url || null,
    announcements,
    topics,
  };
}
