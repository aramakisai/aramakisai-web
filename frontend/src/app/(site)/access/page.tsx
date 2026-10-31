import type { Metadata } from 'next';
import busTimetable from '@/data/bus-timetable.json';
import { BusDepartureBoard } from '@/components/bus/bus-departure-board';
import { BusTimetableTable } from '@/components/bus/bus-timetable-table';
import { HoverLine } from '@/components/hover-line';
import { JsonLd } from '@/components/json-ld';
import { OpenInNewIcon } from '@/components/icons';
import { StaticPageView } from '@/components/static-page-view';
import { getAccessSettings } from '@/lib/access-settings';
import { departuresOn, type BusTimetableFile } from '@/lib/bus-timetable';
import { toJstDateKey } from '@/lib/event-day';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { env } from '@/env';

// 「今日」の発車一覧と CMS の編集を再デプロイなしで反映するため事前描画しない
export const dynamic = 'force-dynamic';

const KAN_ETSU_BUS_URL = 'https://kan-etsu.net/pages/23/';
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
    getAccessSettings(),
    getSiteMetadata(),
  ]);
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
        <BusDepartureBoard
          departures={departuresOn(
            file,
            toJstDateKey(new Date().toISOString()),
          )}
          fetchedAt={file.fetchedAt}
          renderedAt={new Date().toISOString()}
        />
        <BusTimetableTable
          file={file}
          eventDays={site.festival?.eventDays ?? []}
        />
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
      </StaticPageView>
    </>
  );
}
