import type { Metadata } from 'next';
import { TimetableView } from '@/components/timetable-view';
import { SectionHeading } from '@/components/section-heading';
import { JsonLd } from '@/components/json-ld';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import {
  getTimetable,
  resolveInitialDayKey,
  type Timetable,
} from '@/lib/timetable';
import { loadForIsr } from '@/lib/isr';
import { env } from '@/env';

export const revalidate = 60;

const EMPTY_TIMETABLE: Timetable = { days: [], stages: [], performances: [] };

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/timetable'];

  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/timetable',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function TimetablePage() {
  const timetable = await loadForIsr(getTimetable, EMPTY_TIMETABLE);
  const renderedAt = new Date().toISOString();
  const initialDayKey = resolveInitialDayKey(
    timetable.days,
    new Date(renderedAt),
  );

  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: 'タイムテーブル', path: '/timetable' },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-12 lg:px-20 lg:pt-12 lg:pb-20">
      <JsonLd data={breadcrumb} />
      <div className="flex flex-col gap-6 lg:gap-8">
        <SectionHeading
          level="h1"
          className="mb-0! text-center text-[32px] leading-[1.25] tracking-[0.02em] text-text"
        >
          タイムテーブル
        </SectionHeading>
        <TimetableView
          timetable={timetable}
          initialDayKey={initialDayKey}
          renderedAt={renderedAt}
        />
      </div>
    </div>
  );
}
