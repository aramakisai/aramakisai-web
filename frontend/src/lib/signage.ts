import type { Attachment, EventDay } from '@/lib/home-page-types';
import type { ParkingResponse } from '@/lib/parking';
import type { Timetable } from '@/lib/timetable';
import { getDaysUntilEventDay, toJstDateKey } from './event-day';

/** 向きで変わるのはキャンバス寸法だけで、ページ分割・時間窓の定数は向きに依らない */
export type SignageOrientation = 'landscape' | 'portrait';

export const CANVAS_SIZE: Readonly<
  Record<
    SignageOrientation,
    { readonly width: number; readonly height: number }
  >
> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
};

export type SlideLayout = 'title' | 'title-content' | 'section' | 'two-content';
export type SlideTone = 'normal' | 'alert';

interface SlideBase {
  readonly id: number;
  readonly durationSec: number;
  readonly pinned: boolean;
}
export type SignageSlide =
  | (SlideBase & {
      readonly kind: 'sponsors' | 'lost_items' | 'parking' | 'timetable';
    })
  | (SlideBase & {
      readonly kind: 'image' | 'campus_map';
      readonly image: Attachment | null;
    })
  | (SlideBase & {
      readonly kind: 'layout';
      readonly layout: SlideLayout;
      readonly tone: SlideTone;
      readonly title: string;
      readonly subtext: string | null;
      readonly content1Html: string;
      readonly content2Html: string;
    });

export interface SignageTelopItem {
  readonly id: number;
  readonly audience: 'visitor' | 'group';
  /** audienceがgroupのときの対象表記。例: "出店団体へ" */
  readonly target: string | null;
  readonly body: string;
}

export type SponsorTier = 'planA' | 'planB' | 'planC' | 'planD';
export interface SignageSponsor {
  readonly id: number;
  readonly name: string;
  readonly logoId: string | null;
  readonly tier: SponsorTier | null;
}

export interface SignageLostItem {
  readonly id: number;
  readonly name: string;
  readonly foundPlace: string;
  readonly foundAt: string;
  readonly photoId: string | null;
}

export interface SignageSnapshot {
  readonly fetchedAt: string;
  readonly eventDays: readonly EventDay[];
  readonly slides: readonly SignageSlide[];
  readonly telops: readonly SignageTelopItem[];
  readonly timetable: Timetable;
  readonly sponsors: readonly SignageSponsor[];
  readonly lostItems: readonly SignageLostItem[];
  readonly parking: ParkingResponse;
}

export interface PlaylistEntry {
  /** `${slideId}:${page}`。スナップショット更新を跨いで現在位置を引き継ぐ鍵 */
  readonly key: string;
  readonly slide: SignageSlide;
  readonly page: number;
}

const LOST_ITEMS_PER_PAGE = 8;

/** 1ページ8件(4列×2行) */
export function paginateLostItems(
  items: readonly SignageLostItem[],
): readonly (readonly SignageLostItem[])[] {
  const pages: SignageLostItem[][] = [];
  for (let i = 0; i < items.length; i += LOST_ITEMS_PER_PAGE) {
    pages.push(items.slice(i, i + LOST_ITEMS_PER_PAGE));
  }
  return pages;
}

export type SponsorRow =
  | {
      readonly kind: 'logo';
      readonly tier: 'planA' | 'planB' | 'planC';
      readonly items: readonly SignageSponsor[];
    }
  | { readonly kind: 'names'; readonly items: readonly SignageSponsor[] };

const SPONSOR_PAGE_HEIGHT = 704;
const SPONSOR_PLAN_GAP = 32;
const SPONSOR_ROW_GAP = 24;
const LOGO_TIERS = ['planA', 'planB', 'planC'] as const;
// 列数と行高(ロゴ枠+社名)はFigmaのロゴ領域の実測値
const LOGO_ROW_SPEC = {
  planA: { columns: 3, height: 232 },
  planB: { columns: 4, height: 176 },
  planC: { columns: 6, height: 128 },
} as const;
const NAME_ROW_SPEC = { columns: 4, height: 24 } as const;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

/** プランA〜Cかつロゴありはプラン別のロゴ行、それ以外(プランD・未設定・ロゴなし)は社名行。行高の合計が704pxを超える位置でページを分ける */
export function paginateSponsors(
  sponsors: readonly SignageSponsor[],
): readonly (readonly SponsorRow[])[] {
  const rows: { row: SponsorRow; height: number }[] = [];
  const rest: SignageSponsor[] = [];
  for (const tier of LOGO_TIERS) {
    const spec = LOGO_ROW_SPEC[tier];
    const logos = sponsors.filter((s) => s.tier === tier && s.logoId !== null);
    for (const items of chunk(logos, spec.columns)) {
      rows.push({ row: { kind: 'logo', tier, items }, height: spec.height });
    }
  }
  for (const s of sponsors) {
    const isLogo =
      s.logoId !== null &&
      (LOGO_TIERS as readonly string[]).includes(s.tier ?? '');
    if (!isLogo) rest.push(s);
  }
  for (const items of chunk(rest, NAME_ROW_SPEC.columns)) {
    rows.push({ row: { kind: 'names', items }, height: NAME_ROW_SPEC.height });
  }

  const pages: SponsorRow[][] = [];
  let used = 0;
  let prev: SponsorRow | null = null;
  for (const { row, height } of rows) {
    const sameGroup =
      prev !== null &&
      prev.kind === row.kind &&
      (row.kind === 'names' ||
        (prev.kind === 'logo' && prev.tier === row.tier));
    const gap =
      prev === null ? 0 : sameGroup ? SPONSOR_ROW_GAP : SPONSOR_PLAN_GAP;
    const page = pages[pages.length - 1];
    if (page && used + gap + height <= SPONSOR_PAGE_HEIGHT) {
      page.push(row);
      used += gap + height;
    } else {
      pages.push([row]);
      used = height;
    }
    prev = row;
  }
  return pages;
}

/** 開催日なら1始まりの日数、開催日以外はnull */
export function eventDayIndex(
  eventDays: readonly EventDay[],
  now: Date,
): number | null {
  const i = eventDays.findIndex(
    (d) => getDaysUntilEventDay(d.startAt, now) === 0,
  );
  return i < 0 ? null : i + 1;
}

function pageCount(
  slide: SignageSlide,
  snapshot: SignageSnapshot,
  now: Date,
): number {
  switch (slide.kind) {
    case 'sponsors':
      return paginateSponsors(snapshot.sponsors).length;
    case 'lost_items':
      return paginateLostItems(snapshot.lostItems).length;
    case 'parking':
      return snapshot.parking.lots.some((l) => l.status !== null) ? 1 : 0;
    case 'timetable': {
      const today = toJstDateKey(now.toISOString());
      return snapshot.timetable.performances.some(
        (p) => p.slot.dateKey === today,
      )
        ? 1
        : 0;
    }
    case 'image':
    case 'campus_map':
      return slide.image ? 1 : 0;
    case 'layout':
      return 1;
  }
}

/** 固定表示があればその1枚のページだけ、無ければ有効スライドを順に。空の自動スライドは除く */
export function buildPlaylist(
  snapshot: SignageSnapshot,
  now: Date,
): readonly PlaylistEntry[] {
  const pinned = snapshot.slides.find((s) => s.pinned);
  const slides = pinned ? [pinned] : snapshot.slides;
  return slides.flatMap((slide) =>
    Array.from({ length: pageCount(slide, snapshot, now) }, (_, page) => ({
      key: `${slide.id}:${page}`,
      slide,
      page,
    })),
  );
}
