import type { Metadata } from 'next';
import { renderCampusMapPage } from './map-page-content';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/map'];

  // エリア選択・検索クエリを含めず、マップの正規パスを canonical にする (要件2.9)
  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/map',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function MapPage() {
  // 絞り込み条件は URL から読む必要があり、ここで searchParams を読むとページが動的になるため、
  // クライアントがマウント時に location.search から復元する
  return renderCampusMapPage();
}
