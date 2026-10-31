'use client';

import {
  LISTING_CATEGORY_LABELS,
  LISTING_CATEGORY_VALUES,
  type ListingCategory,
} from '@/lib/exhibitions';
import { MapSearchOverlay as BaseMapSearchOverlay } from '@/components/map/map-search-overlay';

export interface MapSearchOverlayProps {
  readonly keywordInput: string;
  readonly setKeywordInput: (value: string) => void;
  readonly categories: readonly ListingCategory[];
  readonly setCategories: (categories: readonly ListingCategory[]) => void;
}

const OPTIONS = LISTING_CATEGORY_VALUES.map((value) => ({
  value,
  label: LISTING_CATEGORY_LABELS[value],
}));

export function MapSearchOverlay(props: MapSearchOverlayProps) {
  return (
    <BaseMapSearchOverlay
      {...props}
      options={OPTIONS}
      placeholder="企画名・団体名で検索"
      searchLabel="企画を検索"
    />
  );
}
