import type { Metadata } from 'next';
import {
  getExhibitionCatalog,
  type ExhibitionCatalog,
} from '@/lib/exhibitions';
import { ExhibitionList } from '@/components/exhibition-list';
import { loadForIsr } from '@/lib/isr';
import { getSiteMetadata } from '@/lib/site-metadata';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ROUTE_METADATA } from '@/lib/route-metadata';

export const revalidate = 60;

const EMPTY_CATALOG: ExhibitionCatalog = { cards: [], areas: [] };

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteMetadata();
  const route = ROUTE_METADATA['/exhibitions'];

  // 検索・絞り込み条件のクエリを含めず、一覧の正規パスを canonical にする (要件2.9)
  return buildPageMetadata({
    site,
    title: route.title,
    description: route.description,
    path: '/exhibitions',
    ogType: 'website',
    imageCandidates: [],
  });
}

export default async function ExhibitionsPage() {
  const { cards, areas } = await loadForIsr(
    getExhibitionCatalog,
    EMPTY_CATALOG,
  );

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pt-4 pb-12 lg:gap-6 lg:px-20 lg:pt-12 lg:pb-20">
      <h1 className="text-center">企画一覧</h1>
      <ExhibitionList cards={cards} areas={areas} />
    </div>
  );
}
