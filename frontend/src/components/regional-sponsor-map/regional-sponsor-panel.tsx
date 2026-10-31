'use client';

import { MapSidePanelFrame } from '@/components/map/map-side-panel-frame';
import { MapSearchPanel } from '@/components/map/map-search-panel';
import type { RegionalSponsorCategory } from '@/lib/regional-sponsor-categories';
import {
  RegionalSponsorContent,
  showsSearch,
  type RegionalSponsorContentProps,
} from './regional-sponsor-content';
import { REGIONAL_SPONSOR_SEARCH_PROPS } from './regional-sponsor-search';

export interface RegionalSponsorPanelProps extends RegionalSponsorContentProps {
  readonly keyword: string;
  readonly categories: readonly RegionalSponsorCategory[];
  readonly onKeywordChange: (value: string) => void;
  readonly onCategoriesChange: (
    categories: readonly RegionalSponsorCategory[],
  ) => void;
}

export function RegionalSponsorPanel(props: RegionalSponsorPanelProps) {
  return (
    <MapSidePanelFrame
      role="complementary"
      aria-label="地域協賛の検索と一覧"
      data-testid="regional-sponsor-desktop-panel"
      header={
        showsSearch(props) ? (
          <MapSearchPanel
            keyword={props.keyword}
            categories={props.categories}
            onKeywordChange={props.onKeywordChange}
            onCategoriesChange={props.onCategoriesChange}
            {...REGIONAL_SPONSOR_SEARCH_PROPS}
          />
        ) : undefined
      }
    >
      <RegionalSponsorContent {...props} scope="panel" />
    </MapSidePanelFrame>
  );
}
