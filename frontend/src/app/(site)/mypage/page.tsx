import type { Metadata } from 'next';
import { MypageView } from '@/components/mypage-view';
import { CATEGORY_LABELS, getExhibitionCatalog } from '@/lib/exhibitions';
import { loadForIsr } from '@/lib/isr';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';
import { getSiteMetadata } from '@/lib/site-metadata';
import { toStampTargets } from '@/lib/stamp-targets';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/mypage'];

  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/mypage',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function MypagePage() {
  const { cards, areas } = await loadForIsr(getExhibitionCatalog, {
    cards: [],
    areas: [],
  });
  const targets = toStampTargets(cards);

  return (
    <MypageView
      targets={targets}
      areas={areas}
      categoryLabels={CATEGORY_LABELS}
      cards={cards}
    />
  );
}
