import type { MetadataRoute } from 'next';
import { env } from '@/env';
import { cms } from '@/lib/cms';
import { getAnnouncements } from '@/lib/announcements';
import { getCampusMapLastModified } from '@/lib/campus-map';
import { crawlPhase, SITEMAP_CODE_ROUTES } from '@/lib/crawl-targets';
import { getExhibitionSitemapEntries } from '@/lib/exhibitions';
import { getFaqItems } from '@/lib/faq';
import { getParkingEnabled } from '@/lib/festival-meta';
import { isPublicPath } from '@/lib/phase';
import { getPageSlugsUpdatedAt } from '@/lib/static-page';
import { getTopics } from '@/lib/topics';

// CMS 更新を再デプロイなしで即時に反映するため、ISR (revalidate) ではなく
// リクエスト時生成にする
export const dynamic = 'force-dynamic';

// 一覧・詳細を専用の取得処理で列挙するルート。SITEMAP_CODE_ROUTES から
// [slug] 固定ページ候補を取り出す際にこれらを除く。
const OWN_HANDLING_ROUTES: readonly string[] = [
  '/',
  '/announcements',
  '/exhibitions',
  '/topics',
  '/map',
  '/faq',
  '/timetable',
];

function toUrl(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();
}

function maxUpdatedAt(
  values: readonly (string | undefined)[],
): string | undefined {
  const defined = values.filter((v): v is string => Boolean(v));
  return defined.length > 0
    ? defined.reduce((latest, v) => (v > latest ? v : latest))
    : undefined;
}

async function getHomeLastModified(): Promise<string | undefined> {
  const result = await cms.findGlobal('festival_meta', { depth: 0 });
  return result.ok ? (result.value.updatedAt ?? undefined) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const phase = crawlPhase();
  const entries: MetadataRoute.Sitemap = [
    { url: toUrl('/'), lastModified: await getHomeLastModified() },
  ];

  if (isPublicPath('/announcements', phase)) {
    try {
      const announcements = await getAnnouncements();
      entries.push({
        url: toUrl('/announcements'),
        lastModified: maxUpdatedAt(announcements.map((a) => a.updatedAt)),
      });
      for (const announcement of announcements) {
        const path = `/announcements/${announcement.id}`;
        if (isPublicPath(path, phase)) {
          entries.push({
            url: toUrl(path),
            lastModified: announcement.updatedAt,
          });
        }
      }
    } catch {
      // お知らせ取得の失敗は一覧・詳細の両エントリを丸ごと欠落させ、他の取得結果で応答する。
    }
  }

  if (isPublicPath('/topics', phase)) {
    try {
      const topics = await getTopics();
      entries.push({
        url: toUrl('/topics'),
        lastModified: maxUpdatedAt(topics.map((t) => t.updatedAt)),
      });
      for (const topic of topics) {
        const path = `/topics/${topic.id}`;
        if (isPublicPath(path, phase)) {
          entries.push({ url: toUrl(path), lastModified: topic.updatedAt });
        }
      }
    } catch {
      // 同上
    }
  }

  if (isPublicPath('/exhibitions', phase)) {
    try {
      const exhibitions = await getExhibitionSitemapEntries();
      entries.push({
        url: toUrl('/exhibitions'),
        lastModified: maxUpdatedAt(exhibitions.map((e) => e.updatedAt)),
      });
      for (const exhibition of exhibitions) {
        const path = `/exhibitions/${exhibition.id}/${exhibition.category}`;
        if (isPublicPath(path, phase)) {
          entries.push({
            url: toUrl(path),
            lastModified: exhibition.updatedAt,
          });
        }
      }
    } catch {
      // 同上
    }
  }

  if (isPublicPath('/map', phase)) {
    entries.push({
      url: toUrl('/map'),
      lastModified: (await getCampusMapLastModified()) ?? undefined,
    });
  }

  if (isPublicPath('/timetable', phase)) {
    entries.push({ url: toUrl('/timetable') });
  }

  if (isPublicPath('/parking', phase)) {
    const parking = await getParkingEnabled();
    if (parking.ok && parking.value) {
      entries.push({ url: toUrl('/parking') });
    }
  }

  if (isPublicPath('/faq', phase)) {
    try {
      const faqItems = await getFaqItems();
      entries.push({
        url: toUrl('/faq'),
        lastModified: maxUpdatedAt(faqItems.map((item) => item.updatedAt)),
      });
    } catch {
      // 同上
    }
  }

  const slugCandidates = SITEMAP_CODE_ROUTES.filter(
    (path) => !OWN_HANDLING_ROUTES.includes(path),
  )
    .map((path) => path.slice(1))
    .filter((slug) => isPublicPath(`/${slug}`, phase));

  const pages = await getPageSlugsUpdatedAt(slugCandidates);
  for (const page of pages) {
    entries.push({ url: toUrl(`/${page.slug}`), lastModified: page.updatedAt });
  }

  return entries;
}
