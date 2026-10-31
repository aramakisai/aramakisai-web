'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PhasedBottomNavigation } from '@/components/phased-chrome';
import { MapMenuButton } from '@/components/map/map-menu-button';
import { useIsAboveMapBreakpoint } from '@/components/map/use-is-above-map-breakpoint';
import type {
  RegionalSponsor,
  RegionalSponsorMapDataResult,
} from '@/lib/regional-sponsors';
import type { NavigationByPhase } from '@/lib/navigation';
import { BUILD_PHASE, type FestivalPhase } from '@/lib/phase';
import { usePhase } from '@/lib/use-phase';
import { RegionalSponsorBottomSheet } from './regional-sponsor-bottom-sheet';
import { RegionalSponsorPanel } from './regional-sponsor-panel';
import { RegionalSponsorSearch } from './regional-sponsor-search';
import {
  LIST_TITLE_ID,
  LOCATION_LIST_TITLE_ID,
  useRegionalSponsorMapState,
} from './use-regional-sponsor-map-state';

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
  readonly navigation: NavigationByPhase;
}

export function RegionalSponsorMapScreen({
  data,
  phase = BUILD_PHASE,
  navigation,
}: RegionalSponsorMapScreenProps) {
  const router = useRouter();
  // 値は PhasedBottomSpacer の高さと揃える。会場マップの --map-nav と同じ扱い
  const navClass =
    usePhase().phase === 'live'
      ? '[--map-nav:calc(4rem+env(safe-area-inset-bottom))] lg:[--map-nav:0px]'
      : '[--map-nav:0px]';
  const isDesktop = useIsAboveMapBreakpoint();
  const sponsors = data.ok ? data.sponsors : EMPTY_SPONSORS;
  const state = useRegionalSponsorMapState(sponsors);
  const [mobileBottomInset, setMobileBottomInset] = useState(0);
  const { clearFocusTarget, focusTargetId, selectedSponsorId } = state;

  useEffect(() => {
    if (selectedSponsorId !== null || focusTargetId === null) return;
    const frame = requestAnimationFrame(() => {
      // 元カードが一覧から消えていれば、いま表示中の一覧の見出しへ寄せる
      const target =
        document.getElementById(focusTargetId) ??
        document.getElementById(LOCATION_LIST_TITLE_ID) ??
        document.getElementById(LIST_TITLE_ID);
      if (target instanceof HTMLElement) target.focus();
      clearFocusTarget();
    });
    return () => cancelAnimationFrame(frame);
  }, [clearFocusTarget, focusTargetId, selectedSponsorId]);

  // 選択と同じ commit で地図が移動先を決めるため、state を経由せず最新値を渡す
  const sheetTargetHeightRef = useRef<number | null>(null);
  const onSheetTargetHeightChange = useCallback((height: number) => {
    sheetTargetHeightRef.current = height;
  }, []);
  const getSheetTargetHeight = useCallback(
    () => sheetTargetHeightRef.current,
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
    locationSponsors: state.locationSponsors,
    locationListScrollTop: state.locationListScrollTop,
    emptyMessage,
    error: !data.ok,
    onRetry: retry,
    onScrollTopChange: state.setListScrollTop,
    onLocationScrollTopChange: state.setLocationListScrollTop,
    onLocationBack: state.returnFromLocation,
    onSelect: state.selectFromCard,
    onBack: state.returnFromDetail,
  };

  return (
    <main
      className={`fixed inset-0 min-h-0 min-w-0 overflow-hidden bg-gray-100 ${navClass}`}
      aria-label="地域協賛マップ"
    >
      <div className="absolute inset-x-0 top-0 bottom-[var(--map-nav,0px)]">
        <RegionalSponsorMapView
          sponsors={state.filteredSponsors}
          selectedSponsorId={state.selectedSponsorId}
          isDesktop={isDesktop}
          mobileBottomInset={mobileBottomInset}
          getMobileSheetTargetHeight={getSheetTargetHeight}
          controlsHidden={!isDesktop && state.mobileSheetSnap === 'expanded'}
          onSelectSponsor={state.selectFromPin}
          onSelectLocation={state.openLocation}
        />
      </div>

      <MapMenuButton phase={phase} navigation={navigation} />
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
          <div
            data-regional-search-overlay
            className="fixed left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-[1000]"
          >
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
            onHeightChange={setMobileBottomInset}
            onTargetHeightChange={onSheetTargetHeightChange}
          />
        </>
      )}
      <PhasedBottomNavigation />
    </main>
  );
}
