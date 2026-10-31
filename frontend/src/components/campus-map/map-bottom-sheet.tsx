'use client';

import { MapBottomSheet as BaseMapBottomSheet } from '@/components/map/map-bottom-sheet';
import { AreaExhibitionList } from './area-exhibition-list';
import type { AreaExhibitionListState } from './area-exhibition-list';

export interface MapBottomSheetProps {
  readonly state: AreaExhibitionListState;
  readonly notice?: string | null;
  readonly selectedAreaId?: number | null;
  /** シートの実高さ (px) が変わるたびに呼ばれる。地図側コントロールの余白追従に使う */
  readonly onHeightChange?: (height: number) => void;
}

export function MapBottomSheet({
  state,
  notice,
  selectedAreaId = null,
  onHeightChange,
}: MapBottomSheetProps) {
  return (
    <BaseMapBottomSheet
      // 実コンテンツを持つ filtered 以外は1行の案内だけなので内容高へ縮める
      collapsed={state.kind !== 'filtered'}
      selectedKey={selectedAreaId}
      onHeightChange={onHeightChange}
    >
      <AreaExhibitionList state={state} notice={notice} />
    </BaseMapBottomSheet>
  );
}
