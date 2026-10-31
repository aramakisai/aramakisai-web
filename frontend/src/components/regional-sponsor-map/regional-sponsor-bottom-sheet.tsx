'use client';

import { MapBottomSheet } from '@/components/map/map-bottom-sheet';
import {
  RegionalSponsorContent,
  type RegionalSponsorContentProps,
} from './regional-sponsor-content';

export interface RegionalSponsorBottomSheetProps extends RegionalSponsorContentProps {
  readonly onTargetHeightChange?: (height: number) => void;
  readonly onTargetHeightIntent?: (height: number) => void;
}

export function RegionalSponsorBottomSheet({
  onTargetHeightChange,
  onTargetHeightIntent,
  ...content
}: RegionalSponsorBottomSheetProps) {
  return (
    <MapBottomSheet
      // エラーは1行の案内だけなので内容高へ縮める
      collapsed={!!content.error}
      selectedKey={content.selectedSponsor?.id ?? null}
      onTargetHeightChange={onTargetHeightChange}
      onTargetHeightIntent={onTargetHeightIntent}
    >
      <RegionalSponsorContent {...content} scope="sheet" />
    </MapBottomSheet>
  );
}
