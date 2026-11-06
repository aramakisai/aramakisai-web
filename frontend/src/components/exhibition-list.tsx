'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { sendGaEvent, trackPageView } from '@/lib/analytics';
import {
  buildExhibitionsHref,
  filterExhibitions,
  PAGE_SIZE,
  paginate,
  parseExhibitionQuery,
  type AreaOption,
  type ListingCard,
  type ExhibitionQuery,
} from '@/lib/exhibitions';
import { orderCards, readOrCreateSeed } from '@/lib/exhibition-order';
import { toItemListEntries } from '@/lib/item-list';
import { ExhibitionCard } from './exhibition-card';
import {
  ExhibitionFilters,
  type ExhibitionFilterValues,
} from './exhibition-filters';
import { ExhibitionPagination } from './exhibition-pagination';
import { ItemListTracker } from './item-list-tracker';

export interface ExhibitionListProps {
  readonly cards: readonly ListingCard[];
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

// lg:grid-cols-4 の 1 行目
const FIRST_ROW_COUNT = 4;

export function ExhibitionList({ cards, areas }: ExhibitionListProps) {
  // サーバー描画 (ISR のキャッシュ) は URL を知らないため全件・1 ページ目で始まり、
  // マウント時に URL から復元する
  const [query, setQuery] = useState(INITIAL_QUERY);
  // 検索欄はローカルの入力値を持つため、URL からの復元時は key で作り直して追従させる
  const [restoreCount, setRestoreCount] = useState(0);
  // 確定するまでカードを不可視にし、id 順から並べ替わる瞬間を見せない
  const [seed, setSeed] = useState<number | null>(null);

  const restore = useCallback(() => {
    setSeed((current) => current ?? readOrCreateSeed());
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
    sendGaEvent('exhibition_search', {
      item_count: filterExhibitions(cards, nextQuery).length,
    });
    setQuery(nextQuery);
    window.history.replaceState(null, '', buildExhibitionsHref(nextQuery));
  };

  const changePage = (page: number) => {
    const nextQuery = { ...query, page };
    setQuery(nextQuery);
    window.history.pushState(null, '', buildExhibitionsHref(nextQuery));
    // パス不変の URL 更新は GoogleAnalytics から見えないため、ページ送りはここで計測する
    trackPageView();
    window.scrollTo(0, 0);
  };

  const hasFilter =
    query.q !== '' || query.categories.length > 0 || query.areaIds.length > 0;
  const ordered = useMemo(() => {
    if (seed === null) return cards;
    const isBooth = (card: ListingCard) => card.category === 'booth';
    return [
      ...orderCards(
        cards.filter((card) => !isBooth(card)),
        seed,
      ),
      ...cards.filter(isBooth),
    ];
  }, [cards, seed]);
  const filtered = filterExhibitions(ordered, query);
  const total = filtered.length;
  const paginated = paginate(filtered, query.page);
  const rangeStart = total === 0 ? 0 : (paginated.page - 1) * PAGE_SIZE + 1;
  const rangeEnd =
    total === 0 ? 0 : Math.min(paginated.page * PAGE_SIZE, total);
  const hiddenStyle =
    seed === null ? { visibility: 'hidden' as const } : undefined;

  return (
    <>
      {/* JavaScript が動かない環境ではシードが確定しないため、不可視を打ち消して id 順で見せる */}
      <noscript>
        <style>{'[data-order-pending]{visibility:visible!important}'}</style>
      </noscript>
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
          <p
            className="text-sm text-gray-600"
            style={hiddenStyle}
            data-order-pending={seed === null ? '' : undefined}
          >
            全 {total} 件中 {rangeStart}–{rangeEnd} 件を表示
          </p>
          {/* items-start がないと行内の最も高いカードに合わせて伸び、グラデーション帯の
            下に背景色が残って角丸が効かなくなる。 */}
          <ItemListTracker
            listId="exhibitions"
            entries={
              seed === null
                ? []
                : toItemListEntries(paginated.items, rangeStart)
            }
            filtered={hasFilter}
          >
            <div
              className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-4"
              style={hiddenStyle}
              data-order-pending={seed === null ? '' : undefined}
            >
              {paginated.items.map((exhibition, index) => (
                <ExhibitionCard
                  priority={seed !== null && index < FIRST_ROW_COUNT}
                  key={`${exhibition.id}-${exhibition.category}`}
                  exhibition={exhibition}
                  bookmarkable
                />
              ))}
            </div>
          </ItemListTracker>
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
