'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapBottomSheetShell,
  type MapBottomSheetSnap,
} from '@/components/map/map-bottom-sheet-shell';
import { AreaExhibitionList } from './area-exhibition-list';
import type { AreaExhibitionListState } from './area-exhibition-list';

export interface MapBottomSheetProps {
  readonly state: AreaExhibitionListState;
  readonly notice?: string | null;
  readonly selectedAreaId?: number | null;
  /** シートの実高さ (px) が変わるたびに呼ばれる。地図側コントロールの余白追従に使う */
  readonly onHeightChange?: (height: number) => void;
}

type CampusSnapId = 'minimum' | 'fit' | 'standard' | 'large' | 'full';

// 会場マップの既存値。共通shellへ明示して表示と操作を変えない。
const MIN_SNAP_PX = 44;
const MID_SNAP_PX = 380;
const MAX_SNAP_VH = 55;

const CAMPUS_SNAPS: Readonly<Record<CampusSnapId, MapBottomSheetSnap>> = {
  minimum: {
    id: 'minimum',
    label: '最小',
    height: `${MIN_SNAP_PX}px`,
    resolveHeightPx: () => MIN_SNAP_PX,
    overflow: 'hidden',
    contentInert: true,
  },
  fit: {
    id: 'fit',
    label: '折りたたみ',
    height: 'auto',
    resolveHeightPx: ({ contentHeight }) => contentHeight,
    overflow: 'hidden',
  },
  standard: {
    id: 'standard',
    label: '標準',
    height: `${MID_SNAP_PX}px`,
    resolveHeightPx: () => MID_SNAP_PX,
    overflow: 'auto',
  },
  large: {
    id: 'large',
    label: '大',
    height: `${MAX_SNAP_VH}vh`,
    resolveHeightPx: ({ viewportHeight }) =>
      (viewportHeight * MAX_SNAP_VH) / 100,
    overflow: 'auto',
  },
  full: {
    id: 'full',
    label: '全画面',
    height: 'calc(100dvh - env(safe-area-inset-top))',
    resolveHeightPx: ({ viewportHeight }) => viewportHeight,
    overflow: 'auto',
    fullScreen: true,
  },
};

export function MapBottomSheet({
  state,
  notice,
  selectedAreaId = null,
  onHeightChange,
}: MapBottomSheetProps) {
  // 実コンテンツを持つ filtered 以外は1行の案内だけなので内容高へ縮める。
  const collapsed = state.kind !== 'filtered';
  const restSnapId: CampusSnapId = collapsed ? 'fit' : 'standard';
  const snaps = useMemo(
    () =>
      collapsed
        ? [
            CAMPUS_SNAPS.minimum,
            CAMPUS_SNAPS.fit,
            CAMPUS_SNAPS.standard,
            CAMPUS_SNAPS.large,
            CAMPUS_SNAPS.full,
          ]
        : [
            CAMPUS_SNAPS.minimum,
            CAMPUS_SNAPS.standard,
            CAMPUS_SNAPS.large,
            CAMPUS_SNAPS.full,
          ],
    [collapsed],
  );
  const [snapId, setSnapId] = useState<CampusSnapId>(restSnapId);

  const prevCollapsedRef = useRef(collapsed);
  useEffect(() => {
    if (prevCollapsedRef.current !== collapsed) {
      prevCollapsedRef.current = collapsed;
      setSnapId(collapsed ? 'fit' : 'standard');
    }
  }, [collapsed]);

  // 最小まで縮めたまま別エリアを選ぶと結果が見えないため標準まで引き上げる。
  // 標準以上なら利用者が選んだ高さを尊重し、選択解除でも動かさない。
  useEffect(() => {
    if (selectedAreaId !== null) {
      setSnapId((current) =>
        current === 'minimum' || current === 'fit' ? 'standard' : current,
      );
    }
  }, [selectedAreaId]);

  return (
    <MapBottomSheetShell
      snaps={snaps}
      snapId={snapId}
      restSnapId={restSnapId}
      onSnapChange={(next) => setSnapId(next as CampusSnapId)}
      onHeightChange={onHeightChange}
    >
      <AreaExhibitionList state={state} notice={notice} />
    </MapBottomSheetShell>
  );
}
