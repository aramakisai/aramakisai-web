'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { PhasedBottomNavigation } from '@/components/phased-chrome';
import { MapMenuButton } from '@/components/map/map-menu-button';
import { MapSearchOverlay } from '@/components/map/map-search-overlay';
import {
  MAP_VIEWPORT_CLASS,
  useMapNavClass,
  useMapSheetInset,
} from '@/components/map/use-map-sheet-inset';
import type {
  RegionalSponsor,
  RegionalSponsorMapDataResult,
} from '@/lib/regional-sponsors';
import type { NavigationByPhase } from '@/lib/navigation';
import { BUILD_PHASE, type FestivalPhase } from '@/lib/phase';
import { RegionalSponsorBottomSheet } from './regional-sponsor-bottom-sheet';
import { RegionalSponsorPanel } from './regional-sponsor-panel';
import { REGIONAL_SPONSOR_SEARCH_PROPS } from './regional-sponsor-search';
import {
  LIST_TITLE_ID,
  LOCATION_LIST_TITLE_ID,
  useRegionalSponsorMapState,
} from './use-regional-sponsor-map-state';

// Client Component の中で動的読み込みする理由と読み込み表示は構内マップと同じ
const RegionalSponsorMapView = dynamic(
  () =>
    import('./regional-sponsor-map-view').then(
      (module) => module.RegionalSponsorMapView,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="flex h-[calc(100dvh-var(--map-nav))] w-full items-center justify-center bg-gray-100 text-text"
      >
        地図を読み込んでいます…
      </div>
    ),
  },
);

const EMPTY_SPONSORS: readonly RegionalSponsor[] = [];

// パネルとシートの両方が描画され、使わない側は aria-hidden/inert になるため、生きている方を選ぶ
function findVisible(focusId: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(
    `[data-focus-id="${focusId}"]`,
  )) {
    if (!el.closest('[aria-hidden="true"], [inert]')) return el;
  }
  return null;
}

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
  const navClass = useMapNavClass();
  const sponsors = data.ok ? data.sponsors : EMPTY_SPONSORS;
  const state = useRegionalSponsorMapState(sponsors);
  const { bottomInset, onHeightChange } = useMapSheetInset();
  const { clearFocusTarget, focusTargetId, selectedSponsorId } = state;

  useEffect(() => {
    if (selectedSponsorId !== null || focusTargetId === null) return;
    const frame = requestAnimationFrame(() => {
      // 元カードが一覧から消えていれば、いま表示中の一覧の見出しへ寄せる
      const target =
        findVisible(focusTargetId) ??
        findVisible(LOCATION_LIST_TITLE_ID) ??
        findVisible(LIST_TITLE_ID);
      target?.focus();
      clearFocusTarget();
    });
    return () => cancelAnimationFrame(frame);
  }, [clearFocusTarget, focusTargetId, selectedSponsorId]);

  const emptyMessage =
    data.ok && data.sponsors.length === 0
      ? '掲載可能な地域協賛情報はありません。'
      : undefined;

  const shared = {
    sponsors: state.filteredSponsors,
    selectedSponsor: state.selectedSponsor,
    listScrollTop: state.listScrollTop,
    locationSponsors: state.locationSponsors,
    locationListScrollTop: state.locationListScrollTop,
    emptyMessage,
    error: !data.ok,
    onRetry: () => router.refresh(),
    onScrollTopChange: state.setListScrollTop,
    onLocationScrollTopChange: state.setLocationListScrollTop,
    onLocationBack: state.returnFromLocation,
    onSelect: state.selectFromCard,
    onBack: state.returnFromDetail,
  };

  return (
    <main
      aria-label="地域協賛マップ"
      className={`relative h-dvh w-full ${navClass}`}
    >
      <MapMenuButton phase={phase} navigation={navigation} />
      <MapSearchOverlay
        keywordInput={state.keywordInput}
        setKeywordInput={state.setKeywordInput}
        categories={state.selectedCategories}
        setCategories={state.setCategories}
        {...REGIONAL_SPONSOR_SEARCH_PROPS}
      />
      <RegionalSponsorPanel
        {...shared}
        keyword={state.keywordInput}
        categories={state.selectedCategories}
        onKeywordChange={state.setKeywordInput}
        onCategoriesChange={state.setCategories}
      />
      <RegionalSponsorBottomSheet {...shared} onHeightChange={onHeightChange} />
      <div
        data-testid="map-viewport"
        className={MAP_VIEWPORT_CLASS}
        style={{ '--map-bottom-inset': `${bottomInset}px` } as CSSProperties}
      >
        <RegionalSponsorMapView
          sponsors={state.filteredSponsors}
          fitSponsors={sponsors}
          selectedSponsorId={state.selectedSponsorId}
          onSelectSponsor={state.selectFromPin}
          onSelectLocation={state.openLocation}
        />
      </div>
      <PhasedBottomNavigation />
    </main>
  );
}
