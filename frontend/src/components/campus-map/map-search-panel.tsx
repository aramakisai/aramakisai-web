'use client';

import { SearchIcon } from '@/components/icons';
import {
  CATEGORY_LABELS,
  CATEGORY_VALUES,
  type ExhibitionCategory,
} from '@/lib/exhibitions';

// スマートフォン側 (MapSearchOverlay) と同じページに同時に存在するため、
// 入力要素の id が重複しないよう一貫した接頭辞を付ける
const KEYWORD_INPUT_ID = 'map-search-panel-keyword';

export interface MapSearchProps {
  /** 検索欄に束縛する即時値 (useMapFilters().keywordInput) */
  readonly keyword: string;
  readonly categories: readonly ExhibitionCategory[];
  /** デバウンスや正規化は useMapFilters 側の責務のため、値をそのまま渡す */
  readonly onKeywordChange: (value: string) => void;
  readonly onCategoriesChange: (
    categories: readonly ExhibitionCategory[],
  ) => void;
}

export function MapSearchPanel({
  keyword,
  categories,
  onKeywordChange,
  onCategoriesChange,
}: MapSearchProps) {
  const toggleCategory = (category: ExhibitionCategory) => {
    onCategoriesChange(
      categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category],
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={KEYWORD_INPUT_ID}
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-background px-4 py-3 focus-within:border-primary"
      >
        <SearchIcon size={20} className="text-text" />
        <span className="sr-only">企画を検索</span>
        <input
          id={KEYWORD_INPUT_ID}
          type="search"
          role="searchbox"
          aria-label="企画を検索"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="企画名・団体名で検索"
          className="w-full bg-transparent text-text outline-none placeholder:text-gray-400"
        />
      </label>

      <div
        role="group"
        aria-label="カテゴリで絞り込み"
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={categories.length === 0}
          onClick={() => onCategoriesChange([])}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            categories.length === 0
              ? 'border-primary bg-primary text-text'
              : 'border-gray-200 bg-background text-text'
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
              aria-pressed={pressed}
              onClick={() => toggleCategory(category)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                pressed
                  ? 'border-primary bg-primary text-text'
                  : 'border-gray-200 bg-background text-text'
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
