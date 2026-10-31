'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMapUrlState } from '@/components/map/use-map-url-state';
import type { RegionalSponsorCategory } from '@/lib/regional-sponsor-categories';
import {
  buildRegionalSponsorMapHref,
  EMPTY_REGIONAL_SPONSOR_MAP_FILTERS,
  parseRegionalSponsorMapQuery,
} from '@/lib/regional-sponsor-map-query';
import { filterRegionalSponsors } from '@/lib/regional-sponsor-search';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

export const LIST_TITLE_ID = 'regional-sponsor-list-title';
export const LOCATION_LIST_TITLE_ID = 'regional-sponsor-location-list-title';

export function useRegionalSponsorMapState(
  sponsors: readonly RegionalSponsor[],
) {
  const { filters, keywordInput, setKeywordInput, update, syncFromLocation } =
    useMapUrlState({
      empty: EMPTY_REGIONAL_SPONSOR_MAP_FILTERS,
      parse: parseRegionalSponsorMapQuery,
      build: buildRegionalSponsorMapHref,
    });
  // スクロールのたびに画面全体と全マーカーを再描画しないよう state にしない。一覧のマウント時にだけ読む
  const listScrollTop = useRef(0);
  const locationListScrollTop = useRef(0);
  // 地点の一覧で表示中のまとまりの企業 ID。詳細表示中も保持して戻り先を決める
  const [locationIds, setLocationIds] = useState<readonly number[] | null>(
    null,
  );
  // 描画後に focus する要素の id
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);

  const selectedCategories = useMemo(
    () => new Set<RegionalSponsorCategory>(filters.categories),
    [filters.categories],
  );
  const filteredSponsors = useMemo(
    () => filterRegionalSponsors(sponsors, filters.q, selectedCategories),
    [filters.q, selectedCategories, sponsors],
  );
  const locationSponsors = useMemo(() => {
    if (locationIds === null) return null;
    return filteredSponsors.filter((s) => locationIds.includes(s.id));
  }, [filteredSponsors, locationIds]);
  // 絞り込みで一覧から外れた店舗は選択中として扱わない。履歴は書き換えず、条件を戻せば選択も戻る
  const selectedSponsor =
    filters.selectedSponsorId === null
      ? null
      : (filteredSponsors.find(({ id }) => id === filters.selectedSponsorId) ??
        null);
  const selectedSponsorId = selectedSponsor?.id ?? null;

  useEffect(() => {
    if (
      selectedSponsorId === null &&
      locationIds !== null &&
      !locationSponsors?.length
    ) {
      setLocationIds(null);
    }
  }, [locationIds, locationSponsors, selectedSponsorId]);

  const setCategories = useCallback(
    (categories: readonly RegionalSponsorCategory[]) => update({ categories }),
    [update],
  );

  // カードは全体の一覧と地点の一覧のどちらからも選ぶため locationIds は変えない
  const selectFromCard = (sponsorId: number) => {
    setFocusTargetId(null);
    update({ selectedSponsorId: sponsorId });
  };
  const selectFromPin = (sponsorId: number) => {
    setFocusTargetId(null);
    setLocationIds(null);
    update({ selectedSponsorId: sponsorId });
  };
  const closeFromMap = () => {
    setFocusTargetId(null);
    setLocationIds(null);
    if (filters.selectedSponsorId !== null) update({ selectedSponsorId: null });
  };
  const openLocation = (ids: readonly number[]) => {
    setLocationIds(ids);
    if (filters.selectedSponsorId !== null) update({ selectedSponsorId: null });
    locationListScrollTop.current = 0;
    setFocusTargetId(LOCATION_LIST_TITLE_ID);
  };
  const returnFromDetail = () => {
    update({ selectedSponsorId: null });
    if (selectedSponsorId !== null)
      setFocusTargetId(`regional-sponsor-card-${selectedSponsorId}`);
  };
  const returnFromLocation = () => {
    setLocationIds(null);
    setFocusTargetId(LIST_TITLE_ID);
  };
  const clearFocusTarget = useCallback(() => setFocusTargetId(null), []);

  return {
    keywordInput,
    selectedCategories: filters.categories,
    selectedSponsorId,
    selectedSponsor,
    filteredSponsors,
    locationIds,
    locationSponsors,
    listScrollTop: listScrollTop.current,
    locationListScrollTop: locationListScrollTop.current,
    focusTargetId,
    setKeywordInput,
    setCategories,
    selectFromCard,
    selectFromPin,
    closeFromMap,
    syncFromLocation,
    openLocation,
    returnFromDetail,
    returnFromLocation,
    setListScrollTop: (value: number) => {
      listScrollTop.current = value;
    },
    setLocationListScrollTop: (value: number) => {
      locationListScrollTop.current = value;
    },
    clearFocusTarget,
  };
}
