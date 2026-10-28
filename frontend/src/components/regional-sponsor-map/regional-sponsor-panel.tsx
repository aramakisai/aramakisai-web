'use client';

import type { RegionalSponsorCategory } from '@/lib/regional-sponsor-categories';
import type { RegionalSponsor } from '@/lib/regional-sponsors';
import { RegionalSponsorDetail } from './regional-sponsor-detail';
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
  readonly onSelect: (sponsor: RegionalSponsor) => void;
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
        <div
          className="mt-6 rounded-lg border border-warning bg-orange-50 p-4"
          role="alert"
        >
          <p className="text-sm leading-6 text-text">
            地域協賛情報を取得できませんでした。
          </p>
          <button
            type="button"
            onClick={props.onRetry}
            className="mt-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            再試行
          </button>
        </div>
      ) : props.locationSponsors ? (
        <RegionalSponsorList
          sponsors={props.locationSponsors}
          selectedSponsorId={null}
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
            selectedSponsorId={null}
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
