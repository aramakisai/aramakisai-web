import { cms } from './cms';
import { toMediaId } from './cms-media';
import { toEventDays } from './event-day';
import { FestivalMeta, SnsLink } from './home-page-types';

export async function getFestivalMeta(): Promise<FestivalMeta> {
  const result = await cms.findGlobal('site_settings');
  if (!result.ok) throw new Error('祭メタ情報の取得に失敗しました');
  const meta = result.value;

  return {
    name: meta.name || '',
    eventDays: toEventDays(meta.event_days),
    overviewHtml: meta.overview_html ?? null,
    ogImageId: toMediaId(meta.og_image),
    snsLinks: (meta.sns_links as SnsLink[] | null | undefined) ?? [],
  };
}

export async function getContactFormUrl(): Promise<string | null> {
  const result = await cms.findGlobal('site_settings');
  return result.ok ? (result.value.contact_form_url ?? null) : null;
}
