import { readSingleton } from '@directus/sdk';
import { directus } from './directus';

export interface StaticPageContent {
  contentHtml: string;
  embedUrl: string | null;
}

export async function getContactPage(): Promise<StaticPageContent> {
  const page = await directus.request(readSingleton('page_contact'));
  return { contentHtml: page.content || '', embedUrl: page.form_embed_url };
}

export async function getAccessPage(): Promise<StaticPageContent> {
  const page = await directus.request(readSingleton('page_access'));
  return { contentHtml: page.content || '', embedUrl: page.map_embed_url };
}

export async function getPrivacyPage(): Promise<StaticPageContent> {
  const page = await directus.request(readSingleton('page_privacy'));
  return { contentHtml: page.content || '', embedUrl: null };
}
