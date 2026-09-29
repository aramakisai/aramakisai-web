import { toJstDateKey } from './event-day';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimetableDay {
  /** JSTの暦日 'YYYY-MM-DD' */
  readonly key: string;
  readonly label: string;
}

export interface TimetableSlot {
  readonly dateKey: string;
  /** 出演枠の開催日とJST時刻を合成した絶対時刻 (ISO) */
  readonly startAt: string;
  readonly endAt: string;
}

/**
 * JSTの暦日 (`YYYY-MM-DD`) と、JST時刻を持つISO文字列から絶対時刻 (ISO) を作る。
 * timeIso の日付部分は CMS の time フィールドの基準日で意味を持たないため捨てる。
 */
export function combineJstDateTime(dateKey: string, timeIso: string): string {
  const jstDayStart = Date.parse(`${dateKey}T00:00:00Z`) - JST_OFFSET_MS;
  // 負の剰余 (1970 年より前の値) も正に寄せる
  const msOfDay =
    (((new Date(timeIso).getTime() + JST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return new Date(jstDayStart + msOfDay).toISOString();
}

/** now のJST暦日が days にあればその key、無ければ先頭、days が空なら null */
export function resolveInitialDayKey(
  days: readonly TimetableDay[],
  now: Date,
): string | null {
  const today = toJstDateKey(now.toISOString());
  return days.find((d) => d.key === today)?.key ?? days[0]?.key ?? null;
}

/** startAt <= now < endAt */
export function isPerformanceActive(slot: TimetableSlot, now: Date): boolean {
  const t = now.getTime();
  return Date.parse(slot.startAt) <= t && t < Date.parse(slot.endAt);
}
