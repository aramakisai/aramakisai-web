import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CampusMapScreen } from '@/components/campus-map/campus-map-screen';
import { getCampusMapData, parseCampusMapQuery } from '@/lib/campus-map';
import { PHASE_OVERRIDE_COOKIE, resolvePhase } from '@/lib/phase';
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
  const cookieStore = await cookies();
  const { phase } = resolvePhase(cookieStore.get(PHASE_OVERRIDE_COOKIE)?.value);

  return (
    <CampusMapScreen
      data={data}
      initialFilters={initialFilters}
      phase={phase}
    />
  );
}
