import type { Sponsor } from '@/cms-types';

/** Payload の select から生成された型をカテゴリ型の正とする。 */
export type RegionalSponsorCategory = NonNullable<
  Sponsor['business_category']
>;

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
      readonly color: string;
      readonly pinAsset: string;
    }
  >
> = {
  hospital: {
    backgroundClass: 'bg-bansai-rose',
    color: '#e0666d',
    pinAsset: '/images/regional-sponsor-map/pin-hospital.svg',
  },
  life: {
    backgroundClass: 'bg-bansai-sage',
    color: '#aeb49c',
    pinAsset: '/images/regional-sponsor-map/pin-life.svg',
  },
  car: {
    backgroundClass: 'bg-bansai-aqua',
    color: '#a2c2c6',
    pinAsset: '/images/regional-sponsor-map/pin-car.svg',
  },
  education: {
    backgroundClass: 'bg-bansai-wisteria',
    color: '#d2c6da',
    pinAsset: '/images/regional-sponsor-map/pin-education.svg',
  },
  food: {
    backgroundClass: 'bg-bansai-ochre',
    color: '#e4ab53',
    pinAsset: '/images/regional-sponsor-map/pin-food.svg',
  },
  shop: {
    backgroundClass: 'bg-bansai-olive',
    color: '#c9bf86',
    pinAsset: '/images/regional-sponsor-map/pin-shop.svg',
  },
};

const FALLBACK_CATEGORY = {
  label: '未分類',
  backgroundClass: 'bg-gray-600',
  color: '#78716c',
  pinAsset: '/images/regional-sponsor-map/pin-neutral.svg',
} as const;

export function getRegionalSponsorCategoryPresentation(category: string) {
  if (category in REGIONAL_SPONSOR_CATEGORY_LABELS) {
    const known = category as RegionalSponsorCategory;
    return {
      label: REGIONAL_SPONSOR_CATEGORY_LABELS[known],
      ...REGIONAL_SPONSOR_CATEGORY_STYLES[known],
    };
  }
  return FALLBACK_CATEGORY;
}
