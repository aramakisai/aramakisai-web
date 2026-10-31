import type { SponsorListItem } from './sponsors';
import type { Sponsor } from '@/cms-types';
import { cms, type CmsFetchOptions } from './cms';
import { websiteUrl } from './regional-sponsors';
import type { MarqueeTier } from './sponsor-marquee';

export type AdSponsor = Readonly<{
  id: number;
  name: string;
  tier: MarqueeTier;
  logoId: string | null;
  url: string | null;
}>;
export type AdSponsorsByTier = Readonly<
  Record<MarqueeTier, readonly AdSponsor[]>
>;

export async function getPersonalSponsors(
  options?: CmsFetchOptions,
): Promise<readonly { id: number; name: string }[]> {
  const result = await cms.findMany(
    'sponsors',
    {
      // hasMany select の equals は包含判定になる。CmsWhere は配列型で受けるため型だけ合わせる
      where: { type: { equals: 'personal' as unknown as Sponsor['type'] } },
      sort: ['_order'],
      limit: 0,
      depth: 0,
    },
    options,
  );
  if (!result.ok) throw new Error('Failed to load personal sponsors');
  return result.value.docs.flatMap(({ id, name }) => {
    const trimmedName = name.trim();
    return trimmedName ? [{ id, name: trimmedName }] : [];
  });
}

export function groupAdSponsors(
  sponsors: readonly SponsorListItem[],
): AdSponsorsByTier {
  const groups: Record<MarqueeTier, AdSponsor[]> = {
    planA: [],
    planB: [],
    planC: [],
    planD: [],
  };
  for (const sponsor of sponsors) {
    const { tier } = sponsor;
    if (
      tier !== 'planA' &&
      tier !== 'planB' &&
      tier !== 'planC' &&
      tier !== 'planD'
    )
      continue;
    const name = sponsor.name?.trim();
    if (!name) continue;
    groups[tier].push({
      id: sponsor.id,
      name,
      tier,
      logoId: tier === 'planD' ? null : sponsor.logoId?.trim() || null,
      url: websiteUrl(sponsor.url),
    });
  }
  return groups;
}
