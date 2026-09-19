'use client';

import { useEffect, useState } from 'react';
import { SearchIcon } from '@/components/icons';
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  type ExhibitionCategory,
} from '@/lib/exhibitions';

export interface MapSearchOverlayProps {
  readonly keywordInput: string;
  readonly setKeywordInput: (value: string) => void;
  readonly categories: readonly ExhibitionCategory[];
  readonly setCategories: (categories: readonly ExhibitionCategory[]) => void;
}

// CSS の md: プレフィックスと aria-hidden / inert (CSS では表現できない) を同じ条件で
// 切り替えるため、Tailwind の既定ブレークポイントと同じクエリを JS 側でも評価する
function useIsAboveMapBreakpoint(): boolean {
  const [isAbove, setIsAbove] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsAbove(mql.matches);
    const handleChange = (event: MediaQueryListEvent) =>
      setIsAbove(event.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);
  return isAbove;
}

export function MapSearchOverlay({
  keywordInput,
  setKeywordInput,
  categories,
  setCategories,
}: MapSearchOverlayProps) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();

  const toggleCategory = (category: ExhibitionCategory) => {
    setCategories(
      categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category],
    );
  };

  return (
    // MapMenuButton (top-right, ~60px) と重ならないよう右側に余白を確保する。
    // 入力要素の id は "map-search-overlay-" 接頭辞でデスクトップ側 (MapSearchPanel) と分ける
    <div
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[1080] flex flex-col gap-2 pr-14 md:hidden"
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      <label
        htmlFor="map-search-overlay-keyword"
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur focus-within:border-primary"
      >
        <SearchIcon size={20} className="text-text" />
        <span className="sr-only">企画を検索</span>
        <input
          id="map-search-overlay-keyword"
          type="search"
          role="searchbox"
          aria-label="企画を検索"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder="企画名・団体名で検索"
          className="w-full bg-transparent text-text outline-none placeholder:text-gray-400"
        />
      </label>

      {/* 1 行に収まらない分は横スクロールで辿る (要件 5.6)。折り返さない */}
      <div
        role="group"
        aria-label="カテゴリで絞り込み"
        className="flex flex-nowrap gap-2 overflow-x-auto"
      >
        {CATEGORY_VALUES.map((category) => {
          const pressed = categories.includes(category);
          return (
            <button
              key={category}
              type="button"
              id={`map-search-overlay-category-${category}`}
              aria-pressed={pressed}
              onClick={() => toggleCategory(category)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                pressed
                  ? 'border-primary bg-primary text-text'
                  : 'border-gray-200 bg-white/95 text-text'
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
