'use client';

import {
  REGIONAL_SPONSOR_CATEGORIES,
  REGIONAL_SPONSOR_CATEGORY_LABELS,
  type RegionalSponsorCategory,
} from '@/lib/regional-sponsor-categories';
import { RegionalSponsorIcon } from './regional-sponsor-icon';

export interface RegionalSponsorSearchProps {
  readonly query: string;
  readonly selectedCategories: ReadonlySet<RegionalSponsorCategory>;
  readonly onQueryChange: (value: string) => void;
  readonly onCategoryToggle: (
    category: RegionalSponsorCategory | 'all',
  ) => void;
  readonly mobile?: boolean;
}

export function RegionalSponsorSearch({
  query,
  selectedCategories,
  onQueryChange,
  onCategoryToggle,
  mobile = false,
}: RegionalSponsorSearchProps) {
  const controls = [
    { id: 'all' as const, label: 'すべて' },
    ...REGIONAL_SPONSOR_CATEGORIES.map((id) => ({
      id,
      label: REGIONAL_SPONSOR_CATEGORY_LABELS[id],
    })),
  ];
  return (
    <div className={mobile ? 'w-full' : ''}>
      <label className={`relative block ${mobile ? 'mr-14' : ''}`}>
        <span className="sr-only">店舗名・カテゴリ・住所で検索</span>
        <RegionalSponsorIcon
          name="search"
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="店舗名・カテゴリ・住所で検索"
          className={`w-full rounded-md border border-gray-200 bg-white pl-11 pr-3 text-sm text-text shadow-sm outline-none placeholder:text-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/30 ${mobile ? 'h-[53px]' : 'h-[46px]'}`}
        />
      </label>
      <div
        className={`mt-3 flex gap-2 ${mobile ? 'overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex-wrap'}`}
        role="group"
        aria-label="カテゴリで絞り込む"
      >
        {controls.map(({ id, label }) => {
          const pressed =
            id === 'all'
              ? selectedCategories.size === 0
              : selectedCategories.has(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pressed}
              onClick={() => onCategoryToggle(id)}
              className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-sm font-medium text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${mobile ? 'h-9' : ''} ${pressed ? 'border-primary bg-primary' : 'border-gray-200 bg-white'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
