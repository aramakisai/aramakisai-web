import type { Metadata } from 'next';
import { AdvertisingSponsorsContent } from '@/components/advertising-sponsors';
import {
  getPersonalSponsors,
  groupAdSponsors,
} from '@/lib/advertising-sponsors';
import { loadForIsr } from '@/lib/isr';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import { getSiteMetadata } from '@/lib/site-metadata';
import { getSponsors } from '@/lib/sponsors';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/sponsors/ad'];
  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/sponsors/ad',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function AdvertisingSponsorsPage() {
  const sponsors = await loadForIsr(async () => {
    const result = await getSponsors();
    if (!result.ok) throw new Error('Failed to load sponsors');
    return groupAdSponsors(result.value.ad);
  }, groupAdSponsors([]));
  const personalSponsors = await loadForIsr(() => getPersonalSponsors(), []);

  return (
    <AdvertisingSponsorsContent
      sponsors={sponsors}
      personalSponsors={personalSponsors}
    />
  );
}
