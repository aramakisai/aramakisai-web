import { buildCampusMapHref, type CampusMapFilters } from './campus-map';
import { buildExhibitionsHref } from './exhibitions';

type ExhibitionsFilters = Parameters<typeof buildExhibitionsHref>[0];

const UTM_CONTENT: readonly (readonly [RegExp, string])[] = [
  [/^\/map$/, 'map'],
  [/^\/exhibitions$/, 'exhibitions'],
  [/^\/exhibitions\/[^/]+\/[^/]+$/, 'exhibition_detail'],
  [/^\/timetable$/, 'timetable'],
  [/^\/parking$/, 'parking'],
  [/^\/topics$/, 'topics'],
  [/^\/topics\/[^/]+$/, 'topic_detail'],
];

/**
 * 端末用パス(未選択はnull)と絞り込みから、スマホで開く公式サイトのURLを組む。
 * 日付切替は公式サイトがURLから復元できないため含めない。
 */
export function buildTouchQrUrl(
  siteOrigin: string,
  touchPath: string | null,
  filters?: ExhibitionsFilters | CampusMapFilters,
): string {
  const path = touchPath?.replace(/^\/signage\/touch/, '') || '/';
  let href = path;
  if (filters && path === '/map' && 'selectedAreaId' in filters) {
    href = buildCampusMapHref(filters);
  } else if (filters && path === '/exhibitions' && 'areaIds' in filters) {
    href = buildExhibitionsHref({ ...filters, page: undefined });
  }
  const url = new URL(href, siteOrigin);
  url.searchParams.set('utm_source', 'signage');
  url.searchParams.set('utm_medium', 'qr');
  url.searchParams.set('utm_campaign', 'touch_navigation');
  url.searchParams.set(
    'utm_content',
    UTM_CONTENT.find(([re]) => re.test(path))?.[1] ?? 'home',
  );
  return url.toString();
}
