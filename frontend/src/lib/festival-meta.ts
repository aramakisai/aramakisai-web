import { cms } from './cms';
import { toMediaId } from './cms-media';
import { FestivalOverview } from './home-page-types';

export async function getFestivalMeta(): Promise<FestivalOverview> {
  const result = await cms.findGlobal('festival_meta', { depth: 1 });
  if (!result.ok) throw new Error('祭メタ情報の取得に失敗しました');
  const meta = result.value;

  return {
    name: meta.name || '',
    eventDays: (meta.event_days as FestivalOverview['eventDays']) || [],
    overviewHtml: meta.overview_html ?? null,
    heroImageId: toMediaId(meta.hero_image),
  };
}

export async function getContactFormUrl(): Promise<string | null> {
  const result = await cms.findGlobal('festival_meta');
  return result.ok ? (result.value.contact_form_url ?? null) : null;
}
