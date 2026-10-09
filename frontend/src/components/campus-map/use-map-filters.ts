'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  buildCampusMapHref,
  parseCampusMapQuery,
  type CampusMapFilters,
} from '@/lib/campus-map';
import type { ExhibitionCategory } from '@/lib/exhibitions';

// 企画一覧の絞り込み UI (ExhibitionFilters) とデバウンス時間を揃える (design.md 参照)
const KEYWORD_DEBOUNCE_MS = 300;

export interface UseMapFiltersResult {
  /** URL・絞り込みへ反映済みの確定状態。キーワードはデバウンス確定後の値 */
  readonly filters: CampusMapFilters;
  /** 検索欄に束縛する即時値。デバウンス中は filters.q と異なる */
  readonly keywordInput: string;
  readonly setKeywordInput: (value: string) => void;
  readonly setCategories: (categories: readonly ExhibitionCategory[]) => void;
  readonly selectArea: (areaId: number | null) => void;
}

function readFiltersFromLocation(): CampusMapFilters {
  const params = new URLSearchParams(window.location.search);
  return parseCampusMapQuery({
    q: params.get('q') ?? undefined,
    category: params.get('category') ?? undefined,
    area: params.get('area') ?? undefined,
  });
}

const EMPTY_FILTERS: CampusMapFilters = {
  q: '',
  categories: [],
  selectedAreaId: null,
};

export function useMapFilters(): UseMapFiltersResult {
  // サーバー描画 (ISR のキャッシュ) は URL を知らないため空の条件で始まり、マウント時に URL から復元する
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [keywordInput, setKeywordInput] = useState(EMPTY_FILTERS.q);
  // 直近の確定状態を同期的に参照するための ref。setState は非同期で連続更新時に取りこぼすため使う
  const filtersRef = useRef(EMPTY_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Next のルーターを経由すると Server Component の再レンダリング (CMS への再取得) が
  // 発生するため、履歴 API を直接使う (design.md の Implementation Notes 参照)
  const commit = useCallback((next: CampusMapFilters) => {
    filtersRef.current = next;
    setFilters(next);
    window.history.pushState(next, '', buildCampusMapHref(next));
  }, []);

  // ハイドレーション直後の描画より前に反映し、空の条件が一瞬見えるのを最小にする
  useLayoutEffect(() => {
    const restored = readFiltersFromLocation();
    filtersRef.current = restored;
    setFilters(restored);
    setKeywordInput(restored.q);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const next = readFiltersFromLocation();
      filtersRef.current = next;
      setFilters(next);
      setKeywordInput(next.q);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSetKeywordInput = useCallback(
    (value: string) => {
      setKeywordInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commit({ ...filtersRef.current, q: value.trim() });
      }, KEYWORD_DEBOUNCE_MS);
    },
    [commit],
  );

  const setCategories = useCallback(
    (categories: readonly ExhibitionCategory[]) => {
      commit({ ...filtersRef.current, categories });
    },
    [commit],
  );

  const selectArea = useCallback(
    (areaId: number | null) => {
      commit({ ...filtersRef.current, selectedAreaId: areaId });
    },
    [commit],
  );

  return {
    filters,
    keywordInput,
    setKeywordInput: handleSetKeywordInput,
    setCategories,
    selectArea,
  };
}
