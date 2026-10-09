'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  CampusMapArea,
  CampusMapDataResult,
  CampusMapFilters,
} from '@/lib/campus-map';
import { filterExhibitions } from '@/lib/exhibitions';
import { BUILD_PHASE, type FestivalPhase } from '@/lib/phase';
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

// シートが全画面近くまで伸びても地図コンテナが潰れないよう、追従はこの高さで止める
const MAP_FOLLOW_MAX_VH = 55;
// 角丸の裏が空かないよう、地図はシート上端からこの分だけシートの下に潜らせる
const SHEET_RADIUS_PX = 16;

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
  readonly phase?: FestivalPhase;
}

export function CampusMapScreen({
  data,
  initialFilters,
  // MapPage (Server Component) からのみ実際のフェーズが渡る。省略時は
  // BUILD_PHASE を使うことで、フェーズ結線に関与しない既存呼び出し元を壊さない
  phase = BUILD_PHASE,
}: CampusMapScreenProps) {
  const { filters, keywordInput, setKeywordInput, setCategories, selectArea } =
    useMapFilters(initialFilters);
  const [bottomInset, setBottomInset] = useState(0);
  const handleSheetHeightChange = useCallback((height: number) => {
    setBottomInset(
      Math.max(
        0,
        Math.min(height, (window.innerHeight * MAP_FOLLOW_MAX_VH) / 100) -
          SHEET_RADIUS_PX,
      ),
    );
  }, []);

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
    const selectedArea =
      filters.selectedAreaId === null
        ? undefined
        : areas.find((a) => a.id === filters.selectedAreaId);

    return {
      kind: 'filtered',
      areaName: selectedArea?.name ?? null,
      facilities: selectedArea && {
        hasAed: selectedArea.hasAed,
        hasToilet: selectedArea.hasToilet,
      },
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
      <MapMenuButton phase={phase} />
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
        selectedAreaId={filters.selectedAreaId}
        onHeightChange={handleSheetHeightChange}
      />
      {/*
       * SP では地図コンテナ自体をシート上端までに縮め、fitBounds・maxBounds がシートに
       * 隠れない可視領域基準になるようにする。コントロールは潜らせた分だけ持ち上げる
       */}
      <div
        data-testid="map-viewport"
        className="h-[calc(100dvh-var(--map-bottom-inset))] md:h-dvh max-md:[&_.leaflet-bottom]:mb-4"
        style={{ '--map-bottom-inset': `${bottomInset}px` } as CSSProperties}
      >
        <CampusMapView
          areas={areas}
          points={data.points}
          selectedAreaId={filters.selectedAreaId}
          onSelectArea={selectArea}
        />
      </div>
    </div>
  );
}
