import type { MetadataRoute } from 'next';
import { env } from '@/env';
import { cms } from '@/lib/cms';
import { getAnnouncements } from '@/lib/announcements';
import { getCampusMapLastModified } from '@/lib/campus-map';
import { crawlPhase, SITEMAP_CODE_ROUTES } from '@/lib/crawl-targets';
import { getExhibitionSitemapEntries } from '@/lib/exhibitions';
import { isPublicPath } from '@/lib/phase';
import { getPageSlugsUpdatedAt } from '@/lib/static-page';
import { getTopics } from '@/lib/topics';

// OpenNext に incremental cache 設定が無く revalidate が効かないため、CMS 更新を
// 再デプロイなしで反映するにはリクエスト時生成 (force-dynamic) が必要
export const dynamic = 'force-dynamic';

// 一覧・詳細を専用の取得処理で列挙するルート。SITEMAP_CODE_ROUTES から
// [slug] 固定ページ候補を取り出す際にこれらを除く。
const OWN_HANDLING_ROUTES: readonly string[] = [
  '/',
  '/announcements',
  '/exhibitions',
  '/topics',
  '/map',
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
