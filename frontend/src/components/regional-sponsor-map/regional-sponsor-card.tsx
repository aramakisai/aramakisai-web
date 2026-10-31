'use client';

import { exhibitionTextureStyle } from '@/lib/exhibition-color';
import { getRegionalSponsorCategoryPresentation } from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { SponsorImage } from './sponsor-image';

export interface RegionalSponsorCardProps {
  readonly scope: 'panel' | 'sheet';
  readonly sponsor: RegionalSponsor;
  readonly onSelect: (sponsorId: number) => void;
}

export function RegionalSponsorCard({
  scope,
  sponsor,
  onSelect,
}: RegionalSponsorCardProps) {
  const category = getRegionalSponsorCategoryPresentation(sponsor.category);
  return (
    <button
      id={`regional-sponsor-card-${sponsor.id}-${scope}`}
      data-focus-id={`regional-sponsor-card-${sponsor.id}`}
      type="button"
      aria-label={`${sponsor.name}、${category.label}の詳細を表示`}
      onClick={() => onSelect(sponsor.id)}
      className="relative flex w-full flex-col overflow-clip rounded-xl text-left hover-card-shadow focus-visible:outline-offset-[-2px]"
    >
      <span className="relative flex aspect-[300/225] w-full shrink-0 items-center justify-center overflow-clip bg-gray-200">
        <SponsorImage
          sponsor={sponsor}
          variant="card"
          className="absolute inset-0 h-full w-full"
        />
      </span>
      <span className="relative flex flex-col overflow-clip p-4">
        <span
          aria-hidden
          style={exhibitionTextureStyle(sponsor.name)}
          className="absolute top-1/2 left-1/2 aspect-square w-[120%]"
        />
        <span className="relative flex flex-col gap-1">
          <span className="flex min-h-[1lh] items-center gap-1 text-xs leading-[1.4] font-medium text-text">
            <span
              aria-hidden="true"
              className={`size-2 shrink-0 rounded-full ${category.backgroundClass}`}
            />
            {category.label}
          </span>
          {/* ExhibitionCard の h4 と同じ見出し書体。button 内に見出し要素は置けないため span で当てる */}
          <span className="line-clamp-2 h-[2lh] font-display text-[20px] leading-[140%] font-black tracking-[0.02em] text-balance text-text [word-break:auto-phrase]">
            {sponsor.name}
          </span>
          {sponsor.address && (
            <span className="line-clamp-2 text-xs leading-[1.4] text-gray-600">
              {sponsor.address}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
