'use client';

import { SearchIcon } from '@/components/icons';

export interface MapSearchCategory<T extends string = string> {
  readonly value: T;
  readonly label: string;
}

export interface MapSearchProps<T extends string = string> {
  /** 検索欄に束縛する即時値 */
  readonly keyword: string;
  readonly categories: readonly T[];
  /** デバウンスや正規化は呼び出し側の責務のため、値をそのまま渡す */
  readonly onKeywordChange: (value: string) => void;
  readonly onCategoriesChange: (categories: readonly T[]) => void;
  /** 「すべて」の後ろに並べるカテゴリ */
  readonly options: readonly MapSearchCategory<T>[];
  readonly placeholder: string;
  /** 検索欄のアクセシブルな名前 */
  readonly searchLabel: string;
  readonly groupLabel?: string;
  /** スマートフォン側 (MapSearchOverlay) と同じページに同時に存在するため、id が重複しない接頭辞にする */
  readonly idPrefix?: string;
}

export function MapSearchPanel<T extends string = string>({
  keyword,
  categories,
  onKeywordChange,
  onCategoriesChange,
  options,
  placeholder,
  searchLabel,
  groupLabel = 'カテゴリで絞り込み',
  idPrefix = 'map-search-panel',
}: MapSearchProps<T>) {
  const toggleCategory = (category: T) => {
    onCategoriesChange(
      categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category],
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={`${idPrefix}-keyword`}
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-background px-4 py-3 focus-within:border-primary"
      >
        <SearchIcon size={20} className="text-text" />
        <span className="sr-only">{searchLabel}</span>
        <input
          id={`${idPrefix}-keyword`}
          type="search"
          role="searchbox"
          aria-label={searchLabel}
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-text outline-none placeholder:text-gray-400"
        />
      </label>

      <div
        role="group"
        aria-label={groupLabel}
        className="flex flex-wrap gap-2"
      >
        <button
          type="button"
          aria-pressed={categories.length === 0}
          onClick={() => onCategoriesChange([])}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium hover-card-shadow ${
            categories.length === 0
              ? 'border-primary bg-primary text-text'
              : 'border-gray-200 bg-background text-text'
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
              aria-pressed={pressed}
              onClick={() => toggleCategory(category)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium hover-card-shadow ${
                pressed
                  ? 'border-primary bg-primary text-text'
                  : 'border-gray-200 bg-background text-text'
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
