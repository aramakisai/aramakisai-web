import { getFestivalMeta } from './festival-meta';
import { toAssetUrl } from './cms-asset-url';
import { toMetaDescription } from './meta-description';
import type { FestivalMeta } from './home-page-types';

export const FALLBACK_SITE_TITLE = '荒牧祭';
export const FALLBACK_SITE_DESCRIPTION = '荒牧祭公式サイト';

export interface SiteMetadata {
  readonly siteTitle: string;
  readonly description: string;
  readonly ogImageUrl: string | null;
  readonly festival: FestivalMeta | null;
}

function withDevPrefix(title: string): string {
  return process.env.NODE_ENV === 'development'
    ? `【開発環境】 ${title}`
    : title;
}

/**
 * CMS 障害時も例外を外へ出さない。root layout を含む全ページの
 * generateMetadata がここに依存するため、ここで落ちるとサイト全体が壊れる。
 */
export async function getSiteMetadata(): Promise<SiteMetadata> {
  let festival: FestivalMeta | null = null;
  try {
    festival = await getFestivalMeta();
  } catch {
    festival = null;
  }

  const titleBase =
    festival?.siteTitle || festival?.name || FALLBACK_SITE_TITLE;
  const description = toMetaDescription(
    [festival?.metaDescription, festival?.overviewHtml],
    FALLBACK_SITE_DESCRIPTION,
  );
  const ogImageUrl = festival ? toAssetUrl(festival.ogImageId, 960) : null;

  return {
    siteTitle: withDevPrefix(titleBase),
    description,
    ogImageUrl,
    festival,
  };
}
