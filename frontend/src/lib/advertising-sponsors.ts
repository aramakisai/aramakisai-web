import type { SponsorListItem } from './sponsors';
import type { PersonalSponsor } from '@/cms-types';
import { cms } from './cms';

export type AdTier = 'planA' | 'planB' | 'planC' | 'planD';
export type AdSponsor = Readonly<{
  id: number;
  name: string;
  tier: AdTier;
  logoId: string | null;
  url: string | null;
}>;
export type AdSponsorsByTier = Readonly<Record<AdTier, readonly AdSponsor[]>>;

export async function getPersonalSponsors(): Promise<
  readonly Pick<PersonalSponsor, 'id' | 'name'>[]
> {
  const result = await cms.findMany('personal_sponsors', {
    sort: ['_order'],
    limit: 0,
    depth: 0,
  });
  if (!result.ok) throw new Error('Failed to load personal sponsors');
  return result.value.docs.flatMap(({ id, name }) => {
    const trimmedName = name.trim();
    return trimmedName ? [{ id, name: trimmedName }] : [];
  });
}

function normalizeUrl(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function groupAdSponsors(
  sponsors: readonly SponsorListItem[],
): AdSponsorsByTier {
  const groups: Record<AdTier, AdSponsor[]> = {
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
    if (!name || (tier !== 'planD' && !sponsor.logoId?.trim())) continue;
    groups[tier].push({
      id: sponsor.id,
      name,
      tier,
      logoId: tier === 'planD' ? null : sponsor.logoId,
      url: normalizeUrl(sponsor.url),
    });
  }
  return groups;
}
