import { publishedFilter } from './announcements';
import { cms } from './cms';
import { toAttachments, toMediaId } from './cms-media';
import {
  HomePageContent,
  AnnouncementSummary,
  TopicSummary,
  FestivalOverview,
  FestivalTheme,
  SponsorSummary,
  SnsLink,
} from './home-page-types';

export async function getHomePage(): Promise<HomePageContent> {
  const metaResult = await cms.findGlobal('festival_meta', { depth: 1 });
  if (!metaResult.ok) throw new Error('祭メタ情報の取得に失敗しました');
  const meta = metaResult.value;

  const festival: FestivalOverview = {
    name: meta.name || '',
    eventDays: (meta.event_days as FestivalOverview['eventDays']) || [],
    overviewHtml: meta.overview_html || null,
    heroImageId: toMediaId(meta.hero_image),
  };

  const theme: FestivalTheme = {
    word: meta.theme_word || null,
    imageId: toMediaId(meta.theme_image),
    descriptionHtml: meta.theme_description_html || null,
  };

  // 一覧の取得失敗は空配列に倒し、他セクションの描画を継続する
  const sponsorsResult = await cms.findMany('sponsors', {
    sort: ['sort'],
    limit: 0,
    depth: 1,
  });
  const sponsors: SponsorSummary[] = (
    sponsorsResult.ok ? sponsorsResult.value.docs : []
  ).map((s) => ({
    id: s.id,
    type: s.type,
    name: s.name,
    logoId: toMediaId(s.logo),
    url: s.url ?? null,
    tier: s.tier ?? null,
  }));

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

  const topicsResult = await cms.findMany('topics', {
    sort: ['sort'],
    limit: 0,
    depth: 1,
  });
  const topics: TopicSummary[] = (
    topicsResult.ok ? topicsResult.value.docs : []
  ).map((t) => ({
    id: t.id,
    title: t.title,
    body: t.body_html ?? null,
    imageId: toMediaId(t.image),
    attachments: toAttachments(t.attachments),
  }));

  const pageHomeResult = await cms.findGlobal('page_home', { depth: 1 });
  if (!pageHomeResult.ok) throw new Error('トップページの取得に失敗しました');
  const pageHome = pageHomeResult.value;

  return {
    heroImages: toAttachments(pageHome.hero_images),
    heroMessageHtml: pageHome.hero_message_html || '',
    snsLinks: (meta.sns_links as SnsLink[]) || [],
    festival,
    theme,
    venueName: meta.venue_name || null,
    campusMapUrl: meta.campus_map_url || null,
    contactFormUrl: meta.contact_form_url || null,
    sponsors,
    announcements,
    topics,
  };
}
