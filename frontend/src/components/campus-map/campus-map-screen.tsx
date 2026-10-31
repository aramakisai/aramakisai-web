'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import {
  MAP_VIEWPORT_CLASS,
  useMapNavClass,
  useMapSheetInset,
} from '@/components/map/use-map-sheet-inset';
import type { CampusMapArea, CampusMapDataResult } from '@/lib/campus-map';
import { sendGaEvent } from '@/lib/analytics';
import {
  filterExhibitions,
  type CorporateBoothCard,
  type ListingCard,
} from '@/lib/exhibitions';
import { BUILD_PHASE, type FestivalPhase } from '@/lib/phase';
import type { NavigationByPhase } from '@/lib/navigation';
import { PhasedBottomNavigation } from '@/components/phased-chrome';
import type { AreaExhibitionListState } from './area-exhibition-list';
import { MapBottomSheet } from './map-bottom-sheet';
import { MapMenuButton } from '@/components/map/map-menu-button';
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
        className="flex h-[calc(100dvh-var(--map-nav))] w-full items-center justify-center bg-gray-100 text-text"
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
const EMPTY_BOOTHS: readonly CorporateBoothCard[] = [];

export interface CampusMapScreenProps {
  readonly data: CampusMapDataResult;
  /** 学生企画の後ろに結合して検索・エリア別リストに使う。省略時は学生企画のみ */
  readonly booths?: readonly CorporateBoothCard[];
  readonly phase?: FestivalPhase;
  readonly navigation: NavigationByPhase;
}

export function CampusMapScreen({
  data,
  booths = EMPTY_BOOTHS,
  // MapPage (Server Component) からのみ実際のフェーズが渡る。省略時は
  // BUILD_PHASE を使うことで、フェーズ結線に関与しない既存呼び出し元を壊さない
  phase = BUILD_PHASE,
  navigation,
}: CampusMapScreenProps) {
  const navClass = useMapNavClass();
  const {
    filters,
    keywordInput,
    setKeywordInput,
    setCategories,
    selectArea: commitArea,
  } = useMapFilters();
  const selectArea = useCallback(
    (areaId: number | null) => {
      if (areaId !== null) sendGaEvent('campus_map', { result: 'area_select' });
      commitArea(areaId);
    },
    [commitArea],
  );
  const {
    bottomInset,
    onTargetHeightChange: handleSheetHeightChange,
    onTargetHeightIntent,
    getPendingInset,
  } = useMapSheetInset();

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

    const listings: readonly ListingCard[] = [
      ...data.exhibitions.value,
      ...booths,
    ];
    const items = filterExhibitions(listings, {
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
  }, [data.exhibitions, data.areas, areas, booths, filters]);

  // エリア選択は area_select で送るため、絞り込みイベントのキーには含めない
  const filterKey = JSON.stringify([filters.q, filters.categories]);
  const lastFilterKeyRef = useRef(filterKey);
  const settledRef = useRef(false);
  // URL からの条件復元は初回描画と同じ同期処理内で終わるため、マイクロタスク後を「ユーザー操作の開始」とみなす
  useEffect(() => {
    queueMicrotask(() => {
      settledRef.current = true;
    });
  }, []);
  useEffect(() => {
    if (lastFilterKeyRef.current === filterKey) return;
    lastFilterKeyRef.current = filterKey;
    if (!settledRef.current || listState.kind !== 'filtered') return;
    sendGaEvent('campus_map', {
      result: 'filter',
      item_count: listState.items.length,
    });
  }, [filterKey, listState]);

  const areaNotice = data.areas.kind === 'error' ? AREAS_ERROR_NOTICE : null;

  const search = {
    keyword: keywordInput,
    categories: filters.categories,
    onKeywordChange: setKeywordInput,
    onCategoriesChange: setCategories,
  };

  return (
    <div className={`relative h-dvh w-full ${navClass}`}>
      <MapMenuButton phase={phase} navigation={navigation} />
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
        onTargetHeightChange={handleSheetHeightChange}
        onTargetHeightIntent={onTargetHeightIntent}
      />
      <div
        data-testid="map-viewport"
        className={MAP_VIEWPORT_CLASS}
        style={{ '--map-bottom-inset': `${bottomInset}px` } as CSSProperties}
      >
        <CampusMapView
          areas={areas}
          points={data.points}
          selectedAreaId={filters.selectedAreaId}
          onSelectArea={selectArea}
          getPendingInset={getPendingInset}
        />
      </div>
      <PhasedBottomNavigation />
    </div>
  );
}
