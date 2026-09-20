'use client';

import { SearchIcon } from '@/components/icons';
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  type ExhibitionCategory,
} from '@/lib/exhibitions';
import { useIsAboveMapBreakpoint } from './use-is-above-map-breakpoint';

export interface MapSearchOverlayProps {
  readonly keywordInput: string;
  readonly setKeywordInput: (value: string) => void;
  readonly categories: readonly ExhibitionCategory[];
  readonly setCategories: (categories: readonly ExhibitionCategory[]) => void;
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
    // 入力要素の id は "map-search-overlay-" 接頭辞でデスクトップ側 (MapSearchPanel) と分ける
    <div
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[1080] flex flex-col gap-2 md:hidden"
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      {/* MapMenuButton (top-right, ~60px) の下に潜らないよう、検索ボックスは内側 padding ではなく
          外側 margin で幅そのものを縮める。カテゴリチップ行はボタンより下にあり右端まで使える */}
      <label
        htmlFor="map-search-overlay-keyword"
        className="mr-14 flex items-center gap-2 rounded-md border border-gray-200 bg-white/95 px-4 py-[var(--map-search-box-padding-y)] leading-[var(--map-search-box-line-height)] shadow-lg backdrop-blur focus-within:border-primary"
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
        <button
          type="button"
          id="map-search-overlay-category-all"
          aria-pressed={categories.length === 0}
          onClick={() => setCategories([])}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
            categories.length === 0
              ? 'border-primary bg-primary text-text'
              : 'border-gray-200 bg-white/95 text-text'
          }`}
        >
          すべて
        </button>
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
