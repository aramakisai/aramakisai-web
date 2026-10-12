import { formatEventDayTime, toJstParts } from './event-day';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export function formatSignageDate(now: Date): string {
  const { month, date, weekday } = toJstParts(now.toISOString());
  return `${month}/${date} (${WEEKDAYS[weekday]})`;
}

export function formatSignageClock(now: Date): string {
  return formatEventDayTime(now.toISOString());
}
