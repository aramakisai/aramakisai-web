'use client';

import { useCallback } from 'react';
import { useMapUrlState } from '@/components/map/use-map-url-state';
import {
  buildCampusMapHref,
  parseCampusMapQuery,
  type CampusMapFilters,
} from '@/lib/campus-map';
import type { ListingCategory } from '@/lib/exhibitions';

export interface UseMapFiltersResult {
  /** URL・絞り込みへ反映済みの確定状態。キーワードはデバウンス確定後の値 */
  readonly filters: CampusMapFilters;
  /** 検索欄に束縛する即時値。デバウンス中は filters.q と異なる */
  readonly keywordInput: string;
  readonly setKeywordInput: (value: string) => void;
  readonly setCategories: (categories: readonly ListingCategory[]) => void;
  readonly selectArea: (areaId: number | null) => void;
  readonly syncFromLocation: () => void;
}

const EMPTY_FILTERS: CampusMapFilters = {
  q: '',
  categories: [],
  selectedAreaId: null,
};

function parse(params: URLSearchParams): CampusMapFilters {
  return parseCampusMapQuery({
    q: params.get('q') ?? undefined,
    category: params.get('category') ?? undefined,
    area: params.get('area') ?? undefined,
  });
}

export function useMapFilters(): UseMapFiltersResult {
  const { filters, keywordInput, setKeywordInput, update, syncFromLocation } =
    useMapUrlState({
      empty: EMPTY_FILTERS,
      parse,
      build: buildCampusMapHref,
    });
  const setCategories = useCallback(
    (categories: readonly ListingCategory[]) => update({ categories }),
    [update],
  );
  const selectArea = useCallback(
    (selectedAreaId: number | null) => update({ selectedAreaId }),
    [update],
  );
  return {
    filters,
    keywordInput,
    setKeywordInput,
    setCategories,
    selectArea,
    syncFromLocation,
  };
}
