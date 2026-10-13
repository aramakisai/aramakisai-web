'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { paginate } from '@/lib/exhibitions';
import type { AnnouncementSummary } from '@/lib/home-page-types';
import { AnnouncementsList } from './announcements-list';
import { ExhibitionPagination } from './exhibition-pagination';

const PAGE_SIZE = 10;

export interface AnnouncementsPagedListProps {
  readonly announcements: readonly AnnouncementSummary[];
}

function readPageFromLocation(): number {
  const parsed = Number(
    new URLSearchParams(window.location.search).get('page'),
  );
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

const hrefForPage = (p: number) => `/announcements?page=${p}`;

export function AnnouncementsPagedList({
  announcements,
}: AnnouncementsPagedListProps) {
  // ISR のキャッシュは URL を知らないため 1 ページ目で描画し、マウント時に URL から復元する
  const [requestedPage, setRequestedPage] = useState(1);

  const restore = useCallback(
    () => setRequestedPage(readPageFromLocation()),
    [],
  );

  useLayoutEffect(restore, [restore]);

  useEffect(() => {
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [restore]);

  const changePage = (p: number) => {
    setRequestedPage(p);
    window.history.pushState(null, '', hrefForPage(p));
    window.scrollTo(0, 0);
  };

  const { items, page, pageCount } = paginate(
    announcements,
    requestedPage,
    PAGE_SIZE,
  );

  return (
    <>
      <AnnouncementsList announcements={[...items]} />
      <ExhibitionPagination
        page={page}
        pageCount={pageCount}
        hrefForPage={hrefForPage}
        onPageChange={changePage}
      />
    </>
  );
}
