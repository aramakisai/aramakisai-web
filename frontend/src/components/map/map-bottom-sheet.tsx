'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  MapBottomSheetShell,
  type MapBottomSheetSnap,
} from '@/components/map/map-bottom-sheet-shell';

export interface MapBottomSheetProps {
  readonly children: ReactNode;
  /** 内容が1行の案内だけのとき true。fit(内容高)を停止位置に加え、初期位置にする */
  readonly collapsed: boolean;
  /** 選択中の対象。値が変わって null でなければ minimum/fit から standard へ引き上げる */
  readonly selectedKey?: number | string | null;
  /** 段の切替ごとに、行き先の高さ (px) を1回呼ぶ。地図側コントロールの余白追従に使う */
  readonly onTargetHeightChange?: (height: number) => void;
}

type SheetSnapId = 'minimum' | 'fit' | 'standard' | 'large' | 'full';

const MIN_SNAP_PX = 44;
const MID_SNAP_PX = 380;
const MAX_SNAP_VH = 55;

const SHEET_SNAPS: Readonly<Record<SheetSnapId, MapBottomSheetSnap>> = {
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
    height: 'calc(100dvh - env(safe-area-inset-top) - var(--map-nav, 0px))',
    resolveHeightPx: ({ viewportHeight, bottomInset }) =>
      viewportHeight - bottomInset,
    overflow: 'auto',
    fullScreen: true,
  },
};

export function MapBottomSheet({
  children,
  collapsed,
  selectedKey = null,
  onTargetHeightChange,
}: MapBottomSheetProps) {
  const restSnapId: SheetSnapId = collapsed ? 'fit' : 'standard';
  const snaps = useMemo(
    () =>
      collapsed
        ? [
            SHEET_SNAPS.minimum,
            SHEET_SNAPS.fit,
            SHEET_SNAPS.standard,
            SHEET_SNAPS.large,
            SHEET_SNAPS.full,
          ]
        : [
            SHEET_SNAPS.minimum,
            SHEET_SNAPS.standard,
            SHEET_SNAPS.large,
            SHEET_SNAPS.full,
          ],
    [collapsed],
  );
  const [snapId, setSnapId] = useState<SheetSnapId>(restSnapId);

  // 描画後の effect で段を替えると、替わる前の段で1フレーム描かれる
  // (fit は内容高なので、一覧が出た直後は一覧全体の高さになる)。描画中に state を直す
  const [prevCollapsed, setPrevCollapsed] = useState(collapsed);
  if (prevCollapsed !== collapsed) {
    setPrevCollapsed(collapsed);
    setSnapId(restSnapId);
  }

  // 最小まで縮めたまま別の対象を選ぶと結果が見えないため標準まで引き上げる。
  // 標準以上なら利用者が選んだ高さを尊重し、選択解除でも動かさない。
  const [prevSelectedKey, setPrevSelectedKey] = useState(selectedKey);
  if (prevSelectedKey !== selectedKey) {
    setPrevSelectedKey(selectedKey);
    if (selectedKey !== null) {
      setSnapId((current) =>
        current === 'minimum' || current === 'fit' ? 'standard' : current,
      );
    }
  }

  return (
    <MapBottomSheetShell
      snaps={snaps}
      snapId={snapId}
      restSnapId={restSnapId}
      onSnapChange={(next) => setSnapId(next as SheetSnapId)}
      onTargetHeightChange={onTargetHeightChange}
      outerClassName="[clip-path:inset(-100px_-100px_0_-100px)]"
      sheetShadowClassName="shadow-card"
    >
      {children}
    </MapBottomSheetShell>
  );
}
