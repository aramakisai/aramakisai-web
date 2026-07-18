import { readItems } from '@directus/sdk';
import { directus } from './directus';

export interface StaticPageContent {
  title: string;
  contentHtml: string;
  embedUrl: string | null;
  embedHeight: number | null;
}

export async function getPageBySlug(
  slug: string,
): Promise<StaticPageContent | null> {
  try {
    const pages = await directus.request(
      readItems('pages', { filter: { slug: { _eq: slug } }, limit: 1 }),
    );
    const page = pages[0];
    if (!page) return null;

    return {
      title: page.title,
      contentHtml: page.content || '',
      embedUrl: page.embed_url,
      embedHeight: page.embed_height,
    };
  } catch {
    return null;
  }
}
