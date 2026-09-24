import { cms } from './cms';
import { toMediaId } from './cms-media';

export interface StaticPageContent {
  title: string;
  contentHtml: string;
  embedUrl: string | null;
  embedHeight: number | null;
  /** 既存呼び出し側 ([slug]/page.test.tsx 等) との互換のため任意にしている */
  metaDescription?: string | null;
  ogImageId?: string | null;
  updatedAt?: string;
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
    metaDescription: page.meta_description ?? null,
    ogImageId: toMediaId(page.og_image),
    updatedAt: page.updatedAt,
  };
}

export interface PageSlugUpdatedAt {
  readonly slug: string;
  readonly updatedAt: string;
}

/**
 * sitemap 用。渡した slug のうち `pages` に実在するものだけを返す
 * (コード定義ルートの候補に実体の無い固定ページを sitemap へ載せないため)。
 */
export async function getPageSlugsUpdatedAt(
  slugs: readonly string[],
): Promise<readonly PageSlugUpdatedAt[]> {
  if (slugs.length === 0) return [];

  const result = await cms.findMany('pages', {
    where: { slug: { in: slugs } },
    limit: 0,
    depth: 0,
  });
  if (!result.ok) return [];

  return result.value.docs.map((page) => ({
    slug: page.slug,
    updatedAt: page.updatedAt,
  }));
}
