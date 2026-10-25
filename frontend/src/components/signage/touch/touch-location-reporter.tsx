'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import {
  postTouchMessage,
  type TouchFilters,
} from '@/lib/signage-touch-message';

export function TouchLocationReporter() {
  const path = usePathname() ?? '';
  useEffect(
    () => postTouchMessage({ type: 'signage-touch-path', path }),
    [path],
  );
  return null;
}

/** 地図タイルの描画が済んだことを上位文書へ知らせる。幕を外す合図になる */
export function useReportTouchReady() {
  const path = usePathname() ?? '';
  return useCallback(
    () => postTouchMessage({ type: 'signage-touch-ready', path }),
    [path],
  );
}

/** 絞り込みはページ内の state にしかないので、変化のたびに path と一緒に上位文書へ知らせる */
export function useReportTouchFilters(filters: TouchFilters) {
  const path = usePathname() ?? '';
  useEffect(
    () => postTouchMessage({ type: 'signage-touch-filters', path, filters }),
    [path, filters],
  );
}
