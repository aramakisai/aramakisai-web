'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
}

const CATEGORY_OPTIONS: readonly ExhibitionCategory[] = [
  'stage',
  'exhibit',
  'vendor',
  'other',
];

// 1 打鍵ごとの URL 更新 (履歴汚染・再取得の頻発) を避けるための確定待ち時間 (要件 2.1)
const KEYWORD_DEBOUNCE_MS = 300;

function buildHref(next: {
  readonly q: string;
  readonly categories: readonly ExhibitionCategory[];
  readonly areaIds: readonly number[];
}): string {
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  for (const category of next.categories) params.append('category', category);
  for (const areaId of next.areaIds) params.append('area', String(areaId));
  const qs = params.toString();
  // page は含めない: 条件変更のたびに 1 ページ目へ戻す (要件 2.8)
  return qs ? `/exhibitions?${qs}` : '/exhibitions';
}

export function ExhibitionFilters({ query, areas }: ExhibitionFiltersProps) {
  const router = useRouter();
  const [keyword, setKeyword] = useState(query.q);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      router.replace(
        buildHref({
          q: keyword.trim(),
          categories: query.categories,
          areaIds: query.areaIds,
        }),
      );
    }, KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // query.categories / query.areaIds はチップ操作時に別途 replace するため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const toggleCategory = (category: ExhibitionCategory) => {
    const categories = query.categories.includes(category)
      ? query.categories.filter((c) => c !== category)
      : [...query.categories, category];
    router.replace(
      buildHref({ q: keyword.trim(), categories, areaIds: query.areaIds }),
    );
  };

  const toggleArea = (areaId: number) => {
    const areaIds = query.areaIds.includes(areaId)
      ? query.areaIds.filter((id) => id !== areaId)
      : [...query.areaIds, areaId];
    router.replace(
      buildHref({ q: keyword.trim(), categories: query.categories, areaIds }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 focus-within:border-primary">
        <SearchIcon size={20} className="text-gray-500" />
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

      <div
        role="group"
        aria-label="カテゴリで絞り込み"
        className="flex flex-wrap gap-2"
      >
        {CATEGORY_OPTIONS.map((category) => {
          const pressed = query.categories.includes(category);
          return (
            <button
              key={category}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggleCategory(category)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                pressed
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-300 bg-white text-text'
              }`}
            >
              {CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>

      {areas.length > 0 && (
        <div
          role="group"
          aria-label="エリアで絞り込み"
          className="flex flex-wrap gap-2"
        >
          {areas.map((area) => {
            const pressed = query.areaIds.includes(area.id);
            return (
              <button
                key={area.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => toggleArea(area.id)}
                className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  pressed
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-300 bg-white text-text'
                }`}
              >
                {area.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
