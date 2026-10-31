'use client';

import { MapBottomSheet } from '@/components/map/map-bottom-sheet';
import {
  RegionalSponsorContent,
  type RegionalSponsorContentProps,
} from './regional-sponsor-content';

export interface RegionalSponsorBottomSheetProps extends RegionalSponsorContentProps {
  readonly onHeightChange?: (height: number) => void;
}

export function RegionalSponsorBottomSheet({
  onHeightChange,
  ...content
}: RegionalSponsorBottomSheetProps) {
  return (
    <MapBottomSheet
      // エラーは1行の案内だけなので内容高へ縮める
      collapsed={!!content.error}
      selectedKey={content.selectedSponsor?.id ?? null}
      onHeightChange={onHeightChange}
    >
      <RegionalSponsorContent {...content} scope="sheet" />
    </MapBottomSheet>
  );
}
