'use client';

import { SearchIcon } from '@/components/icons';
import type { MapSearchCategory } from './map-search-panel';
import { useIsAboveMapBreakpoint } from '@/components/map/use-is-above-map-breakpoint';

export interface MapSearchOverlayProps<T extends string = string> {
  readonly keywordInput: string;
  readonly setKeywordInput: (value: string) => void;
  readonly categories: readonly T[];
  readonly setCategories: (categories: readonly T[]) => void;
  /** 「すべて」の後ろに並べるカテゴリ */
  readonly options: readonly MapSearchCategory<T>[];
  readonly placeholder: string;
  /** 検索欄のアクセシブルな名前 */
  readonly searchLabel: string;
  readonly groupLabel?: string;
  /** 入力要素の id 接頭辞。同じページの MapSearchPanel と重ならない値にする */
  readonly idPrefix?: string;
}

export function MapSearchOverlay<T extends string = string>({
  keywordInput,
  setKeywordInput,
  categories,
  setCategories,
  options,
  placeholder,
  searchLabel,
  groupLabel = 'カテゴリで絞り込み',
  idPrefix = 'map-search-overlay',
}: MapSearchOverlayProps<T>) {
  const isAboveBreakpoint = useIsAboveMapBreakpoint();

  const toggleCategory = (category: T) => {
    setCategories(
      categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category],
    );
  };

  return (
    <div
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[1080] flex flex-col gap-2 lg:hidden"
      aria-hidden={isAboveBreakpoint}
      inert={isAboveBreakpoint}
    >
      {/* MapMenuButton (top-right, ~60px) の下に潜らないよう、検索ボックスは内側 padding ではなく
          外側 margin で幅そのものを縮める。カテゴリチップ行はボタンより下にあり右端まで使える */}
      <label
        htmlFor={`${idPrefix}-keyword`}
        className="mr-14 flex items-center gap-2 rounded-md border border-gray-200 bg-white/95 px-4 py-[var(--map-search-box-padding-y)] leading-[var(--map-search-box-line-height)] shadow-lg backdrop-blur focus-within:border-primary"
      >
        <SearchIcon size={20} className="text-text" />
        <span className="sr-only">{searchLabel}</span>
        <input
          id={`${idPrefix}-keyword`}
          type="search"
          role="searchbox"
          aria-label={searchLabel}
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-text outline-none placeholder:text-gray-400"
        />
      </label>

      {/* 1 行に収まらない分は横スクロールで辿る 折り返さない */}
      <div
        role="group"
        aria-label={groupLabel}
        className="flex flex-nowrap gap-2 overflow-x-auto"
      >
        <button
          type="button"
          id={`${idPrefix}-category-all`}
          aria-pressed={categories.length === 0}
          onClick={() => setCategories([])}
          className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap hover-card-shadow ${
            categories.length === 0
              ? 'border-primary bg-primary text-text'
              : 'border-gray-200 bg-white/95 text-text'
          }`}
        >
          すべて
        </button>
        {options.map(({ value: category, label }) => {
          const pressed = categories.includes(category);
          return (
            <button
              key={category}
              type="button"
              id={`${idPrefix}-category-${category}`}
              aria-pressed={pressed}
              onClick={() => toggleCategory(category)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap hover-card-shadow ${
                pressed
                  ? 'border-primary bg-primary text-text'
                  : 'border-gray-200 bg-white/95 text-text'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
