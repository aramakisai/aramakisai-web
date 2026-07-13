import { readItems } from '@directus/sdk';
import { directus } from './directus';

export interface StaticPageContent {
  contentHtml: string;
  embedUrl: string | null;
}

async function getPageBySlug(slug: string) {
  const pages = await directus.request(
    readItems('pages', { filter: { slug: { _eq: slug } }, limit: 1 }),
  );
  const page = pages[0];
  if (!page) throw new Error(`page not found: ${slug}`);
  return page;
}

export async function getContactPage(): Promise<StaticPageContent> {
  const page = await getPageBySlug('contact');
  return { contentHtml: page.content || '', embedUrl: page.form_embed_url };
}

export async function getAccessPage(): Promise<StaticPageContent> {
  const page = await getPageBySlug('access');
  return { contentHtml: page.content || '', embedUrl: page.map_embed_url };
}

export async function getPrivacyPage(): Promise<StaticPageContent> {
  const page = await getPageBySlug('privacy');
  return { contentHtml: page.content || '', embedUrl: null };
}
