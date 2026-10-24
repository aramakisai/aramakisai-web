import type { Sponsor } from '@/cms-types';

import { cms, type CmsFetchOptions } from './cms';
import { toMediaId } from './cms-media';
import {
  REGIONAL_SPONSOR_CATEGORIES,
  type RegionalSponsorCategory,
} from './regional-sponsor-categories';

export {
  REGIONAL_SPONSOR_CATEGORIES,
  REGIONAL_SPONSOR_CATEGORY_LABELS,
  type RegionalSponsorCategory,
} from './regional-sponsor-categories';

export interface RegionalSponsor {
  readonly id: number;
  readonly name: string;
  readonly category: RegionalSponsorCategory;
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string | null;
  readonly imageId: string | null;
  readonly imageAlt: string | null;
  readonly imageDecorative: boolean;
  readonly message: string | null;
  readonly businessHours: string | null;
  readonly closedDays: string | null;
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

function isCategory(value: unknown): value is RegionalSponsorCategory {
  return REGIONAL_SPONSOR_CATEGORIES.includes(value as RegionalSponsorCategory);
}

export function toRegionalSponsor(
  sponsor: Sponsor,
  order: number,
): RegionalSponsorConversion {
  const reasons: string[] = [];
  if (!sponsor.type.includes('local')) reasons.push('typeにlocalがない');
  const name = optionalText(sponsor.name);
  if (name === null) reasons.push('nameが空');
  if (!isCategory(sponsor.local_map_category)) {
    reasons.push('local_map_categoryが不正');
  }
  if (!isCoordinate(sponsor.local_latitude, -90, 90)) {
    reasons.push('local_latitudeが不正');
  }
  if (!isCoordinate(sponsor.local_longitude, -180, 180)) {
    reasons.push('local_longitudeが不正');
  }
  if (reasons.length > 0) return { ok: false, reasons };

  const decorative = sponsor.local_image_decorative === true;
  const alt = optionalText(sponsor.local_image_alt);
  const accessibleImage =
    sponsor.local_image != null && decorative !== (alt !== null);

  return {
    ok: true,
    value: {
      id: sponsor.id,
      name: name!,
      category: sponsor.local_map_category!,
      latitude: sponsor.local_latitude!,
      longitude: sponsor.local_longitude!,
      address: optionalText(sponsor.address),
      imageId: accessibleImage ? toMediaId(sponsor.local_image) : null,
      imageAlt: accessibleImage && !decorative ? alt : null,
      imageDecorative: accessibleImage ? decorative : false,
      message: optionalText(sponsor.description),
      businessHours: optionalText(sponsor.local_business_hours),
      closedDays: optionalText(sponsor.local_closed_days),
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

export async function getRegionalSponsorMapData(
  options?: CmsFetchOptions,
): Promise<RegionalSponsorMapDataResult> {
  const result = await cms.findMany(
    'sponsors',
    { sort: ['_order', 'id'], limit: 0, depth: 0 },
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
