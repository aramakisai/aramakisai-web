'use client';

import { MapSidePanelFrame } from '@/components/map/map-side-panel-frame';
import {
  AreaExhibitionList,
  type AreaExhibitionListState,
} from './area-exhibition-list';
import { MapSearchPanel, type MapSearchProps } from './map-search-panel';

export interface MapSidePanelProps {
  readonly search: MapSearchProps;
  readonly listState: AreaExhibitionListState;
  readonly notice?: string | null;
}

export function MapSidePanel({ search, listState, notice }: MapSidePanelProps) {
  return (
    <MapSidePanelFrame header={<MapSearchPanel {...search} />}>
      <AreaExhibitionList state={listState} notice={notice} />
    </MapSidePanelFrame>
  );
}
