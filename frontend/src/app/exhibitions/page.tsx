import {
  getExhibitionListData,
  parseExhibitionQuery,
  type ExhibitionListResult,
  type ExhibitionQuery,
} from '@/lib/exhibitions';
import { ExhibitionCard } from '@/components/exhibition-card';
import { ExhibitionFilters } from '@/components/exhibition-filters';
import { ExhibitionPagination } from '@/components/exhibition-pagination';

interface ExhibitionsPageProps {
  searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}

function hrefForPage(query: ExhibitionQuery, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  for (const category of query.categories) params.append('category', category);
  for (const areaId of query.areaIds) params.append('area', String(areaId));
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return qs ? `/exhibitions?${qs}` : '/exhibitions';
}

export default async function ExhibitionsPage({
  searchParams,
}: ExhibitionsPageProps) {
  const query = parseExhibitionQuery(await searchParams);
  const hasFilter =
    query.q !== '' || query.categories.length > 0 || query.areaIds.length > 0;

  let result: ExhibitionListResult | null = null;
  try {
    result = await getExhibitionListData(query);
  } catch {
    result = null;
  }

  return (
    <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-12 lg:gap-6 lg:px-20 lg:pt-12 lg:pb-20">
      <h1 className="text-center">企画一覧</h1>
      {result === null ? (
        <p role="alert">
          企画情報の取得に失敗しました。しばらくしてから再度お試しください。
        </p>
      ) : (
        <>
          <ExhibitionFilters query={query} areas={result.areas} />
          {result.total === 0 ? (
            <p>
              {hasFilter
                ? '条件に一致する企画はありません'
                : '企画はまだ公開されていません'}
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500">
                全 {result.total} 件中 {result.rangeStart}–{result.rangeEnd}{' '}
                件を表示
              </p>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {result.items.map((exhibition) => (
                  <ExhibitionCard key={exhibition.id} exhibition={exhibition} />
                ))}
              </div>
              <ExhibitionPagination
                page={result.page}
                pageCount={result.pageCount}
                hrefForPage={(page) => hrefForPage(query, page)}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
