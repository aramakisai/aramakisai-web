import type { Metadata } from 'next';
import { RegionalSponsorMapScreen } from '@/components/regional-sponsor-map/regional-sponsor-map-screen';
import { getNavigation } from '@/lib/get-navigation';
import { getRequestPhase } from '@/lib/request-phase';
import { getRegionalSponsorMapData } from '@/lib/regional-sponsors';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/sponsors/local'];
  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/sponsors/local',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function RegionalSponsorMapPage() {
  const [data, { phase }, navigation] = await Promise.all([
    getRegionalSponsorMapData(),
    getRequestPhase(),
    getNavigation(),
  ]);
  return (
    <RegionalSponsorMapScreen data={data} phase={phase} navigation={navigation} />
  );
}
