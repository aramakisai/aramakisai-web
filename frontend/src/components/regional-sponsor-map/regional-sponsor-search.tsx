'use client';

import {
  REGIONAL_SPONSOR_CATEGORIES,
  REGIONAL_SPONSOR_CATEGORY_LABELS,
} from '@/lib/regional-sponsor-categories';

export const REGIONAL_SPONSOR_SEARCH_PROPS = {
  options: REGIONAL_SPONSOR_CATEGORIES.map((value) => ({
    value,
    label: REGIONAL_SPONSOR_CATEGORY_LABELS[value],
  })),
  placeholder: '店舗名・カテゴリ・住所で検索',
  searchLabel: '店舗名・カテゴリ・住所で検索',
  groupLabel: 'カテゴリで絞り込む',
} as const;
