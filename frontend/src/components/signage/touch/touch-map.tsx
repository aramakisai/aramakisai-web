'use client';

import dynamic from 'next/dynamic';
import { useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import {
  AreaExhibitionList,
  type AreaExhibitionListState,
} from '@/components/campus-map/area-exhibition-list';
import type { CampusMapArea, CampusMapDataResult } from '@/lib/campus-map';
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  filterExhibitions,
  type ExhibitionCategory,
} from '@/lib/exhibitions';
import {
  useReportTouchFilters,
  useReportTouchReady,
} from './touch-location-reporter';
import { TouchButton, TouchSegment } from './touch-segment';

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

// iframe は 728px。範囲の下端 y864 は iframe 内 y512 で、上余白 32 と対称に y480 を下端にするため、
// 下側 248px から既定の下余白 48px を引いた分を避ける
const FIT_BOTTOM_INSET = 200;

// 既定の maxBounds ではタイル範囲の西端が左パネルの右に固定され、全エリアを可視領域の中央へ置けない
const MAX_BOUNDS_PAD = 0.25;

const EMPTY_AREAS: readonly CampusMapArea[] = [];

const ALL = 'all';
const ITEMS = [
  { value: ALL, label: 'すべて', color: 'bg-secondary' },
  ...CATEGORY_VALUES.map((c) => ({
    value: c,
    label: CATEGORY_LABELS[c],
    color: 'bg-secondary',
  })),
];

export function TouchMap({ data }: { readonly data: CampusMapDataResult }) {
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [category, setCategory] = useState<ExhibitionCategory | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const reportReady = useReportTouchReady();

  useReportTouchFilters(
    useMemo(
      () => ({
        q: '',
        categories: category === null ? [] : [category],
        selectedAreaId,
      }),
      [category, selectedAreaId],
    ),
  );

  const areas = data.areas.kind === 'loaded' ? data.areas.value : EMPTY_AREAS;

  const listState: AreaExhibitionListState = useMemo(() => {
    if (data.exhibitions.kind === 'error') {
      return { kind: 'error', message: '出展物の取得に失敗しました。' };
    }
    if (data.areas.kind === 'loaded' && data.areas.value.length === 0) {
      return { kind: 'no-area' };
    }
    if (selectedAreaId === null && category === null) {
      return { kind: 'unselected' };
    }
    const categories = category === null ? [] : [category];
    const area = areas.find((a) => a.id === selectedAreaId);
    return {
      kind: 'filtered',
      areaName: area?.name ?? null,
      facilities: area && { hasAed: area.hasAed, hasToilet: area.hasToilet },
      keyword: '',
      categories,
      items: filterExhibitions(data.exhibitions.value, {
        q: '',
        categories,
        areaIds: selectedAreaId === null ? [] : [selectedAreaId],
        page: 1,
      }),
    };
  }, [data.exhibitions, data.areas, areas, selectedAreaId, category]);

  // タイルの無い余白(maxBounds の拡張分)に Leaflet 既定の #ddd が出ないよう、タイルの地色に合わせる
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-gray-100 [&_.leaflet-container]:bg-[#f3efea]">
      <div className="absolute inset-0 z-0">
        <CampusMapView
          areas={areas}
          points={data.points}
          selectedAreaId={selectedAreaId}
          onSelectArea={setSelectedAreaId}
          showUserLocation={false}
          showZoomControl={false}
          mapRef={mapRef}
          fitBottomInset={FIT_BOTTOM_INSET}
          maxBoundsPad={MAX_BOUNDS_PAD}
          onTilesLoaded={reportReady}
        />
      </div>
      <div
        data-map-side-panel
        className="absolute left-6 top-6 z-10 flex h-[680px] w-[656px] flex-col overflow-clip rounded-xl border-[1.75px] border-gray-200 bg-white pb-0 pl-6 pr-[20.5px] pt-6 shadow-[0px_14px_17.5px_-10.5px_rgba(156,163,176,0.2),0px_35px_43.75px_-8.75px_rgba(156,163,176,0.2)]"
      >
        <AreaExhibitionList state={listState} variant="signage" />
      </div>
      <div className="absolute right-6 top-[512px] z-10">
        <TouchSegment
          size="page"
          items={ITEMS}
          value={category ?? ALL}
          onSelect={(v) =>
            setCategory(v === ALL ? null : (v as ExhibitionCategory))
          }
          trailing={
            <>
              <TouchButton
                icon="add"
                aria-label="拡大"
                onClick={() => mapRef.current?.zoomIn()}
              />
              <TouchButton
                icon="remove"
                aria-label="縮小"
                onClick={() => mapRef.current?.zoomOut()}
              />
            </>
          }
        />
      </div>
    </div>
  );
}
