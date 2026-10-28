'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { locationSponsorIds } from '@/lib/regional-sponsor-clustering';
import type { RegionalSponsorCategory } from '@/lib/regional-sponsor-categories';
import {
  filterRegionalSponsors,
  toggleRegionalSponsorCategory,
} from '@/lib/regional-sponsor-search';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

export type RegionalSponsorSheetSnap =
  'collapsed' | 'list' | 'expanded' | 'detail';

export const LIST_TITLE_ID = 'regional-sponsor-list-title';
export const LOCATION_LIST_TITLE_ID = 'regional-sponsor-location-list-title';

export function useRegionalSponsorMapState(
  sponsors: readonly RegionalSponsor[],
) {
  const [query, setQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<
    ReadonlySet<RegionalSponsorCategory>
  >(new Set());
  const [selectedSponsorId, setSelectedSponsorId] = useState<number | null>(
    null,
  );
  // スクロールのたびに画面全体と全マーカーを再描画しないよう state にしない。一覧のマウント時にだけ読む
  const listScrollTop = useRef(0);
  const locationListScrollTop = useRef(0);
  const [mobileSheetSnap, setMobileSheetSnap] =
    useState<RegionalSponsorSheetSnap>('list');
  // 地点の一覧で表示中のまとまりのキー。詳細表示中も保持して戻り先を決める
  const [locationKey, setLocationKey] = useState<string | null>(null);
  // 描画後に focus する要素の id
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);

  const filteredSponsors = useMemo(
    () => filterRegionalSponsors(sponsors, query, selectedCategories),
    [query, selectedCategories, sponsors],
  );
  const locationSponsors = useMemo(() => {
    if (locationKey === null) return null;
    const ids = locationSponsorIds(locationKey);
    return filteredSponsors.filter((s) => ids.has(s.id));
  }, [filteredSponsors, locationKey]);
  const selectedSponsor =
    selectedSponsorId === null
      ? null
      : (sponsors.find(({ id }) => id === selectedSponsorId) ?? null);

  useEffect(() => {
    if (
      selectedSponsorId !== null &&
      !filteredSponsors.some(({ id }) => id === selectedSponsorId)
    ) {
      setSelectedSponsorId(null);
      setFocusTargetId(null);
      setMobileSheetSnap('list');
      if (!locationSponsors?.length) setLocationKey(null);
    } else if (
      selectedSponsorId === null &&
      locationKey !== null &&
      !locationSponsors?.length
    ) {
      setLocationKey(null);
    }
  }, [filteredSponsors, locationKey, locationSponsors, selectedSponsorId]);

  const toggleCategory = (category: RegionalSponsorCategory | 'all') =>
    setSelectedCategories((current) =>
      toggleRegionalSponsorCategory(current, category),
    );

  // カードは全体の一覧と地点の一覧のどちらからも選ぶため locationKey は変えない
  const selectFromCard = (sponsorId: number) => {
    setFocusTargetId(null);
    setSelectedSponsorId(sponsorId);
    setMobileSheetSnap('detail');
  };
  const selectFromPin = (sponsorId: number) => {
    setFocusTargetId(null);
    setLocationKey(null);
    setSelectedSponsorId(sponsorId);
    setMobileSheetSnap('detail');
  };
  const openLocation = (key: string) => {
    setLocationKey(key);
    setSelectedSponsorId(null);
    locationListScrollTop.current = 0;
    setMobileSheetSnap('list');
    setFocusTargetId(LOCATION_LIST_TITLE_ID);
  };
  const returnFromDetail = () => {
    const sponsorId = selectedSponsorId;
    setSelectedSponsorId(null);
    setMobileSheetSnap('list');
    if (sponsorId !== null)
      setFocusTargetId(`regional-sponsor-card-${sponsorId}`);
  };
  const returnFromLocation = () => {
    setLocationKey(null);
    setMobileSheetSnap('list');
    setFocusTargetId(LIST_TITLE_ID);
  };
  const clearFocusTarget = useCallback(() => setFocusTargetId(null), []);

  return {
    query,
    selectedCategories,
    selectedSponsorId,
    selectedSponsor,
    filteredSponsors,
    locationKey,
    locationSponsors,
    listScrollTop: listScrollTop.current,
    locationListScrollTop: locationListScrollTop.current,
    mobileSheetSnap,
    focusTargetId,
    setQuery,
    toggleCategory,
    selectFromCard,
    selectFromPin,
    openLocation,
    returnFromDetail,
    returnFromLocation,
    setListScrollTop: (value: number) => {
      listScrollTop.current = value;
    },
    setLocationListScrollTop: (value: number) => {
      locationListScrollTop.current = value;
    },
    setMobileSheetSnap,
    clearFocusTarget,
  };
}
