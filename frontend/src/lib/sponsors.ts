import type { Sponsor } from '@/cms-types';
import { cms } from './cms';
import { toMediaId } from './cms-media';
import { SponsorType } from './home-page-types';

const SPONSOR_TYPES = [
  'ad',
  'local',
  'vendor',
  'other',
] as const satisfies readonly SponsorType[];

export interface SponsorListItem {
  id: number;
  name: string;
  logoId: string | null;
  url: string | null;
  tier: string | null;
}

export type SponsorsByType = Readonly<
  Record<SponsorType, readonly SponsorListItem[]>
>;

export type GetSponsorsResult =
  | { readonly ok: true; readonly value: SponsorsByType }
  | { readonly ok: false };

function mapSponsor(s: Sponsor): SponsorListItem {
  return {
    id: s.id,
    name: s.name,
    logoId: toMediaId(s.logo),
    url: s.url ?? null,
    tier: s.tier ?? null,
  };
}

export async function getSponsors(): Promise<GetSponsorsResult> {
  const result = await cms.findMany('sponsors', {
    sort: ['sort'],
    limit: 0,
    depth: 1,
  });
  if (!result.ok) return { ok: false };

  // 1 件が複数種別を持てるため、同じ協賛が複数の一覧に重複して現れうる。
  const withType = result.value.docs.map((s) => ({
    type: s.type,
    item: mapSponsor(s),
  }));
  const value = SPONSOR_TYPES.reduce(
    (acc, type) => {
      acc[type] = withType
        .filter((s) => s.type.includes(type))
        .map((s) => s.item);
      return acc;
    },
    {} as Record<SponsorType, readonly SponsorListItem[]>,
  );

  return { ok: true, value };
}
