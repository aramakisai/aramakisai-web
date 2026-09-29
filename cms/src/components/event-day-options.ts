import { toJstDateKey } from '../hooks/constraints';

export type EventDay = { readonly start_at?: unknown; readonly label?: unknown };
export type EventDayOption = { readonly label: string; readonly value: string };

/** 保存形式: JST暦日のUTC正午。JSTへ戻しても同じ暦日になる。 */
export function eventDayValue(startAt: unknown): string | null {
  const key = toJstDateKey(startAt);
  return key ? `${key}T12:00:00.000Z` : null;
}

function md(value: string): string {
  const [, m, d] = value.slice(0, 10).split('-');
  return `${Number(m)}/${Number(d)}`;
}

function optionLabel(value: string, label: unknown): string {
  return typeof label === 'string' && label ? `${label}(${md(value)})` : md(value);
}

export function buildEventDayOptions(
  days: readonly EventDay[],
  current: unknown,
): EventDayOption[] {
  const options = days
    .flatMap((d) => {
      const value = eventDayValue(d.start_at);
      return value ? [{ label: optionLabel(value, d.label), value }] : [];
    })
    .sort((a, b) => a.value.localeCompare(b.value));
  const cur = eventDayValue(current);
  if (cur && !options.some((o) => o.value === cur)) {
    options.push({ label: `${md(cur)}(開催日程外)`, value: cur });
  }
  return options;
}

export function eventDayLabel(days: readonly EventDay[], current: unknown): string {
  const cur = eventDayValue(current);
  if (!cur) return '';
  return buildEventDayOptions(days, current).find((o) => o.value === cur)?.label ?? '';
}
