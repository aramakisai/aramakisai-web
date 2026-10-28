import type { Sponsor } from '@/cms-types';

import { cms, type CmsFetchOptions } from './cms';
import { toMediaId } from './cms-media';
import {
  REGIONAL_MAP_TILE_PROFILE,
  isWithinMapTileProfile,
} from './map-tile-profile';

export {
  REGIONAL_SPONSOR_CATEGORIES,
  REGIONAL_SPONSOR_CATEGORY_LABELS,
  type RegionalSponsorCategory,
} from './regional-sponsor-categories';

export interface RegionalSponsor {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string | null;
  readonly imageId: string | null;
  readonly imageAlt: string | null;
  readonly imageDecorative: boolean;
  readonly message: string | null;
  readonly businessHours: string | null;
  readonly phone: string | null;
  readonly websiteUrl: string | null;
  readonly order: number;
}

export type RegionalSponsorMapDataResult =
  | { readonly ok: true; readonly sponsors: readonly RegionalSponsor[] }
  | { readonly ok: false; readonly error: 'unavailable' };

export type RegionalSponsorConversion =
  | { readonly ok: true; readonly value: RegionalSponsor }
  | { readonly ok: false; readonly reasons: readonly string[] };

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function websiteUrl(value: unknown): string | null {
  const text = optionalText(value);
  if (text === null) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function isCoordinate(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

export function toRegionalSponsor(
  sponsor: Sponsor,
  order: number,
): RegionalSponsorConversion {
  const reasons: string[] = [];
  if (!sponsor.type.includes('local')) reasons.push('typeにlocalがない');
  const name = optionalText(sponsor.name);
  if (name === null) reasons.push('nameが空');
  const category = optionalText(sponsor.business_category);
  if (category === null) reasons.push('business_categoryが空');
  if (!isCoordinate(sponsor.local_latitude, -90, 90)) {
    reasons.push('local_latitudeが不正');
  }
  if (!isCoordinate(sponsor.local_longitude, -180, 180)) {
    reasons.push('local_longitudeが不正');
  }
  if (
    isCoordinate(sponsor.local_latitude, -90, 90) &&
    isCoordinate(sponsor.local_longitude, -180, 180) &&
    !isWithinMapTileProfile(
      REGIONAL_MAP_TILE_PROFILE,
      sponsor.local_latitude,
      sponsor.local_longitude,
    )
  ) {
    reasons.push('地域タイル提供範囲外');
  }
  if (reasons.length > 0) return { ok: false, reasons };

  const imageId = toMediaId(sponsor.local_image);
  // 代替テキストは media の alt。空なら装飾画像として扱う。
  const alt =
    typeof sponsor.local_image === 'object' && sponsor.local_image !== null
      ? optionalText(sponsor.local_image.alt)
      : null;

  return {
    ok: true,
    value: {
      id: sponsor.id,
      name: name!,
      category: category!,
      latitude: sponsor.local_latitude!,
      longitude: sponsor.local_longitude!,
      address: optionalText(sponsor.address),
      imageId,
      imageAlt: alt,
      imageDecorative: alt === null,
      message: optionalText(sponsor.description),
      businessHours: optionalText(sponsor.local_business_hours),
      phone: optionalText(sponsor.local_phone),
      websiteUrl: websiteUrl(sponsor.url),
      order,
    },
  };
}

function compareSponsors(a: Sponsor, b: Sponsor): number {
  if (a._order == null && b._order != null) return 1;
  if (a._order != null && b._order == null) return -1;
  if (a._order !== b._order) return a._order! < b._order! ? -1 : 1;
  return a.id - b.id;
}

const SPONSOR_SELECT = {
  name: true,
  type: true,
  address: true,
  url: true,
  description: true,
  _order: true,
  business_category: true,
  local_latitude: true,
  local_longitude: true,
  local_image: true,
  local_business_hours: true,
  local_phone: true,
} as const;

export async function getRegionalSponsorMapData(
  options?: CmsFetchOptions,
): Promise<RegionalSponsorMapDataResult> {
  const result = await cms.findMany(
    'sponsors',
    {
      // hasMany select の equals は包含判定になる。CmsWhere は配列型で受けるため型だけ合わせる
      where: { type: { equals: 'local' as unknown as Sponsor['type'] } },
      select: SPONSOR_SELECT,
      sort: ['_order', 'id'],
      limit: 0,
      depth: 1,
    },
    options,
  );
  if (!result.ok) return { ok: false, error: 'unavailable' };

  const localSponsors = result.value.docs
    .filter((sponsor) => sponsor.type.includes('local'))
    .slice()
    .sort(compareSponsors);
  const sponsors: RegionalSponsor[] = [];
  for (const sponsor of localSponsors) {
    const converted = toRegionalSponsor(sponsor, sponsors.length);
    if (converted.ok) {
      sponsors.push(converted.value);
    } else {
      console.warn('regional_sponsor_excluded', {
        id: sponsor.id,
        reasons: converted.reasons,
      });
    }
  }
  return { ok: true, sponsors };
}
