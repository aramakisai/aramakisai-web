'use client';

import dynamic from 'next/dynamic';
import type { SignageCampusMap } from '@/lib/signage';
import { SignageHeadingChip } from '../signage-heading-chip';

const CampusMapView = dynamic(
  () =>
    import('@/components/campus-map/campus-map-view').then(
      (mod) => mod.CampusMapView,
    ),
  {
    ssr: false,
    loading: () => <div role="status" className="size-full bg-gray-100" />,
  },
);

const noop = () => {};

interface CampusMapSlideProps {
  readonly campusMap: SignageCampusMap;
  readonly installAreaId: number | null;
}

export function CampusMapSlide({
  campusMap,
  installAreaId,
}: CampusMapSlideProps) {
  // 出典表記の書式は touch-map.tsx と同じ。右端だけ Figma の 26px に合わせる
  return (
    <div className="relative h-[864px] w-[1536px] overflow-clip rounded-2xl bg-gray-100 [&_.leaflet-container]:bg-[#f3efea] [&_.leaflet-control-attribution]:mr-[26px]! [&_.leaflet-control-attribution]:font-display! [&_.leaflet-control-attribution]:tracking-normal [&_.leaflet-control-attribution]:text-signage-caption! [&_.leaflet-control-attribution]:text-gray-600! [&_.leaflet-control-attribution_a]:text-gray-600!">
      {/* Leaflet はポリゴン等に pointer-events: auto を付け直すため pointer-events-none では操作を止められない */}
      <div inert className="absolute inset-0">
        <CampusMapView
          areas={campusMap.areas}
          points={campusMap.points}
          selectedAreaId={null}
          onSelectArea={noop}
          showUserLocation={false}
          showZoomControl={false}
          fitExcludeOutliers
          installAreaId={installAreaId}
        />
      </div>
      <SignageHeadingChip icon="map" label="構内マップ" />
    </div>
  );
}
