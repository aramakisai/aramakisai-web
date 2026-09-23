import type { MetadataRoute } from 'next';
import { env } from '@/env';
import { getAnnouncements } from '@/lib/announcements';
import { PRE_EVENT_PUBLIC_PATHS } from '@/lib/phase';

function toUrl(path: string): string {
  return new URL(path, env.NEXT_PUBLIC_SITE_URL).toString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PRE_EVENT_PUBLIC_PATHS.map(
    (path) => ({ url: toUrl(path) }),
  );

  let announcementEntries: MetadataRoute.Sitemap = [];
  try {
    const announcements = await getAnnouncements();
    announcementEntries = announcements.map((announcement) => ({
      url: toUrl(`/announcements/${announcement.id}`),
    }));
  } catch {
    // sitemap は検索エンジン向けの補助情報であり、CMS 取得失敗時に 500 を返さず
    // 固定パスのみで応答する。
  }

  return [...staticEntries, ...announcementEntries];
}
