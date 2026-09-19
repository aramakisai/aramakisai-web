'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  CampusMapArea,
  CampusMapDataResult,
  CampusMapFilters,
} from '@/lib/campus-map';
import { filterExhibitions } from '@/lib/exhibitions';
import type { AreaExhibitionListState } from './area-exhibition-list';
import { MapBottomSheet } from './map-bottom-sheet';
import { MapMenuButton } from './map-menu-button';
import { MapSearchOverlay } from './map-search-overlay';
import { MapSidePanel } from './map-side-panel';
import { useMapFilters } from './use-map-filters';

// Server Component (map page) の中で ssr:false を指定するとビルドが失敗するため、
// Client Component であるこのファイルの中で動的読み込みを行う (design.md 参照)
const CampusMapView = dynamic(
  () => import('./campus-map-view').then((mod) => mod.CampusMapView),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className="flex h-dvh w-full items-center justify-center bg-gray-100 text-text"
      >
        地図を読み込んでいます…
      </div>
    ),
  },
);

const EXHIBITIONS_ERROR_MESSAGE =
  '出展物の取得に失敗しました。しばらくしてから再度お試しください。';

const AREAS_ERROR_NOTICE =
  'エリア情報の取得に失敗しました。地図はそのままご利用いただけます。';

// 失敗時の [] を毎レンダー新規生成すると、これを依存配列に含む useMemo が
// 参照比較で毎回再計算されてしまうため、安定した参照を 1 つだけ持つ
const EMPTY_AREAS: readonly CampusMapArea[] = [];

export interface CampusMapScreenProps {
  readonly data: CampusMapDataResult;
  readonly initialFilters: CampusMapFilters;
}

export function CampusMapScreen({
  data,
  initialFilters,
}: CampusMapScreenProps) {
  const { filters, keywordInput, setKeywordInput, setCategories, selectArea } =
    useMapFilters(initialFilters);
  const [sheetHeight, setSheetHeight] = useState(0);

  const areas: readonly CampusMapArea[] =
    data.areas.kind === 'loaded' ? data.areas.value : EMPTY_AREAS;

  const listState: AreaExhibitionListState = useMemo(() => {
    if (data.exhibitions.kind === 'error') {
      return { kind: 'error', message: EXHIBITIONS_ERROR_MESSAGE };
    }

    if (data.areas.kind === 'loaded' && data.areas.value.length === 0) {
      return { kind: 'no-area' };
    }

    const hasCondition =
      filters.q !== '' ||
      filters.categories.length > 0 ||
      filters.selectedAreaId !== null;
    if (!hasCondition) {
      return { kind: 'unselected' };
    }

    const items = filterExhibitions(data.exhibitions.value, {
      q: filters.q,
      categories: filters.categories,
      areaIds: filters.selectedAreaId === null ? [] : [filters.selectedAreaId],
      page: 1,
    });
    const areaName =
      filters.selectedAreaId === null
        ? null
        : (areas.find((a) => a.id === filters.selectedAreaId)?.name ?? null);

    return {
      kind: 'filtered',
      areaName,
      keyword: filters.q,
      categories: filters.categories,
      items,
    };
  }, [data.exhibitions, data.areas, areas, filters]);

  const areaNotice = data.areas.kind === 'error' ? AREAS_ERROR_NOTICE : null;

  const search = {
    keyword: keywordInput,
    categories: filters.categories,
    onKeywordChange: setKeywordInput,
    onCategoriesChange: setCategories,
  };

  return (
    <div className="relative h-dvh w-full">
      <MapMenuButton />
      <MapSearchOverlay
        keywordInput={keywordInput}
        setKeywordInput={setKeywordInput}
        categories={filters.categories}
        setCategories={setCategories}
      />
      <MapSidePanel search={search} listState={listState} notice={areaNotice} />
      <MapBottomSheet
        state={listState}
        notice={areaNotice}
        onHeightChange={setSheetHeight}
      />
      {/*
       * ボトムシートは全幅で画面下端に固定され、Leaflet の bottomright コントロール
       * (ズーム・出典表記, z-index 1000) より前面 (z-[1050]) に重なる。シートの高さは
       * ドラッグで連続的に変わるため、固定値ではなく実測値 (MapBottomSheet からの
       * onHeightChange) を CSS 変数として margin に反映し、隠れないよう追従させる
       */}
      <div
        data-testid="map-controls-margin"
        className="max-md:[&_.leaflet-bottom.leaflet-right]:mb-[calc(var(--map-bottom-sheet-height)+1rem)]"
        style={
          { '--map-bottom-sheet-height': `${sheetHeight}px` } as CSSProperties
        }
      >
        <CampusMapView
          areas={areas}
          selectedAreaId={filters.selectedAreaId}
          onSelectArea={selectArea}
        />
      </div>
    </div>
  );
}
