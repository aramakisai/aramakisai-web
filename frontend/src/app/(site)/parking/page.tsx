import type { Metadata } from 'next';
import { ParkingList } from '@/components/parking-list';
import { JsonLd } from '@/components/json-ld';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import { buildBreadcrumbJsonLd } from '@/lib/structured-data';
import { getParkingResponse } from '@/lib/parking-data';
import { env } from '@/env';

// 空き状況は常に最新を返す必要があり、ダミー CMS のビルドで事前描画させない
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/parking'];

  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/parking',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function ParkingPage() {
  const result = await getParkingResponse();
  const renderedAt = new Date().toISOString();

  const breadcrumb = buildBreadcrumbJsonLd(
    [
      { name: 'トップ', path: '/' },
      { name: '駐車場空き情報', path: '/parking' },
    ],
    env.NEXT_PUBLIC_SITE_URL,
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-12 lg:px-20 lg:pt-12 lg:pb-20">
      <JsonLd data={breadcrumb} />
      <ParkingList
        initial={result.ok ? result.value : null}
        renderedAt={renderedAt}
      />
    </div>
  );
}
