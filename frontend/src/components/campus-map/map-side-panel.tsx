'use client';

import { MapSidePanelFrame } from '@/components/map/map-side-panel-frame';
import {
  AreaExhibitionList,
  type AreaExhibitionListState,
} from './area-exhibition-list';
import { MapSearchPanel, type MapSearchProps } from './map-search-panel';
import type { ReactNode } from 'react';

export interface MapSidePanelProps {
  readonly search: MapSearchProps;
  readonly listState: AreaExhibitionListState;
  readonly notice?: string | null;
  readonly detail?: ReactNode;
}

export function MapSidePanel({
  search,
  listState,
  notice,
  detail,
}: MapSidePanelProps) {
  return (
    <MapSidePanelFrame header={<MapSearchPanel {...search} />}>
      {detail ?? <AreaExhibitionList state={listState} notice={notice} />}
    </MapSidePanelFrame>
  );
}
