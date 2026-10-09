'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  buildExhibitionsHref,
  filterExhibitions,
  PAGE_SIZE,
  paginate,
  parseExhibitionQuery,
  type AreaOption,
  type ExhibitionCardSummary,
  type ExhibitionQuery,
} from '@/lib/exhibitions';
import { ExhibitionCard } from './exhibition-card';
import {
  ExhibitionFilters,
  type ExhibitionFilterValues,
} from './exhibition-filters';
import { ExhibitionPagination } from './exhibition-pagination';

export interface ExhibitionListProps {
  readonly cards: readonly ExhibitionCardSummary[];
  readonly areas: readonly AreaOption[];
}

const INITIAL_QUERY: ExhibitionQuery = {
  q: '',
  categories: [],
  areaIds: [],
  page: 1,
};

function readQueryFromLocation(): ExhibitionQuery {
  const params = new URLSearchParams(window.location.search);
  return parseExhibitionQuery({
    q: params.get('q') ?? undefined,
    category: params.getAll('category'),
    area: params.getAll('area'),
    page: params.get('page') ?? undefined,
  });
}

export function ExhibitionList({ cards, areas }: ExhibitionListProps) {
  // サーバー描画 (ISR のキャッシュ) は URL を知らないため全件・1 ページ目で始まり、
  // マウント時に URL から復元する
  const [query, setQuery] = useState(INITIAL_QUERY);
  // 検索欄はローカルの入力値を持つため、URL からの復元時は key で作り直して追従させる
  const [restoreCount, setRestoreCount] = useState(0);

  const restore = useCallback(() => {
    setQuery(readQueryFromLocation());
    setRestoreCount((n) => n + 1);
  }, []);

  useLayoutEffect(restore, [restore]);

  useEffect(() => {
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [restore]);

  const applyFilters = (next: ExhibitionFilterValues) => {
    const nextQuery = { ...next, page: 1 };
    setQuery(nextQuery);
    window.history.replaceState(null, '', buildExhibitionsHref(nextQuery));
  };

  const changePage = (page: number) => {
    const nextQuery = { ...query, page };
    setQuery(nextQuery);
    window.history.pushState(null, '', buildExhibitionsHref(nextQuery));
    window.scrollTo(0, 0);
  };

  const hasFilter =
    query.q !== '' || query.categories.length > 0 || query.areaIds.length > 0;
  const filtered = filterExhibitions(cards, query);
  const total = filtered.length;
  const paginated = paginate(filtered, query.page);
  const rangeStart = total === 0 ? 0 : (paginated.page - 1) * PAGE_SIZE + 1;
  const rangeEnd =
    total === 0 ? 0 : Math.min(paginated.page * PAGE_SIZE, total);

  return (
    <>
      <ExhibitionFilters
        key={restoreCount}
        query={query}
        areas={areas}
        onChange={applyFilters}
      />
      {total === 0 ? (
        <p>
          {hasFilter
            ? '条件に一致する企画はありません'
            : '企画はまだ公開されていません'}
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            全 {total} 件中 {rangeStart}–{rangeEnd} 件を表示
          </p>
          {/* items-start がないと行内の最も高いカードに合わせて伸び、グラデーション帯の
            下に背景色が残って角丸が効かなくなる。 */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-4">
            {paginated.items.map((exhibition) => (
              <ExhibitionCard
                key={`${exhibition.id}-${exhibition.category}`}
                exhibition={exhibition}
              />
            ))}
          </div>
          <ExhibitionPagination
            page={paginated.page}
            pageCount={paginated.pageCount}
            hrefForPage={(page) => buildExhibitionsHref({ ...query, page })}
            onPageChange={changePage}
          />
        </>
      )}
    </>
  );
}
