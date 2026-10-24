'use client';

import { useCallback } from 'react';

import {
  MapBottomSheetShell,
  type MapBottomSheetSnap,
} from '@/components/map/map-bottom-sheet-shell';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorDetail } from './regional-sponsor-detail';
import { RegionalSponsorList } from './regional-sponsor-list';
import type { RegionalSponsorSheetSnap } from './use-regional-sponsor-map-state';

const DETAIL_SNAP: MapBottomSheetSnap = {
  id: 'detail',
  label: '詳細',
  height: 'calc(100dvh - 144px)',
  resolveHeightPx: ({ viewportHeight }) => Math.max(320, viewportHeight - 144),
  overflow: 'hidden',
};

const SNAPS: readonly MapBottomSheetSnap[] = [
  {
    id: 'collapsed',
    label: '縮小',
    height: '112px',
    resolveHeightPx: () => 112,
    overflow: 'hidden',
    contentInert: true,
  },
  {
    id: 'list',
    label: '一覧',
    height: '45dvh',
    resolveHeightPx: ({ viewportHeight }) => viewportHeight * 0.45,
    overflow: 'hidden',
  },
  {
    id: 'expanded',
    label: '展開',
    height: '75dvh',
    resolveHeightPx: ({ viewportHeight }) => viewportHeight * 0.75,
    overflow: 'hidden',
  },
  DETAIL_SNAP,
];

export interface RegionalSponsorBottomSheetProps {
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsor: RegionalSponsor | null;
  readonly snap: RegionalSponsorSheetSnap;
  readonly listScrollTop: number;
  readonly emptyMessage?: string;
  readonly error?: boolean;
  readonly onRetry?: () => void;
  readonly onSnapChange: (snap: RegionalSponsorSheetSnap) => void;
  readonly onHeightChange: (height: number) => void;
  readonly onScrollTopChange: (scrollTop: number) => void;
  readonly onSelect: (sponsor: RegionalSponsor) => void;
  readonly onBack: () => void;
}

export function RegionalSponsorBottomSheet(
  props: RegionalSponsorBottomSheetProps,
) {
  const { onHeightChange, selectedSponsor } = props;
  const reportHeight = useCallback(
    (height: number) => {
      if (!selectedSponsor) {
        onHeightChange(height);
        return;
      }

      const detailHeight = DETAIL_SNAP.resolveHeightPx({
        viewportHeight: window.innerHeight,
        contentHeight: 0,
      });
      onHeightChange(Math.max(height, detailHeight));
    },
    [onHeightChange, selectedSponsor],
  );

  return (
    <MapBottomSheetShell
      snaps={SNAPS}
      snapId={props.snap}
      restSnapId="list"
      onSnapChange={(id) => props.onSnapChange(id as RegionalSponsorSheetSnap)}
      onHeightChange={reportHeight}
      contentClassName="h-[calc(100%_-_32px)] min-h-0"
      sheetClassName="pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex h-full min-h-0 flex-col">
        {props.selectedSponsor ? (
          <RegionalSponsorDetail
            sponsor={props.selectedSponsor}
            onBack={props.onBack}
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
        ) : (
          <RegionalSponsorList
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
