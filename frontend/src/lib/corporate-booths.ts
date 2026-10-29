import type { MapArea, Media, Sponsor } from '@/cms-types';
import { cms, type CmsFetchError } from './cms';
import { toJstDateKey } from './event-day';
import {
  formatPlacementLocation,
  type CorporateBoothCard,
  type CorporateBoothDetail,
  type ExhibitionImage,
} from './exhibitions';

export type CorporateBoothDetailResult =
  | { readonly kind: 'found'; readonly value: CorporateBoothDetail }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error'; readonly error: CmsFetchError };

export interface CorporateBoothSitemapEntry {
  readonly id: number;
  readonly updatedAt: string;
}

/** type に 'vendor' を含み、vendor.name が空白以外の文字を含む */
export function isCorporateBooth(sponsor: Sponsor): boolean {
  return sponsor.type.includes('vendor') && !!sponsor.vendor?.name?.trim();
}

// depth 0 では media が ID のままで alt を持たないため、alt は常に企画名にする。
function toImage(media: number | Media, alt: string): ExhibitionImage {
  return { id: String(typeof media === 'object' ? media.id : media), alt };
}

function toAreaId(sponsor: Sponsor): number | null {
  const ref = sponsor.vendor?.area_id;
  if (ref === null || ref === undefined) return null;
  return typeof ref === 'object' ? ref.id : ref;
}

function toCard(
  sponsor: Sponsor,
  areasById: ReadonlyMap<number, MapArea>,
): CorporateBoothCard {
  const vendor = sponsor.vendor;
  const displayName = vendor?.name?.trim() ?? '';
  const areaId = toAreaId(sponsor);
  const images = vendor?.images ?? [];
  return {
    id: sponsor.id,
    category: 'booth',
    displayName,
    organizationName: sponsor.name,
    location: formatPlacementLocation(
      areaId === null ? undefined : areasById.get(areaId)?.name,
      vendor?.booth_label,
      vendor?.booth_number,
    ),
    areaIds: areaId === null ? [] : [areaId],
    thumbnail: images.length > 0 ? toImage(images[0]!, displayName) : null,
  };
}

function fetchAreas() {
  return cms.findMany('map_areas', { sort: ['_order'], limit: 0, depth: 0 });
}

function fetchBoothSponsors() {
  return cms.findMany('sponsors', {
    // hasMany select の in は包含判定になる。CmsWhere は配列型で受けるため型だけ合わせる
    where: { type: { in: ['vendor' as unknown as Sponsor['type']] } },
    sort: ['_order'],
    limit: 0,
    depth: 0,
  });
}

const indexAreas = (areas: readonly MapArea[]) =>
  new Map(areas.map((a) => [a.id, a]));

/** 取得失敗時は例外を投げる */
export async function getCorporateBoothCards(): Promise<
  readonly CorporateBoothCard[]
> {
  const [sponsors, areas] = await Promise.all([
    fetchBoothSponsors(),
    fetchAreas(),
  ]);
  if (!sponsors.ok || !areas.ok) {
    throw new Error('企業ブースの取得に失敗しました');
  }
  const areasById = indexAreas(areas.value.docs);
  return sponsors.value.docs
    .filter(isCorporateBooth)
    .map((s) => toCard(s, areasById));
}

/** id が整数でない・not_found・isCorporateBooth が偽なら missing */
export async function getCorporateBoothDetail(
  id: string,
): Promise<CorporateBoothDetailResult> {
  if (!/^\d+$/.test(id)) return { kind: 'missing' };

  const [sponsorResult, areasResult] = await Promise.all([
    cms.findById('sponsors', Number(id), { depth: 0 }),
    fetchAreas(),
  ]);
  if (!sponsorResult.ok) {
    return sponsorResult.error.kind === 'network'
      ? { kind: 'error', error: sponsorResult.error }
      : { kind: 'missing' };
  }
  const sponsor = sponsorResult.value;
  if (!isCorporateBooth(sponsor)) return { kind: 'missing' };
  if (!areasResult.ok) return { kind: 'error', error: areasResult.error };

  const card = toCard(sponsor, indexAreas(areasResult.value.docs));
  const vendor = sponsor.vendor;
  return {
    kind: 'found',
    value: {
      ...card,
      description: vendor?.description ?? null,
      images: (vendor?.images ?? []).map((m) => toImage(m, card.displayName)),
      links: sponsor.url ? [{ platform: 'website', url: sponsor.url }] : [],
      categories: ['booth'],
      openDayKeys: (vendor?.open_days ?? [])
        .filter((v) => !Number.isNaN(Date.parse(v)))
        .map(toJstDateKey),
    },
  };
}

/** 取得失敗時は例外を投げる */
export async function getCorporateBoothSitemapEntries(): Promise<
  readonly CorporateBoothSitemapEntry[]
> {
  const result = await fetchBoothSponsors();
  if (!result.ok) throw new Error('企業ブースの取得に失敗しました');
  return result.value.docs
    .filter(isCorporateBooth)
    .map((s) => ({ id: s.id, updatedAt: s.updatedAt }));
}
