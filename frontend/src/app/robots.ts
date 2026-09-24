import type { MetadataRoute } from 'next';
import { env } from '@/env';
import { buildRobotsPlan, crawlPhase } from '@/lib/crawl-targets';

export default function robots(): MetadataRoute.Robots {
  const { allow, disallow } = buildRobotsPlan(crawlPhase());

  return {
    rules: { userAgent: '*', allow: [...allow], disallow: [...disallow] },
    sitemap: new URL('/sitemap.xml', env.NEXT_PUBLIC_SITE_URL).toString(),
  };
}
