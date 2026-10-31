'use client';

import { MapBottomSheet as BaseMapBottomSheet } from '@/components/map/map-bottom-sheet';
import { AreaExhibitionList } from './area-exhibition-list';
import type { AreaExhibitionListState } from './area-exhibition-list';

export interface MapBottomSheetProps {
  readonly state: AreaExhibitionListState;
  readonly notice?: string | null;
  readonly selectedAreaId?: number | null;
  /** 段の切替ごとに、行き先の高さ (px) を1回呼ぶ。地図側コントロールの余白追従に使う */
  readonly onTargetHeightChange?: (height: number) => void;
  readonly onTargetHeightIntent?: (height: number) => void;
}

export function MapBottomSheet({
  state,
  notice,
  selectedAreaId = null,
  onTargetHeightChange,
  onTargetHeightIntent,
}: MapBottomSheetProps) {
  return (
    <BaseMapBottomSheet
      // 実コンテンツを持つ filtered 以外は1行の案内だけなので内容高へ縮める
      collapsed={state.kind !== 'filtered'}
      selectedKey={selectedAreaId}
      onTargetHeightChange={onTargetHeightChange}
      onTargetHeightIntent={onTargetHeightIntent}
    >
      <AreaExhibitionList state={state} notice={notice} />
    </BaseMapBottomSheet>
  );
}
