import type { FestivalMeta } from '../cms-types';
import { EventDay } from './home-page-types';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// 実行環境 (OpenNext/Cloudflare Workers) は UTC で動くため、ローカルタイムゾーンの
// getters には依存せず、UTC 時刻へ +9h した値を UTC getters で読むことで JST を得る。
function toJstParts(iso: string) {
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

/** 表示ラベル未設定時の代替文言。例: "9月27日(日)" */
export function formatEventDayLabel(startAt: string): string {
  const { month, date, weekday } = toJstParts(startAt);
  return `${month}月${date}日(${WEEKDAY_LABELS[weekday]})`;
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
