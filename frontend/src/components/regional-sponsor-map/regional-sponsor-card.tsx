'use client';

import {
  REGIONAL_SPONSOR_CATEGORY_LABELS,
  REGIONAL_SPONSOR_CATEGORY_STYLES,
} from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { SponsorImage } from './sponsor-image';

export interface RegionalSponsorCardProps {
  readonly sponsor: RegionalSponsor;
  readonly selected?: boolean;
  readonly onSelect: (sponsor: RegionalSponsor) => void;
}

export function RegionalSponsorCard({
  sponsor,
  selected = false,
  onSelect,
}: RegionalSponsorCardProps) {
  const category = REGIONAL_SPONSOR_CATEGORY_LABELS[sponsor.category];
  const style = REGIONAL_SPONSOR_CATEGORY_STYLES[sponsor.category];
  return (
    <button
      id={`regional-sponsor-card-${sponsor.id}`}
      type="button"
      aria-current={selected ? 'true' : undefined}
      aria-label={`${sponsor.name}、${category}の詳細を表示`}
      onClick={() => onSelect(sponsor)}
      className="flex h-[124px] w-full shrink-0 gap-4 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <SponsorImage
        sponsor={sponsor}
        variant="card"
        className="h-20 w-20 shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="line-clamp-2 font-display text-base font-bold leading-5 text-text">
          {sponsor.name}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold text-text ${style.backgroundClass}`}
        >
          {category}
        </span>
        {sponsor.address && (
          <span className="line-clamp-2 text-xs leading-4 text-gray-600">
            {sponsor.address}
          </span>
        )}
      </span>
    </button>
  );
}
