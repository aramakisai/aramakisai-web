import { TouchMap } from '@/components/signage/touch/touch-map';
import { getCampusMapData } from '@/lib/campus-map';
import { isBuildPhase } from '@/lib/isr';

export const revalidate = 60;

export default async function TouchMapPage() {
  const data = await getCampusMapData();
  // 取得失敗の結果を描画すると次の再検証までキャッシュされるため、公開の /map と同じく例外にする
  if (
    !isBuildPhase() &&
    (data.areas.kind === 'error' || data.exhibitions.kind === 'error')
  ) {
    throw new Error('構内マップの取得に失敗しました');
  }
  return <TouchMap data={data} />;
}
