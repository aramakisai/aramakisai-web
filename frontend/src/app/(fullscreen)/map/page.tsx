import type { Metadata } from 'next';
import { CampusMapScreen } from '@/components/campus-map/campus-map-screen';
import { getCampusMapData } from '@/lib/campus-map';
import { isBuildPhase } from '@/lib/isr';
import { getRequestPhase } from '@/lib/request-phase';
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
  const data = await getCampusMapData();
  // 実行時に取得失敗の結果を描画すると次の再検証までキャッシュされ、古い正常なページを
  // 上書きする。例外にして再検証を失敗させる (ビルド時は CMS が無いので結果のまま描画する)
  if (
    !isBuildPhase() &&
    (data.areas.kind === 'error' || data.exhibitions.kind === 'error')
  ) {
    throw new Error('構内マップの取得に失敗しました');
  }
  const { phase } = await getRequestPhase();

  // 絞り込み条件は URL から読む必要があり、ここで searchParams を読むとページが動的になるため、
  // クライアントがマウント時に location.search から復元する
  return <CampusMapScreen data={data} phase={phase} />;
}
