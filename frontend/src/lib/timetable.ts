import type { FestivalMeta, PerformanceSlot, Stage } from '@/cms-types';
import { cms, type CmsFetchError } from './cms';
import { formatEventDayLabel, toJstDateKey } from './event-day';

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
    (((new Date(timeIso).getTime() + JST_OFFSET_MS) % DAY_MS) + DAY_MS) %
    DAY_MS;
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

export interface TimetableStage {
  readonly id: number;
  readonly name: string;
}

export interface TimetablePerformance {
  readonly id: number;
  readonly stageId: number;
  readonly slot: TimetableSlot;
  /** 公開団体の団体名、団体なしは表示名 */
  readonly name: string;
  /** 公開団体なら '/exhibitions/{id}/stage'、それ以外は null */
  readonly href: string | null;
}

export interface Timetable {
  readonly days: readonly TimetableDay[];
  readonly stages: readonly TimetableStage[];
  readonly performances: readonly TimetablePerformance[];
}

export interface ExhibitionPerformance {
  readonly stageName: string;
  readonly dayLabel: string;
  readonly startAt: string;
  readonly endAt: string;
}

export type ExhibitionPerformancesResult =
  | {
      readonly kind: 'loaded';
      readonly value: readonly ExhibitionPerformance[];
    }
  | { readonly kind: 'error'; readonly error: CmsFetchError };

function isValidIso(v: string | null | undefined): v is string {
  return !!v && !Number.isNaN(Date.parse(v));
}

function toDays(eventDays: FestivalMeta['event_days']): TimetableDay[] {
  const byKey = new Map<string, TimetableDay>();
  for (const d of eventDays ?? []) {
    if (!isValidIso(d.start_at)) continue;
    const key = toJstDateKey(d.start_at);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: d.label || formatEventDayLabel(d.start_at),
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** 開催日・開始・終了のいずれかが欠損または解釈不能なら null */
function toSlot(p: PerformanceSlot): TimetableSlot | null {
  if (
    !isValidIso(p.event_date) ||
    !isValidIso(p.start_at) ||
    !isValidIso(p.end_at)
  ) {
    return null;
  }
  const dateKey = toJstDateKey(p.event_date);
  return {
    dateKey,
    startAt: combineJstDateTime(dateKey, p.start_at),
    endAt: combineJstDateTime(dateKey, p.end_at),
  };
}

/** 出演枠の表示名と遷移先。公開団体でなく表示名も無ければ null (枠ごと除く) */
function toLabel(
  p: PerformanceSlot,
): { name: string; href: string | null } | null {
  const ex = p.exhibition_id;
  if (ex && typeof ex === 'object' && ex.status === 'published') {
    const name = ex.organization_name || p.title;
    return name ? { name, href: `/exhibitions/${ex.id}/stage` } : null;
  }
  return p.title ? { name: p.title, href: null } : null;
}

function idOf(v: number | { id: number }): number {
  return typeof v === 'object' ? v.id : v;
}

export function toTimetable(sources: {
  readonly eventDays: FestivalMeta['event_days'];
  readonly stages: readonly Stage[];
  readonly performanceSlots: readonly PerformanceSlot[];
}): Timetable {
  const stages = [...sources.stages]
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id)
    .map((s) => ({ id: s.id, name: s.name }));
  const stageIds = new Set(stages.map((s) => s.id));

  const performances: TimetablePerformance[] = [];
  for (const p of sources.performanceSlots) {
    const slot = toSlot(p);
    const label = toLabel(p);
    const stageId = idOf(p.stage_id);
    if (!slot || !label || !stageIds.has(stageId)) continue;
    performances.push({ id: p.id, stageId, slot, ...label });
  }
  performances.sort(
    (a, b) => a.slot.startAt.localeCompare(b.slot.startAt) || a.id - b.id,
  );

  return { days: toDays(sources.eventDays), stages, performances };
}

/** 取得失敗時は例外を投げる (一覧系の既存規約) */
export async function getTimetable(): Promise<Timetable> {
  const [meta, stages, slots] = await Promise.all([
    cms.findGlobal('festival_meta'),
    cms.findMany('stages', { limit: 0, depth: 0 }),
    cms.findMany('performance_slots', { limit: 0, depth: 1 }),
  ]);
  if (!meta.ok || !stages.ok || !slots.ok) {
    throw new Error('タイムテーブルの取得に失敗しました');
  }
  return toTimetable({
    eventDays: meta.value.event_days,
    stages: stages.value.docs,
    performanceSlots: slots.value.docs,
  });
}

/** 現在出演中の出演枠 (サイネージ向け)。ステージ順 */
export function findActivePerformances(
  timetable: Timetable,
  now: Date,
): readonly TimetablePerformance[] {
  return timetable.stages.flatMap((s) =>
    timetable.performances.filter(
      (p) => p.stageId === s.id && isPerformanceActive(p.slot, now),
    ),
  );
}

/** 企画詳細用。開催日・開始時刻の昇順。取得失敗は例外にしない */
export async function getExhibitionPerformances(
  exhibitionId: number,
): Promise<ExhibitionPerformancesResult> {
  const [meta, slots] = await Promise.all([
    cms.findGlobal('festival_meta'),
    cms.findMany('performance_slots', {
      where: { exhibition_id: { equals: exhibitionId } },
      limit: 0,
      depth: 1,
    }),
  ]);
  if (!meta.ok) return { kind: 'error', error: meta.error };
  if (!slots.ok) return { kind: 'error', error: slots.error };

  const labels = new Map(
    toDays(meta.value.event_days).map((d) => [d.key, d.label]),
  );
  const rows: (ExhibitionPerformance & { id: number })[] = [];
  for (const p of slots.value.docs) {
    const slot = toSlot(p);
    if (!slot || typeof p.stage_id !== 'object') continue;
    rows.push({
      id: p.id,
      stageName: p.stage_id.name,
      dayLabel: labels.get(slot.dateKey) ?? formatEventDayLabel(p.event_date),
      startAt: slot.startAt,
      endAt: slot.endAt,
    });
  }
  rows.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id - b.id);
  return {
    kind: 'loaded',
    value: rows.map((r) => ({
      stageName: r.stageName,
      dayLabel: r.dayLabel,
      startAt: r.startAt,
      endAt: r.endAt,
    })),
  };
}

/** 開催日程を暦日順の日の一覧にする。取得失敗は例外にせず null */
export async function getEventDayList(): Promise<
  readonly TimetableDay[] | null
> {
  const meta = await cms.findGlobal('festival_meta');
  return meta.ok ? toDays(meta.value.event_days) : null;
}

/** 開催日程の順に、選ばれた日のラベルだけを「・」でつなぐ。範囲外と重複は days を軸にするため出ない */
export function formatOpenDays(
  openDayKeys: readonly string[],
  days: readonly TimetableDay[],
): string | null {
  const selected = new Set(openDayKeys);
  const labels = days.filter((d) => selected.has(d.key)).map((d) => d.label);
  return labels.length > 0 ? labels.join('・') : null;
}
