'use client';

import {
  LISTING_CATEGORY_LABELS,
  LISTING_CATEGORY_VALUES,
  type ListingCategory,
} from '@/lib/exhibitions';
import { MapSearchPanel as BaseMapSearchPanel } from '@/components/map/map-search-panel';

export interface MapSearchProps {
  /** 検索欄に束縛する即時値 (useMapFilters().keywordInput) */
  readonly keyword: string;
  readonly categories: readonly ListingCategory[];
  /** デバウンスや正規化は useMapFilters 側の責務のため、値をそのまま渡す */
  readonly onKeywordChange: (value: string) => void;
  readonly onCategoriesChange: (categories: readonly ListingCategory[]) => void;
}

const OPTIONS = LISTING_CATEGORY_VALUES.map((value) => ({
  value,
  label: LISTING_CATEGORY_LABELS[value],
}));

export function MapSearchPanel(props: MapSearchProps) {
  return (
    <BaseMapSearchPanel
      {...props}
      options={OPTIONS}
      placeholder="企画名・団体名で検索"
      searchLabel="企画を検索"
    />
  );
}
