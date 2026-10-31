'use client';

import { MapBottomSheet } from '@/components/map/map-bottom-sheet';
import {
  RegionalSponsorContent,
  type RegionalSponsorContentProps,
} from './regional-sponsor-content';

export interface RegionalSponsorBottomSheetProps extends RegionalSponsorContentProps {
  readonly onTargetHeightChange?: (height: number) => void;
}

export function RegionalSponsorBottomSheet({
  onTargetHeightChange,
  ...content
}: RegionalSponsorBottomSheetProps) {
  return (
    <MapBottomSheet
      // エラーは1行の案内だけなので内容高へ縮める
      collapsed={!!content.error}
      selectedKey={content.selectedSponsor?.id ?? null}
      onTargetHeightChange={onTargetHeightChange}
    >
      <RegionalSponsorContent {...content} scope="sheet" />
    </MapBottomSheet>
  );
}
