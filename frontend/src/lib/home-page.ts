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
import { FestivalPhase } from './phase';

export async function getHomePage(
  phase: FestivalPhase,
): Promise<HomePageContent> {
  const metaResult = await cms.findGlobal('festival_meta', { depth: 1 });
  const meta = metaResult.ok ? metaResult.value : null;

  const festival: FestivalOverview | null = meta && {
    name: meta.name || '',
    eventDays: toEventDays(meta.event_days),
    overviewHtml: meta.overview_html || null,
    heroImageId: toMediaId(meta.hero_image),
  };

  const theme: FestivalTheme | null = meta && {
    word: meta.theme_word || null,
    imageId: toMediaId(meta.theme_image),
    descriptionHtml: meta.theme_description_html || null,
  };

  const announcementsResult = await cms.findMany('announcements', {
    where: publishedFilter(),
    sort: ['-published_at'],
    limit: 10,
    depth: 1,
  });
  const announcements: AnnouncementSummary[] = (
    announcementsResult.ok ? announcementsResult.value.docs : []
  ).map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body_html || '',
    publishedAt: a.published_at as string,
    attachments: toAttachments(a.attachments),
  }));

  // トピックス詳細は開催前フェーズで非公開のため、節を描画しないだけでなく
  // 毎リクエスト走る取得自体をここで止める (トップページは動的描画のため)。
  const topicsResult =
    phase === 'pre_event'
      ? null
      : await cms.findMany('topics', {
          where: publishedFilter(),
          sort: ['-published_at'],
          limit: 0,
          depth: 1,
        });
  const topics: TopicSummary[] = (
    topicsResult?.ok ? topicsResult.value.docs : []
  ).map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body_html ?? null,
    imageId: toMediaId(t.image),
  }));

  const pageHomeResult = await cms.findGlobal('page_home', { depth: 1 });
  const pageHome = pageHomeResult.ok ? pageHomeResult.value : null;

  return {
    heroImages: pageHome ? toAttachments(pageHome.hero_images) : [],
    heroMessageHtml: pageHome ? pageHome.hero_message_html || null : null,
    snsLinks: (meta?.sns_links as SnsLink[] | undefined) || [],
    festival,
    theme,
    venueName: meta?.venue_name || null,
    campusMapUrl: meta?.campus_map_url || null,
    contactFormUrl: meta?.contact_form_url || null,
    accessSummary: meta?.access_summary || null,
    announcements,
    topics,
  };
}
