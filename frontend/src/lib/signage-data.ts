import type {
  LostItem,
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
import { getSponsors, mergeSponsorLogos } from './sponsors';
import { toTimetable } from './timetable';

export const SIGNAGE_TTL_SECONDS = 15;

const OPTIONS = { ttlSeconds: SIGNAGE_TTL_SECONDS } as const;
// limit を省くと Payload 既定の 10 件で切れる
const ALL = { limit: 0 } as const;
const TIERS: readonly string[] = ['planA', 'planB', 'planC', 'planD'];

/** 並び順の未設定は末尾、同値はID順 */
function bySort<T extends { id: number; sort?: number | null }>(
  a: T,
  b: T,
): number {
  const sa = a.sort ?? Number.POSITIVE_INFINITY;
  const sb = b.sort ?? Number.POSITIVE_INFINITY;
  return sa === sb ? a.id - b.id : sa < sb ? -1 : 1;
}

function toSlide(doc: CmsSignageSlide): SignageSlide {
  const base = {
    id: doc.id,
    durationSec: doc.duration_seconds,
    pinned: doc.pinned === true,
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

export async function getSignageSnapshot(): Promise<
  CmsResult<SignageSnapshot>
> {
  const [meta, slides, telops, lostItems, stages, slots, sponsors, parking] =
    await Promise.all([
      cms.findGlobal('festival_meta', {}, OPTIONS),
      cms.findMany('signage_slides', { ...ALL, depth: 1 }, OPTIONS),
      cms.findMany('telops', ALL, OPTIONS),
      cms.findMany('lost_items', { ...ALL, depth: 1 }, OPTIONS),
      cms.findMany('stages', { ...ALL, depth: 0 }, OPTIONS),
      cms.findMany('performance_slots', { ...ALL, depth: 1 }, OPTIONS),
      getSponsors(OPTIONS),
      getParkingResponse(),
    ]);
  if (!meta.ok) return meta;
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
      eventDays: toEventDays(meta.value.event_days),
      slides: [...slides.value.docs].sort(bySort).map(toSlide),
      telops: [...telops.value.docs].sort(bySort).map(toTelop),
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
