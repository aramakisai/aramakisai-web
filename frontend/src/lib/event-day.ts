import type { FestivalMeta } from '../cms-types';
import { EventDay } from './home-page-types';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 実行環境 (OpenNext/Cloudflare Workers) は UTC で動くため、ローカルタイムゾーンの
// getters には依存せず、UTC 時刻へ +9h した値を UTC getters で読むことで JST を得る。
export function toJstParts(iso: string) {
  const jst = new Date(new Date(iso).getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    date: jst.getUTCDate(),
    hours: jst.getUTCHours(),
    minutes: jst.getUTCMinutes(),
    weekday: jst.getUTCDay(),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 例: "9月27日" */
export function formatEventDayDate(startAt: string): string {
  const { month, date } = toJstParts(startAt);
  return `${month}月${date}日`;
}

/** 表示ラベル未設定時の代替文言。例: "9月27日(日)" */
export function formatEventDayLabel(startAt: string): string {
  const { weekday } = toJstParts(startAt);
  return `${formatEventDayDate(startAt)}(${WEEKDAY_LABELS[weekday]})`;
}

export function formatEventDayTime(iso: string): string {
  const { hours, minutes } = toJstParts(iso);
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/** 日本時間の暦日で数えた、開催日までの残り日数 (過ぎていれば負の値) */
export function getDaysUntilEventDay(
  startAt: string,
  now: Date = new Date(),
): number {
  const target = toJstParts(startAt);
  const current = toJstParts(now.toISOString());
  const targetUtc = Date.UTC(target.year, target.month - 1, target.date);
  const currentUtc = Date.UTC(current.year, current.month - 1, current.date);
  return Math.round((targetUtc - currentUtc) / DAY_MS);
}

/** 例: "11月14日 10:00〜17:30" (ヒーローのメタ情報表記。曜日・呼び名は含めない) */
export function formatEventDaySchedule(day: EventDay): string {
  return `${formatEventDayDate(day.startAt)} ${formatEventDayTime(day.startAt)}〜${formatEventDayTime(day.endAt)}`;
}

/** 複数の開催日を「／」で連結する。例: "11月14日 10:00〜17:30／11月15日 10:00〜16:30" */
export function formatEventDaysSummary(eventDays: EventDay[]): string | null {
  if (eventDays.length === 0) return null;
  return eventDays.map(formatEventDaySchedule).join('／');
}

/** 例: "開催まであと 54 日"。開催日を過ぎた分の負の値は 0 に丸める */
export function formatCountdownLabel(days: number): string {
  return `開催まであと ${Math.max(days, 0)} 日`;
}

export function toEventDays(
  rawEventDays: FestivalMeta['event_days'],
): EventDay[] {
  return (rawEventDays ?? []).map((day) => ({
    // 管理画面でラベルを空にすると '' で保存されるため、代替文言 (formatEventDayLabel) に
    // フォールバックさせるには null に正規化しておく必要がある。
    label: day.label || null,
    startAt: day.start_at,
    endAt: day.end_at,
  }));
}
