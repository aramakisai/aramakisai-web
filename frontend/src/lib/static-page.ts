import { cms } from './cms';

export interface StaticPageContent {
  title: string;
  contentHtml: string;
  embedUrl: string | null;
  embedHeight: number | null;
}

export async function getPageBySlug(
  slug: string,
): Promise<StaticPageContent | null> {
  const result = await cms.findMany('pages', {
    where: { slug: { equals: slug } },
    limit: 1,
  });
  if (!result.ok) return null;

  const page = result.value.docs[0];
  if (!page) return null;

  return {
    title: page.title,
    contentHtml: page.content_html || '',
    embedUrl: page.embed_url ?? null,
    embedHeight: page.embed_height ?? null,
  };
}
