import { readSingleton } from '@directus/sdk';
import { directus } from './directus';
import { SnsLink } from './home-page-types';

export async function getSnsLinks(): Promise<SnsLink[]> {
  try {
    const meta = await directus.request(
      readSingleton('festival_meta', { fields: ['sns_links'] }),
    );
    if (!meta || !meta.sns_links) {
      return [];
    }
    return meta.sns_links as SnsLink[];
  } catch {
    return [];
  }
}
