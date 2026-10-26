'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RegionalSponsorCategory } from '@/lib/regional-sponsor-categories';
import {
  filterRegionalSponsors,
  toggleRegionalSponsorCategory,
} from '@/lib/regional-sponsor-search';
import type { RegionalSponsor } from '@/lib/regional-sponsors';

export type RegionalSponsorSheetSnap =
  'collapsed' | 'list' | 'expanded' | 'detail';

export function useRegionalSponsorMapState(
  sponsors: readonly RegionalSponsor[],
) {
  const [query, setQueryState] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<
    ReadonlySet<RegionalSponsorCategory>
  >(new Set());
  const [selectedSponsorId, setSelectedSponsorId] = useState<number | null>(
    null,
  );
  const [listScrollTop, setListScrollTop] = useState(0);
  const [mobileSheetSnap, setMobileSheetSnap] =
    useState<RegionalSponsorSheetSnap>('list');
  const [spiderfiedClusterId, setSpiderfiedClusterId] = useState<string | null>(
    null,
  );
  const [returnSponsorId, setReturnSponsorId] = useState<number | null>(null);

  const filteredSponsors = useMemo(
    () => filterRegionalSponsors(sponsors, query, selectedCategories),
    [query, selectedCategories, sponsors],
  );
  const selectedSponsor =
    selectedSponsorId === null
      ? null
      : (sponsors.find(({ id }) => id === selectedSponsorId) ?? null);

  useEffect(() => {
    if (
      selectedSponsorId !== null &&
      !filteredSponsors.some(({ id }) => id === selectedSponsorId)
    ) {
      setReturnSponsorId(null);
      setSelectedSponsorId(null);
      setMobileSheetSnap('list');
    }
  }, [filteredSponsors, selectedSponsorId]);

  const setQuery = (value: string) => {
    setQueryState(value);
    setSpiderfiedClusterId(null);
  };
  const toggleCategory = (category: RegionalSponsorCategory | 'all') => {
    setSelectedCategories((current) =>
      toggleRegionalSponsorCategory(current, category),
    );
    setSpiderfiedClusterId(null);
  };
  const selectSponsor = (sponsorId: number) => {
    setReturnSponsorId(null);
    setSelectedSponsorId(sponsorId);
    setMobileSheetSnap('detail');
  };
  const returnToList = () => {
    const sponsorId = selectedSponsorId;
    setSelectedSponsorId(null);
    setMobileSheetSnap('list');
    setReturnSponsorId(sponsorId);
  };
  const clearReturnSponsorId = useCallback(() => setReturnSponsorId(null), []);

  return {
    query,
    selectedCategories,
    selectedSponsorId,
    selectedSponsor,
    filteredSponsors,
    listScrollTop,
    mobileSheetSnap,
    spiderfiedClusterId,
    returnSponsorId,
    setQuery,
    toggleCategory,
    selectSponsor,
    returnToList,
    setListScrollTop,
    setMobileSheetSnap,
    setSpiderfiedClusterId,
    clearReturnSponsorId,
  };
}
