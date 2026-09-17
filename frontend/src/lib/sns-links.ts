import { cms } from './cms';
import { SnsLink } from './home-page-types';

export async function getSnsLinks(): Promise<SnsLink[]> {
  const result = await cms.findGlobal('festival_meta');
  if (!result.ok || !result.value.sns_links) return [];
  return result.value.sns_links as SnsLink[];
}
