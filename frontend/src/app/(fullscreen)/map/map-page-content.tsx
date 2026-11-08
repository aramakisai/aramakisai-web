import { CampusMapScreen } from '@/components/campus-map/campus-map-screen';
import { getCorporateBoothCards } from '@/lib/corporate-booths';
import { getCampusMapData, type CampusMapPoint } from '@/lib/campus-map';
import { mergePreviewPoints } from '@/lib/campus-map-preview';
import { getNavigation } from '@/lib/get-navigation';
import { isBuildPhase, loadForIsr } from '@/lib/isr';
import { getRequestPhase } from '@/lib/request-phase';
import { cms } from '@/lib/cms';
import { getTopicById } from '@/lib/topics';

async function getPamphletUrl(): Promise<string | null> {
  const settings = await cms.findGlobal('site_settings', {}, { edge: true });
  if (!settings.ok) return null;
  const topic = settings.value.pamphlet_topic;
  const id = typeof topic === 'object' && topic ? topic.id : topic;
  if (!id || !(await getTopicById(id))) return null;
  return `/topics/${id}`;
}

export async function renderCampusMapPage(
  options: {
    readonly previewPoints?: readonly Omit<CampusMapPoint, 'id'>[];
    readonly basePath?: string;
    readonly testPamphletUrl?: string;
  } = {},
) {
  const [data, booths, pamphletUrl] = await Promise.all([
    getCampusMapData({ edge: true }),
    loadForIsr(getCorporateBoothCards, []),
    getPamphletUrl(),
  ]);
  // 実行時の取得失敗では ISR が古い正常なページを維持できるよう例外を投げる。
  if (
    !isBuildPhase() &&
    (data.areas.kind === 'error' || data.exhibitions.kind === 'error')
  ) {
    throw new Error('構内マップの取得に失敗しました');
  }
  const { phase } = await getRequestPhase();
  const navigation = await getNavigation();
  const mapData = options.previewPoints
    ? {
        ...data,
        points: mergePreviewPoints(data.points, options.previewPoints),
      }
    : data;

  return (
    <CampusMapScreen
      data={mapData}
      booths={booths}
      phase={phase}
      navigation={navigation}
      basePath={options.basePath}
      pamphletUrl={options.testPamphletUrl ?? pamphletUrl}
    />
  );
}
