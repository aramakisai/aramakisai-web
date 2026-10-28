'use client';

import { MaterialIcon } from '@/components/icons';
import { HoverLineText } from '@/components/hover-line';

export function RegionalSponsorBackButton({
  onBack,
}: {
  readonly onBack: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="group/row flex h-10 shrink-0 items-center gap-2 rounded-md py-2 text-sm font-medium leading-5 text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <MaterialIcon name="chevron_left" size={20} />
      <HoverLineText gap={6}>店舗一覧に戻る</HoverLineText>
    </button>
  );
}
