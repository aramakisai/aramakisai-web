import { readSingleton } from '@directus/sdk';
import { directus } from './directus';
import { FestivalOverview } from './home-page-types';

export async function getFestivalMeta(): Promise<FestivalOverview> {
  const meta = await directus.request(
    readSingleton('festival_meta', {
      fields: [
        'name',
        'event_days',
        'admission_fee',
        'payment_note',
        'overview',
        'hero_image',
      ],
    }),
  );

  return {
    name: meta.name || '',
    eventDays: meta.event_days || [],
    admissionFee: meta.admission_fee ?? null,
    paymentNote: meta.payment_note ?? null,
    overviewHtml: meta.overview ?? null,
    heroImageId: meta.hero_image ?? null,
  };
}
