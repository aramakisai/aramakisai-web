import type {
  LostItem,
  SignageSetting,
  SignageSlide as CmsSignageSlide,
  Telop,
} from '@/cms-types';
import { cms, type CmsResult } from './cms';
import { toAttachment, toMediaId } from './cms-media';
import { toEventDays } from './event-day';
import { getParkingResponse } from './parking-data';
import type {
  SignageLostItem,
  SignageSlide,
  SignageSnapshot,
  SignageSponsor,
  SignageTelopItem,
  SponsorTier,
} from './signage';
import type { SignagePinState } from './signage-pin';
import { getSponsors, mergeSponsorLogos } from './sponsors';
import { toTimetable } from './timetable';

export const SIGNAGE_TTL_SECONDS = 15;
export const SIGNAGE_REFRESH_INTERVAL_SECONDS = 5;

const OPTIONS = { ttlSeconds: SIGNAGE_TTL_SECONDS } as const;
// limit を省くと Payload 既定の 10 件で切れる
const ALL = { limit: 0 } as const;
// _order は Payload の orderable が持つ fractional index。昇順の取得順がそのまま並び順
const ORDERED = { ...ALL, sort: ['_order'] } as const;
const TIERS: readonly string[] = ['planA', 'planB', 'planC', 'planD'];

function toSlide(doc: CmsSignageSlide): SignageSlide {
  const base = {
    id: doc.id,
    durationSec: doc.duration_seconds,
  };
  switch (doc.kind) {
    case 'image':
    case 'campus_map':
      return { ...base, kind: doc.kind, image: toAttachment(doc.image) };
    case 'layout':
      return {
        ...base,
        kind: 'layout',
        layout: doc.layout ?? 'title',
        tone: doc.tone ?? 'normal',
        title: doc.title,
        subtext: doc.subtext ?? null,
        content1Html: doc.content1_html ?? '',
        content2Html: doc.content2_html ?? '',
      };
    default:
      return { ...base, kind: doc.kind };
  }
}

function pinnedSlideId(ref: SignageSetting['pinned_slide']): number | null {
  return typeof ref === 'object' && ref !== null ? ref.id : (ref ?? null);
}

function toTelop(doc: Telop): SignageTelopItem {
  return {
    id: doc.id,
    audience: doc.audience,
    target: doc.target ?? null,
    body: doc.body,
  };
}

function toLostItem(doc: LostItem): SignageLostItem {
  return {
    id: doc.id,
    name: doc.name,
    foundPlace: doc.found_place,
    foundAt: doc.found_at,
    photoId: toMediaId(doc.photo),
  };
}

export async function getSignageSnapshot({
  fresh = false,
}: { readonly fresh?: boolean } = {}): Promise<CmsResult<SignageSnapshot>> {
  const [
    meta,
    settings,
    slides,
    telops,
    lostItems,
    stages,
    slots,
    sponsors,
    parking,
  ] = await Promise.all([
    cms.findGlobal('festival_meta', {}, OPTIONS),
    cms.findGlobal('signage_settings', { depth: 0 }, OPTIONS),
    cms.findMany(
      'signage_slides',
      { ...ORDERED, depth: 1 },
      fresh
        ? {
            ...OPTIONS,
            refreshIntervalSeconds: SIGNAGE_REFRESH_INTERVAL_SECONDS,
          }
        : OPTIONS,
    ),
    cms.findMany('telops', ORDERED, OPTIONS),
    cms.findMany('lost_items', { ...ALL, depth: 1 }, OPTIONS),
    cms.findMany('stages', { ...ALL, depth: 0 }, OPTIONS),
    cms.findMany('performance_slots', { ...ALL, depth: 1 }, OPTIONS),
    getSponsors(OPTIONS),
    getParkingResponse(),
  ]);
  if (!meta.ok) return meta;
  if (!settings.ok) return settings;
  if (!slides.ok) return slides;
  if (!telops.ok) return telops;
  if (!lostItems.ok) return lostItems;
  if (!stages.ok) return stages;
  if (!slots.ok) return slots;
  if (!parking.ok) return parking;
  if (!sponsors.ok) return { ok: false, error: { kind: 'network', status: 0 } };

  const sponsorItems: SignageSponsor[] = mergeSponsorLogos(sponsors.value).map(
    (s) => ({
      id: s.id,
      name: s.name,
      logoId: s.logoId,
      tier: TIERS.includes(s.tier ?? '') ? (s.tier as SponsorTier) : null,
    }),
  );

  return {
    ok: true,
    value: {
      fetchedAt: new Date().toISOString(),
      serverNow: new Date().toISOString(),
      pinnedSlideId: pinnedSlideId(settings.value.pinned_slide),
      eventDays: toEventDays(meta.value.event_days),
      slides: slides.value.docs.map(toSlide),
      telops: telops.value.docs.map(toTelop),
      timetable: toTimetable({
        eventDays: meta.value.event_days,
        stages: stages.value.docs,
        performanceSlots: slots.value.docs,
      }),
      sponsors: sponsorItems,
      lostItems: [...lostItems.value.docs]
        .sort((a, b) => Date.parse(b.found_at) - Date.parse(a.found_at))
        .map(toLostItem),
      parking: parking.value,
    },
  };
}

/** 固定状態と表示対象のスライドIDだけをキャッシュなしで返す。固定は有効かつ表示対象のときだけ slide に入る */
export async function getPinState(): Promise<CmsResult<SignagePinState>> {
  const [settings, visible] = await Promise.all([
    cms.findGlobal('signage_settings', { depth: 2 }, { ttlSeconds: 0 }),
    // 未認証の読み取りは公開判定で表示対象のスライドだけに絞られる
    cms.findMany(
      'signage_slides',
      { ...ORDERED, depth: 0, select: { id: true } },
      { ttlSeconds: 0 },
    ),
  ]);
  if (!settings.ok) return settings;
  if (!visible.ok) return visible;
  const visibleSlideIds = visible.value.docs.map((d) => d.id);
  const ref = settings.value.pinned_slide;
  const slide =
    typeof ref === 'object' &&
    ref !== null &&
    ref.enabled &&
    visibleSlideIds.includes(ref.id)
      ? toSlide(ref)
      : null;
  return {
    ok: true,
    value: { serverNow: new Date().toISOString(), slide, visibleSlideIds },
  };
}
