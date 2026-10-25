'use client';

import { getRegionalSponsorCategoryPresentation } from '@/lib/regional-sponsor-categories';
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
  const category = getRegionalSponsorCategoryPresentation(sponsor.category);
  return (
    <button
      id={`regional-sponsor-card-${sponsor.id}`}
      type="button"
      aria-current={selected ? 'true' : undefined}
      aria-label={`${sponsor.name}、${category.label}の詳細を表示`}
      onClick={() => onSelect(sponsor)}
      className="flex h-[124px] w-full shrink-0 gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-gray-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
    >
      <SponsorImage
        sponsor={sponsor}
        variant="card"
        className="h-20 w-20 shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <span className="line-clamp-2 font-display text-sm font-bold leading-[1.4] text-text">
          {sponsor.name}
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
          />
          {category.label}
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
