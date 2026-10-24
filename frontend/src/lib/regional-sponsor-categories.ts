export const REGIONAL_SPONSOR_CATEGORIES = [
  'hospital',
  'life',
  'car',
  'education',
  'food',
  'shop',
] as const;

export type RegionalSponsorCategory =
  (typeof REGIONAL_SPONSOR_CATEGORIES)[number];

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

export const REGIONAL_SPONSOR_CATEGORY_STYLES: Readonly<
  Record<
    RegionalSponsorCategory,
    { readonly backgroundClass: string; readonly color: string }
  >
> = {
  hospital: { backgroundClass: 'bg-bansai-rose', color: '#e0666d' },
  life: { backgroundClass: 'bg-bansai-olive', color: '#c9bf86' },
  car: { backgroundClass: 'bg-bansai-aqua', color: '#a2c2c6' },
  education: { backgroundClass: 'bg-bansai-wisteria', color: '#d2c6da' },
  food: { backgroundClass: 'bg-bansai-ochre', color: '#e4ab53' },
  shop: { backgroundClass: 'bg-bansai-sage', color: '#aeb49c' },
};
