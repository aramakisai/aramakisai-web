import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

export interface ExhibitionPaginationProps {
  readonly page: number;
  readonly pageCount: number;
  /** 現在の検索条件を保ったままページのみ差し替えた URL を返す */
  readonly hrefForPage: (page: number) => string;
}

// 通常の <a> によるページ遷移で URL を書き換える。クライアント側の状態は持たない。
export function ExhibitionPagination({
  page,
  pageCount,
  hrefForPage,
}: ExhibitionPaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav aria-label="ページ送り">
      <ul className="flex items-center justify-center gap-2">
        <li>
          {page > 1 ? (
            <Link
              href={hrefForPage(page - 1)}
              aria-label="前のページ"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-background text-text hover:bg-gray-100"
            >
              <ChevronLeftIcon size={20} />
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-background text-gray-300"
            >
              <ChevronLeftIcon size={20} />
            </span>
          )}
        </li>
        {pages.map((p) => (
          <li key={p}>
            <Link
              href={hrefForPage(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium text-text ${
                p === page
                  ? 'border-primary bg-primary'
                  : 'border-gray-200 bg-background hover:bg-gray-100'
              }`}
            >
              {p}
            </Link>
          </li>
        ))}
        <li>
          {page < pageCount ? (
            <Link
              href={hrefForPage(page + 1)}
              aria-label="次のページ"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-background text-text hover:bg-gray-100"
            >
              <ChevronRightIcon size={20} />
            </Link>
          ) : (
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-background text-gray-300"
            >
              <ChevronRightIcon size={20} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
