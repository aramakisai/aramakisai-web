'use client';

import { useLayoutEffect, useMemo, useState } from 'react';
import {
  MapBottomSheetShell,
  type MapBottomSheetSnap,
} from '@/components/map/map-bottom-sheet-shell';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorDetail } from './regional-sponsor-detail';
import { RegionalSponsorList } from './regional-sponsor-list';
import type { RegionalSponsorSheetSnap } from './use-regional-sponsor-map-state';

// 下部ナビの高さ。シートは下部ナビの上に置くため、各 snap は残りの領域を基準にする
const NAV = 'var(--map-nav, 0px)';

const DETAIL_SNAP: MapBottomSheetSnap = {
  id: 'detail',
  label: '詳細',
  height: `max(112px, min(calc((100dvh - ${NAV}) * 0.65), calc(100dvh - ${NAV} - 288px)))`,
  resolveHeightPx: ({ viewportHeight, bottomInset }) => {
    const available = viewportHeight - bottomInset;
    return Math.max(112, Math.min(available * 0.65, available - 288));
  },
  overflow: 'hidden',
};

const COLLAPSED_SNAP: MapBottomSheetSnap = {
  id: 'collapsed',
  label: '縮小',
  height: '112px',
  resolveHeightPx: () => 112,
  overflow: 'hidden',
  contentInert: true,
};

const LIST_SNAP: MapBottomSheetSnap = {
  id: 'list',
  label: '一覧',
  height: `calc((100dvh - ${NAV}) * 0.45)`,
  resolveHeightPx: ({ viewportHeight, bottomInset }) =>
    (viewportHeight - bottomInset) * 0.45,
  overflow: 'hidden',
};

// 展開時の上端を検索・カテゴリ overlay の下端からこの距離に置く
const EXPANDED_GAP = 8;

function expandedSnap(overlayBottom: number | null): MapBottomSheetSnap {
  // overlay の高さは safe area で変わるため実測値で決める。計測前は仮の上端を置く
  const top = overlayBottom === null ? 288 : overlayBottom + EXPANDED_GAP;
  return {
    id: 'expanded',
    label: '展開',
    height: `max(112px, calc(100dvh - ${NAV} - ${top}px))`,
    resolveHeightPx: ({ viewportHeight, bottomInset }) =>
      Math.max(112, viewportHeight - bottomInset - top),
    overflow: 'hidden',
  };
}

function useSearchOverlayBottom(): number | null {
  const [bottom, setBottom] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = document.querySelector('[data-regional-search-overlay]');
    if (!el) return;
    const update = () => setBottom(el.getBoundingClientRect().bottom);
    update();
    window.addEventListener('resize', update);
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, []);
  return bottom;
}

export interface RegionalSponsorBottomSheetProps {
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsor: RegionalSponsor | null;
  readonly snap: RegionalSponsorSheetSnap;
  readonly listScrollTop: number;
  readonly locationSponsors: readonly RegionalSponsor[] | null;
  readonly locationListScrollTop: number;
  readonly emptyMessage?: string;
  readonly error?: boolean;
  readonly onRetry?: () => void;
  readonly onSnapChange: (snap: RegionalSponsorSheetSnap) => void;
  readonly onHeightChange: (height: number) => void;
  readonly onTargetHeightChange?: (height: number) => void;
  readonly onScrollTopChange: (scrollTop: number) => void;
  readonly onLocationScrollTopChange: (scrollTop: number) => void;
  readonly onLocationBack: () => void;
  readonly onSelect: (sponsor: RegionalSponsor) => void;
  readonly onBack: () => void;
}

export function RegionalSponsorBottomSheet(
  props: RegionalSponsorBottomSheetProps,
) {
  const overlayBottom = useSearchOverlayBottom();
  const snaps = useMemo(() => {
    const expanded = expandedSnap(overlayBottom);
    return props.selectedSponsor
      ? [
          { ...COLLAPSED_SNAP, contentInert: false },
          LIST_SNAP,
          DETAIL_SNAP,
          expanded,
        ]
      : [COLLAPSED_SNAP, LIST_SNAP, expanded];
  }, [overlayBottom, props.selectedSponsor]);

  return (
    <MapBottomSheetShell
      snaps={snaps}
      snapId={props.snap}
      restSnapId="list"
      onSnapChange={(id) => props.onSnapChange(id as RegionalSponsorSheetSnap)}
      onHeightChange={props.onHeightChange}
      onTargetHeightChange={props.onTargetHeightChange}
      bottomClassName="bottom-[var(--map-nav,0px)]"
      contentClassName="h-[calc(100%_-_32px)] min-h-0"
      // Figma はつまみの帯(高さ12)をシート上端から8px下に置き、つまみ線は上端から12px
      sheetPaddingClassName="px-4 pt-0 pb-[max(1rem,env(safe-area-inset-bottom))]"
      grabberClassName="mb-3 mt-2 py-1"
    >
      <div className="flex h-full min-h-0 flex-col">
        {props.selectedSponsor ? (
          <RegionalSponsorDetail
            sponsor={props.selectedSponsor}
            onBack={props.onBack}
            variant="sheet"
            bodyInert={props.snap === 'collapsed'}
          />
        ) : props.error ? (
          <div
            className="rounded-lg border border-warning bg-orange-50 p-4"
            role="alert"
          >
            <p className="text-sm leading-6 text-text">
              地域協賛情報を取得できませんでした。
            </p>
            <button
              type="button"
              onClick={props.onRetry}
              className="mt-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              再試行
            </button>
          </div>
        ) : props.locationSponsors ? (
          <RegionalSponsorList
            key="location"
            variant="sheet"
            sponsors={props.locationSponsors}
            selectedSponsorId={null}
            initialScrollTop={props.locationListScrollTop}
            onScrollTopChange={props.onLocationScrollTopChange}
            onSelect={props.onSelect}
            onLocationBack={props.onLocationBack}
          />
        ) : (
          <RegionalSponsorList
            key="all"
            variant="sheet"
            sponsors={props.sponsors}
            selectedSponsorId={null}
            initialScrollTop={props.listScrollTop}
            onScrollTopChange={props.onScrollTopChange}
            onSelect={props.onSelect}
            emptyMessage={props.emptyMessage}
          />
        )}
      </div>
    </MapBottomSheetShell>
  );
}
