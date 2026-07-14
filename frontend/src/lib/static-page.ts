import { readItems } from '@directus/sdk';
import { directus } from './directus';

export interface StaticPageContent {
  title: string;
  contentHtml: string;
  embedUrl: string | null;
  embedHeight: number | null;
}

async function getPageBySlug(slug: string): Promise<StaticPageContent> {
  const pages = await directus.request(
    readItems('pages', { filter: { slug: { _eq: slug } }, limit: 1 }),
  );
  const page = pages[0];
  if (!page) throw new Error(`page not found: ${slug}`);
  return {
    title: page.title,
    contentHtml: page.content || '',
    embedUrl: page.embed_url,
    embedHeight: page.embed_height,
  };
}

export async function getContactPage(): Promise<StaticPageContent> {
  return getPageBySlug('contact');
}

export async function getAccessPage(): Promise<StaticPageContent> {
  return getPageBySlug('access');
}

export async function getPrivacyPage(): Promise<StaticPageContent> {
  return getPageBySlug('privacy');
}
