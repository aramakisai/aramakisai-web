'use client';

import {
  REGIONAL_SPONSOR_CATEGORIES,
  REGIONAL_SPONSOR_CATEGORY_LABELS,
  type RegionalSponsorCategory,
} from '@/lib/regional-sponsor-categories';
import { MaterialIcon } from '@/components/icons';

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
      {/* filter は入力欄ではなく label に付ける。入力欄に付けると重なり順が変わりアイコンの上に描かれる */}
      <label
        className={`relative block ${mobile ? 'mr-14 [filter:drop-shadow(0_4px_3px_rgba(0,0,0,0.1))_drop-shadow(0_10px_7.5px_rgba(0,0,0,0.1))]' : ''}`}
      >
        <span className="sr-only">店舗名・カテゴリ・住所で検索</span>
        <MaterialIcon
          name="search"
          size={20}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="店舗名・カテゴリ・住所で検索"
          className={`w-full rounded-md border border-gray-200 bg-white pl-11 pr-3 text-sm text-text outline-none placeholder:text-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/30 ${mobile ? 'h-[53px]' : 'h-[46px]'}`}
        />
      </label>
      <div
        className={`${mobile ? 'mt-2' : 'mt-4'} ${mobile ? 'flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'flex flex-col gap-2'}`}
        role="group"
        aria-label="カテゴリで絞り込む"
      >
        {(mobile ? [controls] : [controls.slice(0, 3), controls.slice(3)]).map(
          (row, rowIndex) => (
            <div key={rowIndex} className={mobile ? 'contents' : 'flex gap-2'}>
              {row.map(({ id, label }) => {
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
                    // Figma のチップ幅は文字数ごとの固定値で、PC は 48 + 8 × 文字数 (すべて 72、ショップ 80)、SP は全て 72
                    style={{
                      width: mobile ? 72 : 48 + 8 * [...label].length,
                    }}
                    className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border text-sm font-medium text-text hover-card-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${mobile ? 'h-9 px-4 py-2' : 'h-8 px-3 py-1.5'} ${pressed ? 'border-primary bg-primary' : 'border-gray-200 bg-white'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
