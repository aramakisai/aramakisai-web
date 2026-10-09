'use client';

import { useEffect, useState } from 'react';
import { SearchIcon } from './icons';
import {
  CATEGORY_LABELS,
  type AreaOption,
  type ExhibitionCategory,
  type ExhibitionQuery,
} from '@/lib/exhibitions';

export interface ExhibitionFiltersProps {
  readonly query: ExhibitionQuery;
  readonly areas: readonly AreaOption[];
  /** page は含めない: 条件変更のたびに 1 ページ目へ戻す (要件 2.8) */
  readonly onChange: (next: ExhibitionFilterValues) => void;
}

export type ExhibitionFilterValues = Pick<
  ExhibitionQuery,
  'q' | 'categories' | 'areaIds'
>;

const CATEGORY_OPTIONS: readonly ExhibitionCategory[] = [
  'stage',
  'exhibit',
  'vendor',
  'other',
];

// 1 打鍵ごとの URL 更新 (履歴汚染・再描画の頻発) を避けるための確定待ち時間 (要件 2.1)
const KEYWORD_DEBOUNCE_MS = 300;

export function ExhibitionFilters({
  query,
  areas,
  onChange,
}: ExhibitionFiltersProps) {
  const [keyword, setKeyword] = useState(query.q);

  useEffect(() => {
    // 条件が変わっていなければ通知しない。通知するとページ番号が 1 に戻り、
    // URL から復元した状態を再マウント (StrictMode の再実行を含む) が打ち消してしまう
    if (keyword.trim() === query.q) return;
    const timer = setTimeout(() => {
      onChange({
        q: keyword.trim(),
        categories: query.categories,
        areaIds: query.areaIds,
      });
    }, KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // query.categories / query.areaIds はチップ操作時に別途 replace するため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const toggleCategory = (category: ExhibitionCategory) => {
    const categories = query.categories.includes(category)
      ? query.categories.filter((c) => c !== category)
      : [...query.categories, category];
    onChange({ q: keyword.trim(), categories, areaIds: query.areaIds });
  };

  const toggleArea = (areaId: number) => {
    const areaIds = query.areaIds.includes(areaId)
      ? query.areaIds.filter((id) => id !== areaId)
      : [...query.areaIds, areaId];
    onChange({ q: keyword.trim(), categories: query.categories, areaIds });
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-background px-4 py-3 focus-within:border-primary lg:w-[480px]">
        <SearchIcon size={20} className="text-text" />
        <span className="sr-only">企画を検索</span>
        <input
          type="search"
          role="searchbox"
          aria-label="企画を検索"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="企画名・団体名で検索"
          className="w-full bg-transparent text-text outline-none placeholder:text-gray-400"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div
          role="group"
          aria-label="カテゴリで絞り込み"
          className="flex flex-col gap-2 lg:flex-row lg:items-center"
        >
          <span className="text-sm font-bold text-text lg:w-20">カテゴリ</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((category) => {
              const pressed = query.categories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => toggleCategory(category)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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

        {areas.length > 0 && (
          <div
            role="group"
            aria-label="エリアで絞り込み"
            className="flex flex-col gap-2 lg:flex-row lg:items-center"
          >
            <span className="text-sm font-bold text-text lg:w-20">エリア</span>
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => {
                const pressed = query.areaIds.includes(area.id);
                return (
                  <button
                    key={area.id}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => toggleArea(area.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      pressed
                        ? 'border-primary bg-primary text-text'
                        : 'border-gray-200 bg-background text-text'
                    }`}
                  >
                    {area.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
