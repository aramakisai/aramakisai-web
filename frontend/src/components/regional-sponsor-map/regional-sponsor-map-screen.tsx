'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { MapMenuButton } from '@/components/campus-map/map-menu-button';
import { useIsAboveMapBreakpoint } from '@/components/campus-map/use-is-above-map-breakpoint';
import {
  REGIONAL_MAP_CONFIG,
  type RegionalMapConfig,
} from '@/lib/regional-map-config';
import type {
  RegionalSponsor,
  RegionalSponsorMapDataResult,
} from '@/lib/regional-sponsors';
import { BUILD_PHASE, type FestivalPhase } from '@/lib/phase';
import { RegionalSponsorBottomSheet } from './regional-sponsor-bottom-sheet';
import { RegionalSponsorPanel } from './regional-sponsor-panel';
import { RegionalSponsorSearch } from './regional-sponsor-search';
import { useRegionalSponsorMapState } from './use-regional-sponsor-map-state';

const RegionalSponsorMapView = dynamic(
  () =>
    import('./regional-sponsor-map-view').then(
      (module) => module.RegionalSponsorMapView,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-600"
        role="status"
      >
        地図を読み込んでいます…
      </div>
    ),
  },
);

const EMPTY_SPONSORS: readonly RegionalSponsor[] = [];

export interface RegionalSponsorMapScreenProps {
  readonly data: RegionalSponsorMapDataResult;
  readonly phase?: FestivalPhase;
  readonly mapProfile?: RegionalMapConfig | null;
}

export function RegionalSponsorMapScreen({
  data,
  phase = BUILD_PHASE,
  mapProfile = REGIONAL_MAP_CONFIG,
}: RegionalSponsorMapScreenProps) {
  const router = useRouter();
  const isDesktop = useIsAboveMapBreakpoint();
  const sponsors = data.ok ? data.sponsors : EMPTY_SPONSORS;
  const state = useRegionalSponsorMapState(sponsors);
  const [mobileBottomInset, setMobileBottomInset] = useState(0);
  const { clearReturnSponsorId, returnSponsorId, selectedSponsorId } = state;

  useEffect(() => {
    if (selectedSponsorId !== null || returnSponsorId === null) return;
    const sponsorId = returnSponsorId;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(
        `regional-sponsor-card-${sponsorId}`,
      );
      if (target instanceof HTMLElement) target.focus();
      else document.getElementById('regional-sponsor-list-title')?.focus();
      clearReturnSponsorId();
    });
    return () => cancelAnimationFrame(frame);
  }, [clearReturnSponsorId, returnSponsorId, selectedSponsorId]);

  const selectFromCard = (sponsor: RegionalSponsor) =>
    state.selectSponsor(sponsor.id);
  const selectFromPin = (sponsorId: number) => state.selectSponsor(sponsorId);
  const onSheetHeightChange = useCallback(
    (height: number) => setMobileBottomInset(height),
    [],
  );
  const emptyMessage =
    data.ok && data.sponsors.length === 0
      ? '掲載可能な地域協賛情報はありません。'
      : undefined;
  const retry = () => router.refresh();

  const shared = {
    sponsors: state.filteredSponsors,
    selectedSponsor: state.selectedSponsor,
    listScrollTop: state.listScrollTop,
    emptyMessage,
    error: !data.ok,
    onRetry: retry,
    onScrollTopChange: state.setListScrollTop,
    onSelect: selectFromCard,
    onBack: state.returnToList,
  };

  return (
    <main
      className="fixed inset-0 min-h-0 min-w-0 overflow-hidden bg-gray-100"
      aria-label="地域協賛マップ"
    >
      <div className="absolute inset-0">
        <RegionalSponsorMapView
          profile={mapProfile}
          sponsors={state.filteredSponsors}
          selectedSponsorId={state.selectedSponsorId}
          spiderfiedClusterId={state.spiderfiedClusterId}
          isDesktop={isDesktop}
          mobileBottomInset={mobileBottomInset}
          onSelectSponsor={selectFromPin}
          onSpiderfyChange={state.setSpiderfiedClusterId}
        />
      </div>

      <MapMenuButton phase={phase} />
      {isDesktop ? (
        <RegionalSponsorPanel
          {...shared}
          query={state.query}
          selectedCategories={state.selectedCategories}
          onQueryChange={state.setQuery}
          onCategoryToggle={state.toggleCategory}
        />
      ) : (
        <>
          <div className="fixed left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-[1000]">
            <RegionalSponsorSearch
              mobile
              query={state.query}
              selectedCategories={state.selectedCategories}
              onQueryChange={state.setQuery}
              onCategoryToggle={state.toggleCategory}
            />
          </div>
          <RegionalSponsorBottomSheet
            {...shared}
            snap={state.mobileSheetSnap}
            onSnapChange={state.setMobileSheetSnap}
            onHeightChange={onSheetHeightChange}
          />
        </>
      )}
    </main>
  );
}
