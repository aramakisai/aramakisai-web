'use client';

import type { RegionalSponsorCategory } from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorDetail } from './regional-sponsor-detail';
import { RegionalSponsorError } from './regional-sponsor-error';
import { RegionalSponsorList } from './regional-sponsor-list';
import { RegionalSponsorSearch } from './regional-sponsor-search';

export interface RegionalSponsorPanelProps {
  readonly query: string;
  readonly selectedCategories: ReadonlySet<RegionalSponsorCategory>;
  readonly sponsors: readonly RegionalSponsor[];
  readonly selectedSponsor: RegionalSponsor | null;
  readonly listScrollTop: number;
  /** 地点の一覧を表示するとき、その座標の企業 */
  readonly locationSponsors: readonly RegionalSponsor[] | null;
  readonly locationListScrollTop: number;
  readonly emptyMessage?: string;
  readonly error?: boolean;
  readonly onRetry?: () => void;
  readonly onQueryChange: (value: string) => void;
  readonly onCategoryToggle: (
    category: RegionalSponsorCategory | 'all',
  ) => void;
  readonly onScrollTopChange: (scrollTop: number) => void;
  readonly onLocationScrollTopChange: (scrollTop: number) => void;
  readonly onLocationBack: () => void;
  readonly onSelect: (sponsorId: number) => void;
  readonly onBack: () => void;
}

export function RegionalSponsorPanel(props: RegionalSponsorPanelProps) {
  return (
    <aside
      // Figma は内容幅 300、右余白 23 (枠線 1 + 22)
      aria-label="地域協賛の検索と一覧"
      className="fixed left-6 top-6 z-[1000] flex h-[calc(100dvh-48px-var(--map-nav,0px))] w-[348px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white py-6 pl-6 pr-[22px] shadow-card"
      data-map-side-panel
      data-testid="regional-sponsor-desktop-panel"
    >
      {props.selectedSponsor ? (
        <RegionalSponsorDetail
          sponsor={props.selectedSponsor}
          onBack={props.onBack}
        />
      ) : props.error ? (
        <RegionalSponsorError className="mt-6" onRetry={props.onRetry} />
      ) : props.locationSponsors ? (
        <RegionalSponsorList
          sponsors={props.locationSponsors}
          initialScrollTop={props.locationListScrollTop}
          onScrollTopChange={props.onLocationScrollTopChange}
          onSelect={props.onSelect}
          onLocationBack={props.onLocationBack}
        />
      ) : (
        <>
          <div className="mb-4 shrink-0">
            <RegionalSponsorSearch
              query={props.query}
              selectedCategories={props.selectedCategories}
              onQueryChange={props.onQueryChange}
              onCategoryToggle={props.onCategoryToggle}
            />
          </div>
          <RegionalSponsorList
            sponsors={props.sponsors}
            initialScrollTop={props.listScrollTop}
            onScrollTopChange={props.onScrollTopChange}
            onSelect={props.onSelect}
            emptyMessage={props.emptyMessage}
          />
        </>
      )}
    </aside>
  );
}
