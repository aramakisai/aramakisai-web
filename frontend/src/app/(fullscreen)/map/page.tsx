import type { Metadata } from 'next';
import { CampusMapScreen } from '@/components/campus-map/campus-map-screen';
import { getCampusMapData, parseCampusMapQuery } from '@/lib/campus-map';
import { getRequestPhase } from '@/lib/request-phase';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';

interface MapPageProps {
  searchParams: Promise<Record<string, string | readonly string[] | undefined>>;
}

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

export default async function MapPage({ searchParams }: MapPageProps) {
  const initialFilters = parseCampusMapQuery(await searchParams);
  const data = await getCampusMapData();
  const { phase } = await getRequestPhase();

  return (
    <CampusMapScreen
      data={data}
      initialFilters={initialFilters}
      phase={phase}
    />
  );
}
