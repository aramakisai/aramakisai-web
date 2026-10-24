import type { Metadata } from 'next';
import { RegionalSponsorMapScreen } from '@/components/regional-sponsor-map/regional-sponsor-map-screen';
import { getRequestPhase } from '@/lib/request-phase';
import { getRegionalSponsorMapData } from '@/lib/regional-sponsors';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import type { RegionalMapConfig } from '@/lib/regional-map-config';

export const revalidate = 60;

function getE2EMapProfile(): RegionalMapConfig | undefined {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.REGIONAL_SPONSOR_MAP_E2E_FIXTURE !== '1'
  ) {
    return undefined;
  }
  const rawProfile = process.env.REGIONAL_SPONSOR_MAP_E2E_PROFILE;
  if (!rawProfile) {
    throw new Error('Playwright用の地域地図profileが未指定です');
  }
  const profile = JSON.parse(rawProfile) as RegionalMapConfig;
  if (
    profile.id !== 'regional' ||
    profile.publicDirectory !== 'public/regional-map-tiles' ||
    profile.urlTemplate !== '/regional-map-tiles/{z}/{x}/{y}.webp'
  ) {
    throw new Error('Playwright用の地域地図profileが不正です');
  }
  return profile;
}

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
  const [data, { phase }, mapProfile] = await Promise.all([
    getRegionalSponsorMapData(),
    getRequestPhase(),
    getE2EMapProfile(),
  ]);
  return (
    <RegionalSponsorMapScreen
      data={data}
      phase={phase}
      {...(mapProfile ? { mapProfile } : {})}
    />
  );
}
