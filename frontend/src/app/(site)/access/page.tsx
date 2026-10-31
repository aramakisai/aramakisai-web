import type { Metadata } from 'next';
import busTimetable from '@/data/bus-timetable.json';
import { BusDataNotice } from '@/components/bus/bus-data-notice';
import {
  BusCampusBoundTable,
  BusTimetableTable,
} from '@/components/bus/bus-timetable-table';
import { HoverLine } from '@/components/hover-line';
import { JsonLd } from '@/components/json-ld';
import { OpenInNewIcon } from '@/components/icons';
import { StaticPageView } from '@/components/static-page-view';
import { getAccessSettings, type AccessSettings } from '@/lib/access-settings';
import type { BusTimetableFile } from '@/lib/bus-timetable';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { env } from '@/env';

const KAN_ETSU_BUS_URL = 'https://kan-etsu.net/pages/23/';
// ビルド時に CMS へ届かなくても prerender を止めず、時刻表と出典だけは出す
const EMPTY_ACCESS = (): AccessSettings => ({
  summary: '',
  contentHtml: '',
  embedUrl: null,
  embedHeight: null,
});
const file = busTimetable as unknown as BusTimetableFile;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/access'];

  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/access',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function AccessPage() {
  const [access, site] = await Promise.all([
    getAccessSettings().catch(EMPTY_ACCESS),
    getSiteMetadata(),
  ]);
  const eventDays = site.festival?.eventDays ?? [];
  const title = ROUTE_METADATA['/access'].title ?? 'アクセス';

  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: title, path: '/access' },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <>
      <JsonLd data={breadcrumb} />
      <StaticPageView
        title={title}
        contentHtml={access.contentHtml}
        embedUrl={access.embedUrl}
        embedHeight={access.embedHeight}
        embedTitle="会場周辺の地図"
      >
        <BusCampusBoundTable file={file} eventDays={eventDays} />
        <BusTimetableTable file={file} eventDays={eventDays} />
        <a
          href={KAN_ETSU_BUS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex items-center gap-2 self-start text-sm leading-[1.4] font-bold text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          関越交通 路線バスの時刻表(最新の情報はこちら)
          <OpenInNewIcon size={20} />
          <HoverLine />
        </a>
        <BusDataNotice timetableFetchedAt={file.fetchedAt} variant="page" />
      </StaticPageView>
    </>
  );
}
