import type { Sponsor } from '@/cms-types';

/** Payload の select から生成された型をカテゴリ型の正とする。 */
export type RegionalSponsorCategory = NonNullable<Sponsor['business_category']>;

export const REGIONAL_SPONSOR_CATEGORY_LABELS: Readonly<
  Record<RegionalSponsorCategory, string>
> = {
  hospital: '病院',
  life: '生活',
  car: '車',
  education: '教育',
  food: '飲食',
  shop: 'ショップ',
};

export const REGIONAL_SPONSOR_CATEGORIES = Object.keys(
  REGIONAL_SPONSOR_CATEGORY_LABELS,
) as readonly RegionalSponsorCategory[];

export const REGIONAL_SPONSOR_CATEGORY_STYLES: Readonly<
  Record<
    RegionalSponsorCategory,
    {
      readonly backgroundClass: string;
      readonly pinAsset: string;
    }
  >
> = {
  hospital: {
    backgroundClass: 'bg-bansai-rose',
    pinAsset: '/images/regional-sponsor-map/pin-hospital.svg',
  },
  life: {
    backgroundClass: 'bg-bansai-sage',
    pinAsset: '/images/regional-sponsor-map/pin-life.svg',
  },
  car: {
    backgroundClass: 'bg-bansai-aqua',
    pinAsset: '/images/regional-sponsor-map/pin-car.svg',
  },
  education: {
    backgroundClass: 'bg-bansai-wisteria',
    pinAsset: '/images/regional-sponsor-map/pin-education.svg',
  },
  food: {
    backgroundClass: 'bg-bansai-ochre',
    pinAsset: '/images/regional-sponsor-map/pin-food.svg',
  },
  shop: {
    backgroundClass: 'bg-bansai-olive',
    pinAsset: '/images/regional-sponsor-map/pin-shop.svg',
  },
};

export function getRegionalSponsorCategoryPresentation(
  category: RegionalSponsorCategory,
) {
  return {
    label: REGIONAL_SPONSOR_CATEGORY_LABELS[category],
    ...REGIONAL_SPONSOR_CATEGORY_STYLES[category],
  };
}
